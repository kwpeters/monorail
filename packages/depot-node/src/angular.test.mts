import path from "node:path";
import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";
import { findAngularProjectDirs } from "./angular.mjs";
import {tmpDir} from "./specHelpers.test.mjs";


function createAngularConfigFile(dir: Directory): File {
    const projectFile = new File(dir, "angular.json");
    projectFile.writeSync("Phony Angular config file for purposes of unit tests");
    return projectFile;
}


describe("findAngularProjectDirs()", () => {
    beforeEach(() => {
        tmpDir.emptySync();
    });


    it("returns an empty array when no Angular projects exist", async () => {
        const projectDirs = await findAngularProjectDirs(tmpDir);
        expect(projectDirs.length).toEqual(0);
    });


    it("finds an Angular project in the specified root directory", async () => {
        createAngularConfigFile(tmpDir);

        const projectDirs = await findAngularProjectDirs(tmpDir);
        expect(projectDirs.length).toEqual(1);
        expect(projectDirs[0]!.toString()).toEqual(tmpDir.toString());
    });


    it("finds an Angular project in a subdirectory", async () => {
        const __dir1 = await new Directory(tmpDir, "dir1").ensureExists();
        const dir2 = await new Directory(tmpDir, "dir2").ensureExists();
        createAngularConfigFile(dir2);

        const projectDirs = await findAngularProjectDirs(tmpDir);
        expect(projectDirs.length).toEqual(1);
        expect(projectDirs[0]!.toString()).toEqual(path.join("tmp", "dir2"));
    });


    it("finds multiple Angular projects in subdirectories", async () => {
        const __dir1 = await new Directory(tmpDir, "dir1").ensureExists();
        const dir2 = await new Directory(tmpDir, "dir2").ensureExists();
        const dir3 = await new Directory(tmpDir, "dir3").ensureExists();
        createAngularConfigFile(dir2);
        createAngularConfigFile(dir3);

        const projectDirs = await findAngularProjectDirs(tmpDir);
        expect(projectDirs.length).toEqual(2);
        expect(projectDirs).toContain(dir2);
        expect(projectDirs).toContain(dir3);
    });
});
