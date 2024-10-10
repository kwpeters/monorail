import * as path from "node:path";
import { getTimerPromise } from "@repo/depot/promiseHelpers";
import { getFilesystemItem, getMostRecentlyModified, resolveDirectoryLocation, resolveFileLocation } from "./filesystemHelpers.mjs";
import {File} from "./file.mjs";
import {Directory} from "./directory.mjs";
import { Symlink } from "./symlink.mjs";
import { tmpDir } from "./specHelpers.test.mjs";


describe("getFilesystemItem()", () => {

    beforeEach(() => {
        tmpDir.emptySync();
    });


    it("succeeds with a File when the path represents a file", async () => {
        const file = new File(tmpDir, "test.txt");
        file.writeSync("hello");

        const fsItemRes = await getFilesystemItem(path.join("tmp", "test.txt"));
        expect(fsItemRes.succeeded).toBeTrue();
        expect(fsItemRes.value instanceof File).toBeTruthy();
    });


    it("succeeds with a Directory when the path represents a directory", async () => {
        const dir = new Directory(tmpDir, "test");
        dir.ensureExistsSync();

        const fsItemRes = await getFilesystemItem(path.join("tmp", "test"));
        expect(fsItemRes.succeeded).toBeTrue();
        expect(fsItemRes.value instanceof Directory).toBeTruthy();
    });


    it("succeeds with a Symlink when the path represents a symbolic link", async () => {
        const targetFile = new File(tmpDir, "foo.txt");
        await targetFile.write("text");

        const symlink = new Symlink(tmpDir, "link");
        await symlink.create(targetFile, "relative");

        const fsItemRes = await getFilesystemItem(symlink.toString());
        expect(fsItemRes.succeeded).toBeTrue();
        expect(fsItemRes.value instanceof Symlink).toBeTrue();
    });


    it("fails when the specified item does not exist", async () => {

        const res = await getFilesystemItem(path.join("tmp", "does-not-exist"));
        expect(res.failed).toBeTrue();
    });


});


describe("resolveFileLocation()", () => {

    beforeEach(() => {
        tmpDir.ensureExistsSync();
        tmpDir.emptySync();
    });


    it("resolves with the expected file when the file is found in the starting directory", async () => {
        const searchFile = new File(tmpDir, "foo.txt");
        searchFile.writeSync("search file");

        const result = await resolveFileLocation("foo.txt", tmpDir);
        expect(result.succeeded).toBeTruthy();
        if (result.succeeded) {
            expect(result.value.fileName).toEqual("foo.txt");
            expect(result.value.directory.equals(tmpDir)).toBeTruthy();
        }
    });


    it("resolves with the expected file when the file is found in a parent directory", async () => {
        const searchFile = new File(tmpDir, "foo.txt");
        searchFile.writeSync("search file");

        const dirA = new Directory(tmpDir, "dirA");
        dirA.ensureExistsSync();
        const dirB = new Directory(dirA, "dirB");
        dirB.ensureExistsSync();
        const dirC = new Directory(dirB, "dirC");
        dirC.ensureExistsSync();

        const result = await resolveFileLocation("foo.txt", dirC);
        expect(result.succeeded).toBeTruthy();
        if (result.succeeded) {
            expect(result.value.fileName).toEqual("foo.txt");
            expect(result.value.directory.equals(tmpDir)).toBeTruthy();
        }
    });


    // The following unit test is commented out, because on Windows I get
    // a permissions error when trying to create a file in C:\.
    //
    // xit("resolves with the expected file when the file is found in the drive root", async () => {
    //     const searchFile = new File("c:", "depotUnitTestFile.txt");
    //     searchFile.writeSync("depot unit test file");
    //
    //     const result = await resolveFileLocation(searchFile.fileName, tmpDir);
    //     expect(succeeded(result)).toBeTruthy();
    //     if (succeeded(result)) {
    //         expect(result.value.fileName).toEqual(searchFile.fileName);
    //         expect(result.value.absPath()).toEqual("c:\\depotUnitTestFile.txt");
    //     }
    //
    //     searchFile.deleteSync();
    // });


    it("resolves with a failed result when the file is not found", async () => {
        const result = await resolveFileLocation("aFileThatShouldNeverBeFound.txt", tmpDir);
        expect(result.failed).toBeTruthy();
        if (result.failed) {
            expect(result.error.length).toBeGreaterThan(0);
        }
    });

});


