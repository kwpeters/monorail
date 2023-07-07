import * as url from "url";
import * as path from "path";
import { Symlink } from "../src/symlink.js";
import { File } from "../src/file.js";
import { Directory } from "../src/directory.js";
import { tmpDir } from "./specHelpers.js";
import { getTimerPromise } from "../../depot/src/promiseHelpers.js";


const __dirname = url.fileURLToPath(new URL(".", import.meta.url));


describe("Symlink", () => {


    describe("instance", () => {


        beforeEach(() => {
            tmpDir.emptySync();
        });


        describe("toString()", () => {

            it("when constructed with a relative path, returns the same relative path", () => {
                const relPath = path.relative(
                    __dirname,
                    new Symlink(tmpDir, "link").absPath()
                );

                const relativeLink = new Symlink(relPath);
                expect(path.isAbsolute(relativeLink.toString())).toBeFalse();
                expect(relativeLink.toString()).toEqual(path.join("..", "tmp", "link"));
            });


            it("when constructed with an absolute path, returns the same absolute path", () => {
                const link = new Symlink(tmpDir.absPath(), "link");

                const absoluteLink = new Symlink(link.absPath(), "link");
                expect(path.isAbsolute(absoluteLink.toString())).toBeTrue();
                expect(absoluteLink.toString()).toEqual(path.resolve(absoluteLink.toString()));
            });


        });


        describe("absPath()", () => {

            it("returns the absolute path when the instance is constructed with a relative path", () => {
                const relPath = path.relative(
                    __dirname,
                    new Symlink(tmpDir, "link").absPath()
                );

                const relativeLink = new Symlink(relPath);
                const absPath = relativeLink.absPath();
                expect(path.isAbsolute(absPath)).toBeTrue();
                expect(absPath).toEqual(path.resolve(relativeLink.toString()));
            });


            it("returns the absolute path when the instance is constructed with an absolute path", () => {
                const absoluteLink = new Symlink(path.resolve(new Symlink(tmpDir, "link").toString()));
                const absPath = absoluteLink.absPath();
                expect(path.isAbsolute(absPath)).toBeTrue();
                expect(absPath).toEqual(path.resolve(absoluteLink.toString()));
            });

        });


        describe("create()", () => {


            it("fails when the parent directory of the symlink does not exist", async () => {

                const targetFile = new File(tmpDir, "foo.txt");
                await targetFile.write("foo");

                const symlink = new Symlink(tmpDir, "folderDoesNotExist", "foo.txt");
                const res = await symlink.create(targetFile, "relative");
                expect(res.failed).toBeTrue();
            });


            it("fails when the target does not exist", async () => {
                const targetFile = new File(tmpDir, "does-not-exist.txt");

                const symlink = new Symlink(tmpDir, "foo.txt");
                const res = await symlink.create(targetFile, "relative");
                expect(res.failed).toBeTrue();
            });


            it("can create a link to a target file", async () => {
                const target = new File(tmpDir, "target.txt");
                await target.write("text");

                const link = new Symlink(tmpDir, "link");
                const res = await link.create(target, "relative");
                expect(res.succeeded).toBeTrue();
            });


            it("can create a link to a target directory", async () => {
                const target = new Directory(tmpDir, "targetDir");
                await target.ensureExists();

                const link = new Symlink(tmpDir, "link");
                const res = await link.create(target, "relative");
                expect(res.succeeded).toBeTrue();
            });


            it("can create a link to a target symlink", async () => {
                const targetFile = new File(tmpDir, "targetFile.txt");
                await targetFile.write("text");

                const targetSymlink = new Symlink(tmpDir, "targetLink");
                await targetSymlink.create(targetFile, "relative");

                const link = new Symlink(tmpDir, "link");
                const res = await link.create(targetSymlink, "relative");
                expect(res.succeeded).toBeTrue();
            });


            describe("when a relative symlink is created", () => {


                it("reading its contents results in a relative path", async () => {
                    const targetFile = new File(tmpDir, "foo.txt");
                    await targetFile.write("foo");

                    const symlink = new Symlink(tmpDir, "foo-link");
                    const res = await symlink.create(targetFile, "relative");

                    expect(res.succeeded).toBeTrue();
                    const linkStringRes = await symlink.pathToTarget();
                    expect(linkStringRes.succeeded).toBeTrue();
                    expect(linkStringRes.value).toEqual("foo.txt");
                });


                // TODO: Implement this.
                // it("both can be moved and the symlink will still be valid", async () => {
                //
                //     const firstDir = new Directory(tmpDir, "firstDir");
                //     await firstDir.ensureExists();
                //     const secondDir = new Directory(tmpDir, "secondDir");
                //     await secondDir.ensureExists();
                //
                //     const targetFile = new File(firstDir, "target.txt");
                //     await targetFile.write("text");
                //     const symlink = new Symlink(firstDir, "link");
                //     symlink.create(targetFile, "relative");
                //
                //     const dstTargetFile = await targetFile.move(secondDir);
                //     const dstSymlink = await symlink.move(seondDir);
                //
                //     expect(dstSymlink.isRelative()).toBeTrue();
                //     expect(dstSymlink.followAll()!.succeeded).toBeTrue();
                // });

            });


            describe("when an absolute symlink is created", () => {

                it("reading its contents results in an absolute path", async () => {
                    const targetFile = new File(tmpDir, "foo.txt");
                    await targetFile.write("foo");

                    const symlink = new Symlink(tmpDir, "foo-link");
                    const res = await symlink.create(targetFile, "absolute");

                    expect(res.succeeded).toBeTrue();
                    const linkStringRes = await symlink.pathToTarget();
                    expect(linkStringRes.succeeded).toBeTrue();

                    const expectedPathTail = path.join("monorail", "packages", "depot-node", "tmp", "foo.txt");
                    expect(linkStringRes.value?.endsWith(expectedPathTail)).toBeTrue();
                });


                // TODO: Create a test where the absolute symlink and its target
                // are moved together (so the relative path from symlink to
                // target is preserved).  This should still result in an
                // inability to read the target file since the symlink was
                // absolute.


                it("when the target is moved the symlink becomes invalid", async () => {
                });


            });


        });


        describe("delete()", () => {

            it("succeeds if there is no filesystem item", async () => {
                const symlink = new Symlink(tmpDir, "link");
                const res = await symlink.delete();
                expect(res.succeeded).toBeTrue();
            });


            it("fails if the filesystem item is a file", async () => {
                const file = new File(tmpDir, "foo");
                await file.write("text");
                const link = new Symlink(tmpDir, "foo");
                const res = await link.delete();
                expect(res.failed).toBeTrue();
            });


            it("fails if the filesystem item is a directory", async () => {
                const dir = new Directory(tmpDir, "foo");
                await dir.ensureExists();
                const link = new Symlink(tmpDir, "foo");
                const res = await link.delete();
                expect(res.failed).toBeTrue();
            });


            it("succeeds when the symlink is successfully deleted", async () => {
                const targetFile = new File(tmpDir, "foo.txt");
                await targetFile.write("text");

                const link = new Symlink(tmpDir, "link");
                const resCreate = await link.create(targetFile, "relative");
                expect(resCreate.succeeded).toBeTrue();

                const resDelete = await link.delete();
                expect(resDelete.succeeded).toBeTrue();
            });


            it("does not delete the symlink's target file", async () => {
                const targetFile = new File(tmpDir, "foo.txt");
                await targetFile.write("text");

                const link = new Symlink(tmpDir, "link");
                const resCreate = await link.create(targetFile, "relative");
                expect(resCreate.succeeded).toBeTrue();

                const resDelete = await link.delete();
                expect(resDelete.succeeded).toBeTrue();

                expect(targetFile.existsSync()).toBeTruthy();
            });

        });


        describe("pathToTarget()", () => {

            it("fails when the filesystem item is not a symlink", async () => {
                const targetFile = new File(tmpDir, "foo.txt");
                await targetFile.write("text");

                const bogusLink = new Symlink(targetFile.toString());

                const res = await bogusLink.pathToTarget();
                expect(res.failed).toBeTrue();
            });


            describe("when the Symlink instance is created with a relative path", () => {

                it("succeeds with a relative path string", async () => {

                    const targetFile = new File(tmpDir, "foo.txt");
                    await targetFile.write("text");

                    const link = new Symlink(tmpDir, "link");
                    const createRes = await link.create(targetFile, "relative");
                    expect(createRes.succeeded).toBeTrue();

                    const pathToTargetRes = await link.pathToTarget();
                    expect(pathToTargetRes.succeeded).toBeTrue();
                    expect(path.isAbsolute(pathToTargetRes.value!)).toBeFalse();
                    expect(pathToTargetRes.value).toEqual("foo.txt");
                });

            });


            describe("when the Symlink instance is created with an absolute path", () => {

                it("succeeds with an absolute path string", async () => {

                    const targetFile = new File(tmpDir, "foo.txt");
                    await targetFile.write("text");

                    const link = new Symlink(tmpDir, "link");
                    const createRes = await link.create(targetFile, "absolute");
                    expect(createRes.succeeded).toBeTrue();

                    const pathToTargetRes = await link.pathToTarget();
                    expect(pathToTargetRes.succeeded).toBeTrue();
                    expect(path.isAbsolute(pathToTargetRes.value!)).toBeTrue();
                    expect(pathToTargetRes.value).toEqual(targetFile.absPath());
                });

            });

        });


        describe("exits()", () => {

            it("resolves with undefined when the filesystem item does not exist", async () => {
                const link = new Symlink(tmpDir, "link");
                const stats = await link.exists();
                expect(stats).toBeUndefined();
            });


            it("resolves with undefined when the filesystem item is not a symlink", async () => {
                const targetFile = new File(tmpDir, "foo.txt");
                await targetFile.write("text");

                const link = new Symlink(targetFile.toString());
                const stats = await link.exists();
                expect(stats).toBeUndefined();
            });


            it("resolves with a truthy Stat object when the filesystem item is a symlink", async () => {
                const targetFile = new File(tmpDir, "foo.txt");
                await targetFile.write("text");

                const link = new Symlink(tmpDir, "link");
                const createRes = await link.create(targetFile, "absolute");
                expect(createRes.succeeded).toBeTrue();

                const stats = await link.exists();
                expect(stats).toBeDefined();
            });


            it("stats the symlink file not the target", async () => {
                const targetFile = new File(tmpDir, "foo.txt");
                await targetFile.write("text");

                // Wait so that the link's birth time will be significantly later.
                const delayMs = 20;
                await getTimerPromise(delayMs, undefined);

                const link = new Symlink(tmpDir, "link");
                const createRes = await link.create(targetFile, "absolute");
                expect(createRes.succeeded).toBeTrue();

                const targetStats = (await targetFile.exists())!;
                const linkStats = (await link.exists())!;
                expect(linkStats.birthtimeMs - targetStats.birthtimeMs).toBeGreaterThan(delayMs * 0.9);

            });

        });


        describe("followOnce()", () => {

            it("fails when this instance does not exist in the filesystem", async () => {
                const link = new Symlink(tmpDir, "link");
                const res = await link.followOnce();
                expect(res.failed).toBeTrue();
            });


            it("fails when the target does not exist", async () => {
                const target = new File(tmpDir, "target.txt");
                await target.write("text");

                const link = new Symlink(tmpDir, "link");
                const createRes = await link.create(target, "relative");
                expect(createRes.succeeded).toBeTrue();

                // Delete the target file.
                await target.delete();

                const followRes = await link.followOnce();
                expect(followRes.failed).toBeTrue();
            });


            it("succeeds when the target is an extant file", async () => {
                const target = new File(tmpDir, "target.txt");
                await target.write("text");

                const link = new Symlink(tmpDir, "link");
                const createRes = await link.create(target, "relative");
                expect(createRes.succeeded).toBeTrue();

                const targetRes = await link.followOnce();
                expect(targetRes.succeeded).toBeTrue();
                expect(targetRes.value instanceof File).toBeTrue();
            });


            it("succeeds when the target is an extant directory", async () => {
                const target = new Directory(tmpDir, "targetDir");
                await target.ensureExists();

                const link = new Symlink(tmpDir, "link");
                const createRes = await link.create(target, "relative");
                expect(createRes.succeeded).toBeTrue();

                const targetRes = await link.followOnce();
                expect(targetRes.succeeded).toBeTrue();
                expect(targetRes.value instanceof Directory).toBeTrue();
            });


            it("succeeds when the target is an extant symlink", async () => {
                const targetFile = new File(tmpDir, "targetFile.txt");
                await targetFile.write("text");

                const targetSymlink = new Symlink(tmpDir, "targetLink");
                await targetSymlink.create(targetFile, "relative");

                const link = new Symlink(tmpDir, "link");
                const createRes = await link.create(targetSymlink, "relative");
                expect(createRes.succeeded).toBeTrue();

                const targetRes = await link.followOnce();
                expect(targetRes.succeeded).toBeTrue();
                expect(targetRes.value instanceof Symlink).toBeTrue();
            });

        });


        describe("followAll()", () => {

            it("fails when this instance does not exist in the filesystem", async () => {
                const link = new Symlink(tmpDir, "link");
                const res = await link.followAll();
                expect(res.failed).toBeTrue();
            });


            async function setupSymlinks(finalTarget: File | Directory): Promise<Symlink> {
                const numLinks = 5;
                let curTarget: File | Directory | Symlink = finalTarget;

                for (let linkIndex = numLinks; linkIndex > 0; linkIndex--) {
                    const curLink = new Symlink(tmpDir, `link${linkIndex}`);
                    await curLink.create(curTarget, "relative");
                    curTarget = curLink;
                }

                return curTarget as Symlink;
            }


            it("fails when one of the targets does not exist", async () => {
                const targetFile = new File(tmpDir, "targetFile.txt");
                await targetFile.write("text");
                const link1 = await setupSymlinks(targetFile);

                await targetFile.delete();

                const res = await link1.followAll();
                expect(res.failed).toBeTrue();
            });


            it("succeeds when the eventual target is an extant file", async () => {
                const targetFile = new File(tmpDir, "targetFile.txt");
                await targetFile.write("text");
                const link1 = await setupSymlinks(targetFile);

                const res = await link1.followAll();
                expect(res.succeeded).toBeTrue();
                expect(res.value instanceof File).toBeTrue();

                const file = res.value as File;
                expect(file.fileName).toEqual("targetFile.txt");
            });


            it("succeeds when the eventual target is an extant directory", async () => {
                const targetDir = new Directory(tmpDir, "targetDir");
                await targetDir.ensureExists();
                const link1 = await setupSymlinks(targetDir);

                const res = await link1.followAll();
                expect(res.succeeded).toBeTrue();
                expect(res.value instanceof Directory).toBeTrue();

                const dir = res.value as Directory;
                expect(dir.dirName).toEqual("targetDir");
            });

        });


    });


});
