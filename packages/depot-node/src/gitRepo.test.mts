import path from "node:path";
import * as url from "node:url";
import * as _ from "lodash-es";
import {Url} from "@repo/depot/url";
import {CommitHash} from "@repo/depot/commitHash";
import {generateUuid, UuidFormat} from "@repo/depot/uuid";
import {GitRepo} from "./gitRepo.mjs";
import {GitBranch} from "./gitBranch.mjs";
import {Directory} from "./directory.mjs";
import {File} from "./file.mjs";
import {sampleRepoDir, sampleRepoUrl, tmpDir} from "./specHelpers.test.mjs";


const __dirname = url.fileURLToPath(new URL(".", import.meta.url));


describe("GitRepo", () => {

    let repoDir: Directory;

    beforeAll(() => {
        repoDir = sampleRepoDir;
    });


    describe("static", () => {

        describe("fromDirectory()", () => {

            it("will error when not given a directory that is not a repo directory", async () => {
                const result = await GitRepo.fromDirectory(new Directory(__dirname));
                expect(result.failed).toBeTrue();
                expect(result.error!.length).toBeGreaterThan(0);
            });


            it("will create a new instance when given a Git repo directory", async () => {
                const result = await GitRepo.fromDirectory(new Directory(repoDir));
                expect(result.succeeded).toBeTrue();
            });

        });


        describe("clone()", () => {

            beforeEach(() => {
                tmpDir.emptySync();
            });


            it("will clone a repository on the Internet", async () => {
                const repoUrl = Url.fromString(sampleRepoUrl);
                expect(repoUrl).toBeTruthy();

                const repo = await GitRepo.clone(repoUrl!, tmpDir);
                expect(repo).toBeTruthy();

                expect(new Directory(tmpDir, "sampleGitRepo-src").existsSync()).toBeTruthy();
                expect(new File(tmpDir, "sampleGitRepo-src", "README.md").existsSync()).toBeTruthy();
            });


            it("will clone a repository from a local directory", async () => {
                const repo = await GitRepo.clone(sampleRepoDir, tmpDir);

                expect(repo).toBeTruthy();
                expect(new Directory(tmpDir, "sampleGitRepo-src").existsSync()).toBeTruthy();
                expect(new File(tmpDir, "sampleGitRepo-src", "README.md").existsSync()).toBeTruthy();
            });


            it("can clone from a relative path", async () => {
                // This test is important, because when cloning from a relative
                // directory the clone() method must use the absolute path to
                // the source repo, because the cwd is the specified parentDir.

                const originDir = new Directory(tmpDir, "origin");
                const workingDir = new Directory(tmpDir, "working");
                await Promise.all([originDir.ensureExists(), workingDir.ensureExists()]);

                const originRepo  = await GitRepo.clone(sampleRepoDir, originDir);
                const workingRepo = await GitRepo.clone(originRepo.directory, workingDir);
                expect(workingRepo).toBeTruthy();
            });


            it("can clone a repo into a specific directory", async () => {
                // Create one clone in the "sample-origin" directory.
                const originRepo  = await GitRepo.clone(sampleRepoDir, tmpDir, "sample-origin");
                // Create another clone in the "sample-working" directory.
                const workingRepo = await GitRepo.clone(originRepo.directory, tmpDir, "sample-working");

                expect(originRepo).toBeTruthy();
                expect(workingRepo).toBeTruthy();

                expect(new Directory(tmpDir, "sample-origin").existsSync()).toBeTruthy();
                expect(new Directory(tmpDir, "sample-working").existsSync()).toBeTruthy();
            }, 10 * 1000);

        });


    });


    describe("instance", () => {

        beforeEach(() => {
            tmpDir.emptySync();
        });


        describe("files()", () => {

            it("will return the files under version control", async () => {
                tmpDir.emptySync();
                const repo = await GitRepo.clone(sampleRepoDir, tmpDir);
                const files = await repo.files();

                expect(_.findIndex(files, {fileName: "package.json"})).toBeGreaterThanOrEqual(0);
                expect(_.findIndex(files, {fileName: "README.md"})).toBeGreaterThanOrEqual(0);
                expect(_.findIndex(files, {fileName: "LICENSE"})).toBeGreaterThanOrEqual(0);
            });

        });


        describe("remotes()", () => {

            it("will return the correct map of remotes", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                GitRepo.fromDirectory(repoDir)
                .then((repoResult) => {
                    return repoResult.value!.remotes();
                })
                .then((remotes) => {
                    expect(Object.keys.length).toEqual(1);
                    expect(remotes.origin).toEqual("https://github.com/kwpeters/sampleGitRepo-src.git");
                    done();
                });
            });

        });


        describe("name()", () => {

            it("will return the name of the repo", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                GitRepo.fromDirectory(repoDir)
                .then((repoResult) => {
                    return repoResult.value!.name();
                })
                .then((repoName) => {
                    expect(repoName).toEqual("sampleGitRepo-src");
                    done();
                });
            });


        });


        describe("directory", () => {

            it("will return the directory of the repo", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                GitRepo.fromDirectory(repoDir)
                .then((repoResult) => {
                    const repo = repoResult.value!;
                    expect(repo.directory).toBeTruthy();
                    expect(repo.directory.absPath()).toContain("sampleGitRepo-src");
                    done();
                });
            });


        });


        describe("equals()", () => {

            it("will return true for two GitRepos pointing at the same directory", async () => {
                const repo1 = (await GitRepo.fromDirectory(repoDir)).value!;
                const repo2 = (await GitRepo.fromDirectory(repoDir)).value!;
                expect(repo1.equals(repo2)).toBeTruthy();
            });


            it("will return false for two GitRepos pointing at different directories", async () => {
                tmpDir.emptySync();

                const dir1 = new Directory(tmpDir, "dir1");
                dir1.ensureExistsSync();

                const dir2 = new Directory(tmpDir, "dir2");
                dir2.ensureExistsSync();

                const repo1 = await GitRepo.clone(sampleRepoDir, dir1);
                const repo2 = await GitRepo.clone(sampleRepoDir, dir2);
                expect(repo1.equals(repo2)).toBeFalsy();
            });
        });


        describe("tags()", () => {

            it("will list the tags applied to the repository", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                GitRepo.fromDirectory(repoDir)
                .then((repoResult) => {
                    return repoResult.value!.tags();
                })
                .then((tags) => {
                    expect(tags).toContain("aTag");
                    done();
                });
            });


        });


        describe("hasTag()", () => {

            it("will return true for a tag that exists", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                GitRepo.fromDirectory(repoDir)
                .then((repoResult) => {
                    return repoResult.value!.hasTag("aTag");
                })
                .then((hasTag) => {
                    expect(hasTag).toBeTruthy();
                    done();
                });
            });


            it("will return false for a tag that does not exists", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                GitRepo.fromDirectory(repoDir)
                .then((repoResult) => {
                    return repoResult.value!.hasTag("xyzzy");
                })
                .then((hasTag) => {
                    expect(hasTag).toBeFalsy();
                    done();
                });
            });


        });


        describe("createTag()", () => {

            let theRepo: GitRepo;
            const unitTestTag = "unittest_tag";


            beforeEach((done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                GitRepo.fromDirectory(repoDir)
                .then((repoResult) => {
                    theRepo = repoResult.value!;
                    return theRepo.deleteTag(unitTestTag);
                })
                .then(() => {
                    done();
                });
            });


            it("will resolve when the specified tag is created", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                theRepo.createTag(unitTestTag)
                .then(() => {
                    return theRepo.hasTag(unitTestTag);
                })
                .then((hasTag) => {
                    expect(hasTag).toBeTruthy();
                    done();
                });
            });


            it("will reject when the tag already exists", (done) => {
                theRepo.createTag(unitTestTag)
                .then(() => {
                    return theRepo.createTag(unitTestTag);
                })
                .catch(() => {
                    done();
                });
            });


            it("will resolve when the tag already exists but force is set to true", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                theRepo.createTag(unitTestTag)
                .then(() => {
                    return theRepo.createTag(unitTestTag, "", true);
                })
                .then(() => {
                    done();
                });
            });


        });


        describe("deleteTag()", () => {

            let theRepo: GitRepo;
            const unitTestTag = "unittest_tag";


            beforeEach(() => {
                return GitRepo.fromDirectory(repoDir)
                .then((repoResult) => {
                    theRepo = repoResult.value!;
                    return repoResult.value!.deleteTag(unitTestTag);
                });
            });


            afterEach(() => {
                return theRepo.deleteTag(unitTestTag);
            });


            it("will resolve if the specified tag does not exist", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                theRepo.deleteTag("xyzzy")
                .then(() => {
                    done();
                });
            });


            it("will resolve when the tag is deleted", (done) => {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                theRepo.createTag(unitTestTag)
                .then(() => {
                    return theRepo.deleteTag(unitTestTag);
                })
                .then(() => {
                    return theRepo.hasTag(unitTestTag);
                })
                .then((hasTag) => {
                    expect(hasTag).toBeFalsy();
                    done();
                });
            });

        });


        describe("getBranches", () => {


            it("will return the branches", async () => {
                const repo = (await GitRepo.fromDirectory(repoDir)).value!;
                const branches = await repo.getBranches();
                expect(branches.length).toBeGreaterThan(0);
                expect(_.map(branches, "name")).toContain("master");
            });


        });


        describe("getCurrentBranch()", () => {

            it("will return the current branch", async () => {
                const repo = (await GitRepo.fromDirectory(repoDir)).value!;
                const curBranch = await repo.getCurrentBranch();
                expect(curBranch!.name.length).toBeGreaterThan(0);
            });


            it("will return undefined when in detached head state", async () => {
                const repo = await GitRepo.clone(sampleRepoDir, tmpDir);
                // Checkout a commit that has no associated branch pointing at it.
                await repo.checkoutCommit(CommitHash.fromString("34b8bff")!);

                const branch = await repo.getCurrentBranch();
                expect(branch).toEqual(undefined);
            });


        });


        describe("checkoutBranch()", () => {
            // TODO:  Create unit tests.

            it("todo", () => {
                expect(true).toBeTruthy();
            });
        });


        describe("checkoutCommit()", () => {
            // TODO:  Create unit tests.

            it("todo", () => {
                expect(true).toBeTruthy();
            });
        });


        describe("stageAll()", () => {
            // TODO:  Create unit tests.

            it("todo", () => {
                expect(true).toBeTruthy();
            });
        });


        describe("stage()", () => {
            it("succeeds when staging a modified file", async () => {
                // Given there is a modified file in a repository...
                const repoDir = new Directory(tmpDir, "repoDir");
                await repoDir.ensureExists();
                const repo = await GitRepo.clone(sampleRepoDir, repoDir);

                const modifiedFile = new File(repo.directory, "package.json");
                modifiedFile.writeSync("modified by unit test");

                // When we stage the modified file...
                const stageResult = await repo.stage(modifiedFile);

                // Then, the result will be successful and contain the staged file.
                expect(stageResult.succeeded).toBeTrue();
                expect(stageResult.value!.equals(modifiedFile)).toBeTrue();
            });


            it("succeeds when staging an unmodified file", async () => {
                // Given there are no modified files in a repository...
                const repoDir = new Directory(tmpDir, "repoDir");
                await repoDir.ensureExists();
                const repo = await GitRepo.clone(sampleRepoDir, repoDir);

                const repoFile = new File(repo.directory, "package.json");

                // When we attempt to stage an unmodified file...
                const stageResult = await repo.stage(repoFile);

                // Then, the result will be successful and contain the staged file.
                expect(stageResult.succeeded).toBeTrue();
                expect(stageResult.value!.equals(repoFile)).toBeTrue();
            });


            it("fails when the specified file is not within the repo", async () => {
                // Given there are no modified files in a repository...
                const repoDir = new Directory(tmpDir, "repoDir");
                await repoDir.ensureExists();
                const repo = await GitRepo.clone(sampleRepoDir, repoDir);

                const nonexistentFile = new File(repo.directory, "xyzzy-xyzzy.json");

                // When we attempt to stage a nonexistent file...
                const stageResult = await repo.stage(nonexistentFile);

                // Then, the result will be successful and contain the staged file.
                expect(stageResult.failed).toBeTrue();
                expect(stageResult.error!.length).toBeGreaterThan(0);
            });
        });


        describe("pushCurrentBranch()", () => {

            // TODO:  Create unit tests.

            it("todo", () => {
                expect(true).toBeTruthy();
            });
        });


        describe("getCommitDeltas()", () => {

            // TODO:  Create unit tests.

            it("todo", () => {
                expect(true).toBeTruthy();
            });
        });


        describe("getStagedFiles()", () => {
            it("returns an empty array when nothing is staged", async () => {
                // Given there are no staged files in a repository...
                const repoDir = new Directory(tmpDir, "repoDir");
                await repoDir.ensureExists();
                const repo = await GitRepo.clone(sampleRepoDir, repoDir);

                // When we get the staged files...
                const result = await repo.getStagedFiles("repo");

                // Then the result will be successful and contain an empty array.
                expect(result.succeeded).toBeTrue();
                expect(result.value!.length).toEqual(0);
            });


            it("returns the expected staged files relative to the repo", async () => {
                // Given a repo has a staged file...
                const repoDir = new Directory(tmpDir, "repoDir");
                await repoDir.ensureExists();
                const repo = await GitRepo.clone(sampleRepoDir, repoDir);

                const stagedFile = new File(repo.directory, "package.json");
                stagedFile.writeSync("modified by unit test.");

                const stageResult = await repo.stage(stagedFile);
                expect(stageResult.succeeded).toBeTrue();

                // When we get the staged files...
                const getStagedFilesResult = await repo.getStagedFiles("repo");

                // Then the result will be successful and contain an empty array.
                expect(getStagedFilesResult.succeeded).toBeTrue();
                const stagedFiles = getStagedFilesResult.value!;
                expect(stagedFiles.length).toEqual(1);
                expect(stagedFiles[0]!.toString()).toEqual("package.json");
            });


            it("returns the expected staged files relative to the cwd", async () => {
                // Given a repo has a staged file...
                const repo = await GitRepo.clone(sampleRepoDir, tmpDir);

                const stagedFile = new File(repo.directory, "package.json");
                stagedFile.writeSync("modified by unit test.");

                const stageResult = await repo.stage(stagedFile);
                expect(stageResult.succeeded).toBeTrue();

                // When we get the staged files...
                const getStagedFilesResult = await repo.getStagedFiles("cwd");

                // Then the result will be successful and contain an empty array.
                expect(getStagedFilesResult.succeeded).toBeTrue();
                const stagedFiles = getStagedFilesResult.value!;
                expect(stagedFiles.length).toEqual(1);
                expect(stagedFiles[0]!.toString()).toEqual(path.join("tmp", "sampleGitRepo-src", "package.json"));
            });
        });



        describe("fetch()", () => {

            it("will fetch tags", async () => {
                // Create to identical clones of the sample repo.
                const dir1 = new Directory(tmpDir, "dir1");
                await dir1.ensureExists();
                const repo1 = await GitRepo.clone(sampleRepoDir, dir1);

                const dir2 = new Directory(tmpDir, "dir2");
                await dir2.ensureExists();
                const repo2 = await GitRepo.clone(sampleRepoDir, dir2);

                const tagName = "depot_unit_test_tag_" + generateUuid();

                // Create a new tag in repo1 and push it to origin.
                await repo1.createTag(tagName, "message");
                await repo1.pushTag(tagName, "origin");

                // In repo2, fetch.  You should now have the new tag.
                await repo2.fetch("origin", true);
                const tags = await repo2.tags();
                expect(_.includes(tags, tagName)).toEqual(true);

                // By default a normal "git fetch" will get the new tag, because
                // it points to an object that is downloaded.  So technically,
                // the fetchTags parameter only needs to be set when getting
                // tags that point to commits that would not normally be
                // downloaded.
            }, 1000 * 20);

        });


        describe("getLog()", () => {

            it("returns the expected entries", async () => {
                const repo = await GitRepo.clone(sampleRepoDir, tmpDir);

                const log = await repo.getLog();
                expect(log.length).toBeGreaterThan(0);

                expect(log[0]!.commitHash).toEqual("a5206775d3e67a4282a07f15f18eb44bca8d52c8");
                expect(log[0]!.author).toContain("kwpeters");
                expect(log[0]!.timestamp instanceof Date).toBeTruthy();
                expect(log[0]!.message).toBe("Initial commit");

                expect(log[1]!.commitHash).toEqual("bf60e95d83e63a807dfc072a90ba70d7c7597135");
                expect(log[1]!.author).toContain("kwpeters");
                expect(log[1]!.timestamp instanceof Date).toBeTruthy();
                expect(log[1]!.message).toBe("Created README.md.");

                expect(log[5]!.commitHash).toEqual("74a66ef9f2751b843b166d33a2f48c81d420fde2");
                expect(log[5]!.author).toContain("kwpeters");
                expect(log[5]!.timestamp instanceof Date).toBeTruthy();
                expect(log[5]!.message).toBe("A dummy checking done solely for\nthe purpose of making\na multi-line commit message.");
            });



        });


        describe("deleteBranch()", () => {
            beforeEach(() => {
                tmpDir.emptySync();
            });


            it("will delete a merged local branch when force is not set", async () => {
                const originRepo = await GitRepo.clone(sampleRepoDir, tmpDir, "origin", true);
                const workingRepo = await GitRepo.clone(originRepo.directory, tmpDir, "working");
                const mainBranch = (await workingRepo.getCurrentBranch())!;
                expect(mainBranch).toBeDefined();

                const uuid = generateUuid(UuidFormat.N);
                const branchName = `feature/${uuid}`;

                // Create a feature branch.
                const featureBranch = (await GitBranch.create(workingRepo, branchName)).value!;
                await workingRepo.checkoutBranch(featureBranch, true);

                // Add a file.
                const newFile = new File(workingRepo.directory, `${uuid}.txt`);
                newFile.writeSync(`This is new file ${newFile.baseName}`);
                await workingRepo.stageAll();
                await workingRepo.commit(`Added file ${newFile.baseName}.`);

                // Merge the feature branch into the main branch.
                await workingRepo.checkoutBranch(mainBranch, false);
                await workingRepo.merge(featureBranch);

                // Finally, delete the merged local branch.
                const deleteResult = await workingRepo.deleteBranch(featureBranch);
                expect(deleteResult.succeeded).toBeTrue();
            }, 1000 * 10);


            it("will not delete an unmerged local branch when force is not set", async () => {
                const originRepo = await GitRepo.clone(sampleRepoDir, tmpDir, "origin", true);
                const workingRepo = await GitRepo.clone(originRepo.directory, tmpDir, "working");
                const mainBranch = (await workingRepo.getCurrentBranch())!;
                expect(mainBranch).toBeDefined();

                const uuid = generateUuid(UuidFormat.N);
                const branchName = `feature/${uuid}`;

                // Create a feature branch.
                const featureBranch = (await GitBranch.create(workingRepo, branchName)).value!;
                await workingRepo.checkoutBranch(featureBranch, true);

                // Add a file.
                const newFile = new File(workingRepo.directory, `${uuid}.txt`);
                newFile.writeSync(`This is new file ${newFile.baseName}`);
                await workingRepo.stageAll();
                await workingRepo.commit(`Added file ${newFile.baseName}.`);

                await workingRepo.checkoutBranch(mainBranch, false);

                // Try to delete the unmerged local feature branch.
                const deleteResult = await workingRepo.deleteBranch(featureBranch);
                expect(deleteResult.failed).toBeTrue();
                expect(deleteResult.error).toContain("not fully merged");
            }, 1000 * 10);


            it("will delete an unmerged local branch when force is set", async () => {
                const originRepo = await GitRepo.clone(sampleRepoDir, tmpDir, "origin", true);
                const workingRepo = await GitRepo.clone(originRepo.directory, tmpDir, "working");
                const mainBranch = (await workingRepo.getCurrentBranch())!;
                expect(mainBranch).toBeDefined();

                const uuid = generateUuid(UuidFormat.N);
                const branchName = `feature/${uuid}`;

                // Create a feature branch.
                const featureBranch = (await GitBranch.create(workingRepo, branchName)).value!;
                await workingRepo.checkoutBranch(featureBranch, true);

                // Add a file.
                const newFile = new File(workingRepo.directory, `${uuid}.txt`);
                newFile.writeSync(`This is new file ${newFile.baseName}`);
                await workingRepo.stageAll();
                await workingRepo.commit(`Added file ${newFile.baseName}.`);

                await workingRepo.checkoutBranch(mainBranch, false);

                // Try to delete the unmerged local feature branch.
                const deleteResult = await workingRepo.deleteBranch(featureBranch, true);
                expect(deleteResult.succeeded).toBeTrue();
            }, 1000 * 10);



            it("will delete a merged remote branch when force is not set", async () => {
                const originRepo = await GitRepo.clone(sampleRepoDir, tmpDir, "origin", true);
                const workingRepo = await GitRepo.clone(originRepo.directory, tmpDir, "working");
                const mainBranch = (await workingRepo.getCurrentBranch())!;
                expect(mainBranch).toBeDefined();

                const uuid = generateUuid(UuidFormat.N);
                const branchName = `feature/${uuid}`;

                // Create a feature branch.
                const featureBranch = (await GitBranch.create(workingRepo, branchName)).value!;
                await workingRepo.checkoutBranch(featureBranch, true);

                // Add a file.
                const newFile = new File(workingRepo.directory, `${uuid}.txt`);
                newFile.writeSync(`This is new file ${newFile.baseName}`);
                await workingRepo.stageAll();
                await workingRepo.commit(`Added file ${newFile.baseName}.`);

                // Push the branch upstream and make the feature branch a tracking branch.
                await workingRepo.pushCurrentBranch(undefined, true);

                // Merge the feature branch into the main branch.
                await workingRepo.checkoutBranch(mainBranch, false);
                await workingRepo.merge(featureBranch);
                await workingRepo.pushCurrentBranch();

                // Finally, delete the remote branch.
                const remoteBranch = (await GitBranch.create(workingRepo, branchName, "origin")).value!;
                const deleteResult = await workingRepo.deleteBranch(remoteBranch, false);
                expect(deleteResult.succeeded).toBeTrue();
            }, 1000 * 20);


            //
            // Remote branches will always be forcibly deleted regardless of the
            // "forced" parameter.  Therefore, there is no unit test for the
            // scenario where deleteBranch() errors when the branch is unmerged
            // and force is false.
            //


            it("will delete an unmerged remote branch when force is not set", async () => {
                const originRepo = await GitRepo.clone(sampleRepoDir, tmpDir, "origin", true);
                const workingRepo = await GitRepo.clone(originRepo.directory, tmpDir, "working");
                const mainBranch = (await workingRepo.getCurrentBranch())!;
                expect(mainBranch).toBeDefined();

                const uuid = generateUuid(UuidFormat.N);
                const branchName = `feature/${uuid}`;

                // Create a feature branch.
                const featureBranch = (await GitBranch.create(workingRepo, branchName)).value!;
                await workingRepo.checkoutBranch(featureBranch, true);

                // Add a file.
                const newFile = new File(workingRepo.directory, `${uuid}.txt`);
                newFile.writeSync(`This is new file ${newFile.baseName}`);
                await workingRepo.stageAll();
                await workingRepo.commit(`Added file ${newFile.baseName}.`);

                // Push the branch upstream and make the feature branch a tracking branch.
                await workingRepo.pushCurrentBranch(undefined, true);

                // Leaving the branch unmerged.

                // Finally, delete the remote branch.
                const remoteBranch = (await GitBranch.create(workingRepo, branchName, "origin")).value!;
                const deleteResult = await workingRepo.deleteBranch(remoteBranch, false);
                expect(deleteResult.succeeded).toBeTrue();
            }, 1000 * 10);


            it("will invalidate the repository's cache of branches so a new list of branches will be retrieved", async () => {
                const originRepo = await GitRepo.clone(sampleRepoDir, tmpDir, "origin", true);
                const workingRepo = await GitRepo.clone(originRepo.directory, tmpDir, "working");
                const mainBranch = (await workingRepo.getCurrentBranch())!;
                expect(mainBranch).toBeDefined();

                const uuid = generateUuid(UuidFormat.N);
                const branchName = `feature/${uuid}`;

                // Create a feature branch.
                const featureBranch = (await GitBranch.create(workingRepo, branchName)).value!;
                await workingRepo.checkoutBranch(featureBranch, true);

                let branches = await workingRepo.getBranches(true);

                // Add a file.
                const newFile = new File(workingRepo.directory, `${uuid}.txt`);
                newFile.writeSync(`This is new file ${newFile.baseName}`);
                await workingRepo.stageAll();
                await workingRepo.commit(`Added file ${newFile.baseName}.`);

                // Merge the feature branch into the main branch.
                await workingRepo.checkoutBranch(mainBranch, false);
                await workingRepo.merge(featureBranch);

                // Finally, delete the merged local branch.
                const deleteResult = await workingRepo.deleteBranch(featureBranch);
                expect(deleteResult.succeeded).toBeTrue();

                // The branch should no longer appear in the list of branches.
                branches = await workingRepo.getBranches();
                const found = _.find(branches, (curBranch) => curBranch.equals(featureBranch));
                expect(found).toBeUndefined();
            }, 10 * 1000);
        });


        describe("getMergedBranches()", () => {
            beforeEach(() => {
                tmpDir.emptySync();
            });


            it("will find a local merged branch", async () => {
                const originRepo = await GitRepo.clone(sampleRepoDir, tmpDir, "origin", true);
                const workingRepo = await GitRepo.clone(originRepo.directory, tmpDir, "working");
                const mainBranch = (await workingRepo.getCurrentBranch())!;
                expect(mainBranch).toBeDefined();

                const uuid = generateUuid(UuidFormat.N);
                const branchName = `feature/${uuid}`;

                // Create a feature branch.
                const featureBranch = (await GitBranch.create(workingRepo, branchName)).value!;
                await workingRepo.checkoutBranch(featureBranch, true);

                // Add a file.
                const newFile = new File(workingRepo.directory, `${uuid}.txt`);
                newFile.writeSync(`This is new file ${newFile.baseName}`);
                await workingRepo.stageAll();
                await workingRepo.commit(`Added file ${newFile.baseName}.`);

                // Merge the feature branch into the main branch.
                await workingRepo.checkoutBranch(mainBranch, false);
                await workingRepo.merge(featureBranch);

                // Finally, get the merged local branches.
                const mergedBranchesResult = await workingRepo.getMergedBranches(undefined, true, false);
                expect(mergedBranchesResult.succeeded).toBeTrue();
                const foundFeatureBranch = _.find(
                    mergedBranchesResult.value,
                    (curBranch) => curBranch.name === branchName
                );
                expect(foundFeatureBranch).toBeDefined();
                expect(foundFeatureBranch?.isLocal()).toBeTrue();

            }, 1000 * 10);


            it("will find a remote merged branch", async () => {
                const originRepo = await GitRepo.clone(sampleRepoDir, tmpDir, "origin", true);
                const workingRepo = await GitRepo.clone(originRepo.directory, tmpDir, "working");
                const mainBranch = (await workingRepo.getCurrentBranch())!;
                expect(mainBranch).toBeDefined();

                const uuid = generateUuid(UuidFormat.N);
                const branchName = `feature/${uuid}`;

                // Create a feature branch.
                const featureBranch = (await GitBranch.create(workingRepo, branchName)).value!;
                await workingRepo.checkoutBranch(featureBranch, true);

                // Add a file.
                const newFile = new File(workingRepo.directory, `${uuid}.txt`);
                newFile.writeSync(`This is new file ${newFile.baseName}`);
                await workingRepo.stageAll();
                await workingRepo.commit(`Added file ${newFile.baseName}.`);

                // Push the branch upstream and make the feature branch a tracking branch.
                await workingRepo.pushCurrentBranch(undefined, true);

                // Merge the feature branch into the main branch.
                await workingRepo.checkoutBranch(mainBranch, false);
                await workingRepo.merge(featureBranch);
                await workingRepo.pushCurrentBranch();

                // Finally, get the merged remote branches.
                const mergedBranchesResult = await workingRepo.getMergedBranches(undefined, false, true);
                expect(mergedBranchesResult.succeeded).toBeTrue();
                const foundFeatureBranch = _.find(
                    mergedBranchesResult.value,
                    (curBranch) => curBranch.name === branchName
                );
                expect(foundFeatureBranch).toBeDefined();
                expect(foundFeatureBranch?.isRemote()).toBeTrue();

            }, 1000 * 10);


            it("will find a local and a remote merged branch", async () => {
                const originRepo = await GitRepo.clone(sampleRepoDir, tmpDir, "origin", true);
                const workingRepo = await GitRepo.clone(originRepo.directory, tmpDir, "working");
                const mainBranch = (await workingRepo.getCurrentBranch())!;
                expect(mainBranch).toBeDefined();

                const uuid = generateUuid(UuidFormat.N);
                const branchName = `feature/${uuid}`;

                // Create a feature branch.
                const featureBranch = (await GitBranch.create(workingRepo, branchName)).value!;
                await workingRepo.checkoutBranch(featureBranch, true);

                // Add a file.
                const newFile = new File(workingRepo.directory, `${uuid}.txt`);
                newFile.writeSync(`This is new file ${newFile.baseName}`);
                await workingRepo.stageAll();
                await workingRepo.commit(`Added file ${newFile.baseName}.`);

                // Push the branch upstream and make the feature branch a tracking branch.
                await workingRepo.pushCurrentBranch(undefined, true);

                // Merge the feature branch into the main branch.
                await workingRepo.checkoutBranch(mainBranch, false);
                await workingRepo.merge(featureBranch);
                await workingRepo.pushCurrentBranch();

                // Finally, get the merged remote branches.
                const mergedBranchesResult = await workingRepo.getMergedBranches(undefined, true, true);
                expect(mergedBranchesResult.succeeded).toBeTrue();
                const foundFeatureBranches = _.filter(
                    mergedBranchesResult.value,
                    (curBranch) => curBranch.name === branchName
                );
                expect(foundFeatureBranches.length).toEqual(2);

                const stringRepresentations = _.map(foundFeatureBranches, (curBranch) => curBranch.toString());
                expect(stringRepresentations).toContain(branchName);
                expect(stringRepresentations).toContain(`origin/${branchName}`);

            }, 1000 * 20);


            it("will find expected branches when the destination branch is not the current branch", async () => {
                const originRepo = await GitRepo.clone(sampleRepoDir, tmpDir, "origin", true);
                const workingRepo = await GitRepo.clone(originRepo.directory, tmpDir, "working");
                const mainBranch = (await workingRepo.getCurrentBranch())!;
                expect(mainBranch).toBeDefined();

                const uuid = generateUuid(UuidFormat.N);
                const branchName = `feature/${uuid}`;

                // Create a feature branch.
                const featureBranch = (await GitBranch.create(workingRepo, branchName)).value!;
                await workingRepo.checkoutBranch(featureBranch, true);

                // Add a file.
                const newFile = new File(workingRepo.directory, `${uuid}.txt`);
                newFile.writeSync(`This is new file ${newFile.baseName}`);
                await workingRepo.stageAll();
                await workingRepo.commit(`Added file ${newFile.baseName}.`);

                // Push the branch upstream and make the feature branch a tracking branch.
                await workingRepo.pushCurrentBranch(undefined, true);

                // Merge the feature branch into the main branch.
                await workingRepo.checkoutBranch(mainBranch, false);
                await workingRepo.merge(featureBranch);
                await workingRepo.pushCurrentBranch();

                // Checkout a completely unrelated branch.
                const bogusBranchName = `feature/${generateUuid(UuidFormat.N)}`;
                const bogusBranch = (await GitBranch.create(workingRepo, bogusBranchName)).value!;
                await workingRepo.checkoutBranch(bogusBranch, true);

                // Finally, get the merged remote branches.
                const mergedBranchesResult = await workingRepo.getMergedBranches(mainBranch, true, true);
                expect(mergedBranchesResult.succeeded).toBeTrue();
                const foundFeatureBranches = _.filter(
                    mergedBranchesResult.value,
                    (curBranch) => curBranch.name === branchName
                );
                expect(foundFeatureBranches.length).toEqual(2);

                const stringRepresentations = _.map(foundFeatureBranches, (curBranch) => curBranch.toString());
                expect(stringRepresentations).toContain(branchName);
                expect(stringRepresentations).toContain(`origin/${branchName}`);

            }, 1000 * 20);
        });

    });


});