describe("resolveDirectoryLocation()", () => {

    beforeEach(() => {
        tmpDir.ensureExistsSync();
        tmpDir.emptySync();
    });


    it("resolves with the expected directory when the search directory is found in the starting directory", async () => {
        const searchDir = new Directory(tmpDir, "fooDir");
        searchDir.ensureExistsSync();

        const result = await resolveDirectoryLocation("fooDir", tmpDir);
        expect(result.succeeded).toBeTruthy();
        if (result.succeeded) {
            expect(result.value.parentDir()!.equals(tmpDir)).toBeTruthy();
        }
    });


    it("resolves with the expected directory when the search directory is found in a parent directory", async () => {
        const searchDir = new Directory(tmpDir, "fooDir");
        searchDir.ensureExistsSync();

        const dirA = new Directory(tmpDir, "dirA");
        dirA.ensureExistsSync();
        const dirB = new Directory(dirA, "dirB");
        dirB.ensureExistsSync();
        const dirC = new Directory(dirB, "dirC");
        dirC.ensureExistsSync();

        const result = await resolveDirectoryLocation("fooDir", dirC);
        expect(result.succeeded).toBeTruthy();
        if (result.succeeded) {
            expect(result.value.parentDir()!.equals(tmpDir)).toBeTruthy();
        }
    });


    it("resolves with a failed Result when the search directory is not found", async () => {
        const result = await resolveDirectoryLocation("aDirectoryThatShouldNeverBeFound", tmpDir);
        expect(result.failed).toBeTruthy();
        if (result.failed) {
            expect(result.error.length).toBeGreaterThan(0);
        }
    });

});


describe("getMostRecentlyModified()", () => {

    beforeEach(() => {
        tmpDir.ensureExistsSync();
        tmpDir.emptySync();
    });


    it("returns a failed result when the input array is emtpy", async () => {
        const res = await getMostRecentlyModified([]);
        expect(res.failed).toBeTrue();
    });


    it("returns the most recently modified Directory", async () => {
        const dirA = new Directory(tmpDir, "dirA");
        const dirB = new Directory(tmpDir, "dirB");
        const dirC = new Directory(tmpDir, "dirC");

        await Promise.all([dirA.ensureExists(), dirB.ensureExists(), dirC.ensureExists()]);

        const fileA = new File(dirA, "fileA.txt");
        const fileB = new File(dirB, "fileB.txt");
        const fileC = new File(dirC, "fileC.txt");

        // By writing _fileB_ last, _dirB_ should be the most recently modified.
        fileC.writeSync("file C");
        await getTimerPromise(20, undefined);
        fileA.writeSync("file A");
        await getTimerPromise(20, undefined);
        fileB.writeSync("file B");

        const res = await getMostRecentlyModified([dirA, dirB, dirC]);
        expect(res.succeeded).toBeTrue();
        if (res.succeeded) {
            expect(res.value.fsItem.dirName).toEqual("dirB");
        }
    });


    it("returns the most recently modified File", async () => {
        const fileA = new File(tmpDir, "fileA.txt");
        const fileB = new File(tmpDir, "fileB.txt");
        const fileC = new File(tmpDir, "fileC.txt");

        fileC.writeSync("file C");
        await getTimerPromise(20, undefined);
        fileA.writeSync("file A");
        await getTimerPromise(20, undefined);
        fileB.writeSync("file B");

        const res = await getMostRecentlyModified([fileA, fileB, fileC]);
        expect(res.succeeded).toBeTrue();
        if (res.succeeded) {
            expect(res.value.fsItem.fileName).toEqual("fileB.txt");
        }
    });


    it("returns the most recently modified Directory or File", async () => {
        const dirA = new Directory(tmpDir, "dirA");
        const dirB = new Directory(tmpDir, "dirB");
        const dirC = new Directory(tmpDir, "dirC");
        await Promise.all([dirA.ensureExists(), dirB.ensureExists(), dirC.ensureExists()]);

        const fileB = new File(dirB, "fileB.txt");
        const fileD = new File(tmpDir, "fileD.txt");

        fileD.writeSync("file D");
        await getTimerPromise(20, undefined);
        fileB.writeSync("file B");

        const res = await getMostRecentlyModified([dirA, dirB, dirC, fileD]);
        expect(res.succeeded).toBeTrue();
        if (res.succeeded) {
            expect(res.value.fsItem instanceof Directory).toBeTrue();
            if (res.value.fsItem instanceof Directory) {
                expect(res.value.fsItem.dirName).toEqual("dirB");
            }
        }
    });

});
