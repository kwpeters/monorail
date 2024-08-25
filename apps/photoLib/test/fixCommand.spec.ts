import { File } from "../../../packages/depot-node/src/file.js";
import { NoneOption } from "../../../packages/depot/src/option.js";
import { getDuplicateFiles, isDuplicateFile, isSimilarFileName } from "../src/fixCommandDeleteDuplicates.js";
import { tmpDir } from "./specHelpers.js";


describe("getDuplicateFiles()", () => {

    const fileA1 = new File(tmpDir, "file_a.txt");
    const fileA2 = new File(tmpDir, "file_a_1.txt");
    const fileA3 = new File(tmpDir, "file_a_2.txt");
    const fileA4 = new File(tmpDir, "file_a_3.txt");
    const fileB = new File(tmpDir, "file_b.txt");

    beforeAll(async () => {
        tmpDir.emptySync();

        await Promise.all([
            fileA1.write("hello 1"),
            fileA2.write("hello 1"),    // Duplicate of file A1
            fileA3.write("hello 1"),    // Duplicate of file A1
            fileA4.write("hello 10"),   // Different size -> not a duplicate
            fileB.write("hello")        // Different name, size -> not a duplicate
        ]);
    });

    it("finds duplicates", async () => {
        const duplicateFiles = await getDuplicateFiles((tmpDir));
        expect(duplicateFiles.length).toEqual(2);
        expect(duplicateFiles.some((dupeInfo) => dupeInfo.duplicateFile.fileName === "file_a_1.txt")).toBeTrue();
        expect(duplicateFiles.some((dupeInfo) => dupeInfo.duplicateFile.fileName === "file_a_2.txt")).toBeTrue();
    });
});


describe("isDuplicateFile()", () => {


    it("returns None when the files are not named similarly", async () => {
        const fileData = "identical data";
        const file1 = new File(tmpDir, "file1.txt");
        file1.writeSync(fileData);
        const file2 = new File(tmpDir, "file2.txt");
        file2.writeSync(fileData);

        expect((await isDuplicateFile(file1, file2))).toEqual(NoneOption.get());
    });


    it("returns None when the duplicate is specified as the reference file", async () => {
        const fileData = "identical data";
        const file1 = new File(tmpDir, "file.txt");
        file1.writeSync(fileData);
        const file2 = new File(tmpDir, "file_1.txt");
        file2.writeSync(fileData);

        expect((await isDuplicateFile(file2, file1))).toEqual(NoneOption.get());
    });


    it("returns None when the files have different sizes", async () => {
        const fileData1 = "hello world";
        const fileData2 = "hello world!";

        const file1 = new File(tmpDir, "file.txt");
        file1.writeSync(fileData1);
        const file2 = new File(tmpDir, "file_1.txt");
        file2.writeSync(fileData2);

        expect((await isDuplicateFile(file1, file2))).toEqual(NoneOption.get());
    });


    it("returns None when the files have same size but different content", async () => {
        const fileData1 = "data 1";
        const fileData2 = "data 2";

        const file1 = new File(tmpDir, "file.txt");
        file1.writeSync(fileData1);
        const file2 = new File(tmpDir, "file_1.txt");
        file2.writeSync(fileData2);

        expect((await isDuplicateFile(file1, file2))).toEqual(NoneOption.get());
    });


    it("returns Some when the files are named similarly, have the same size and have the same content", async () => {
        const fileData = "identical data";
        const file1 = new File(tmpDir, "file.txt");
        file1.writeSync(fileData);
        const file2 = new File(tmpDir, "file_1.txt");
        file2.writeSync(fileData);

        const dupeInfoOpt = await isDuplicateFile(file1, file2);
        expect(dupeInfoOpt.isSome).toBeTrue();
    });

});


describe("isSimilarFileName()", () => {

    it("returns false when the file names are completely different", () => {
        const file1 = new File("foo/bar/foo.jpg");
        const file2 = new File("foo/bar/bar.jpg");
        expect(isSimilarFileName(file1, file2)).toBeFalse();
    });


    it("returns false when the file names are similar but don't fit the _n pattern", () => {
        const file1 = new File("foo/bar/foo.jpg");
        const file2 = new File("foo/bar/foo1.jpg");
        expect(isSimilarFileName(file1, file2)).toBeFalse();
    });


    it("returns true when there is _1 appended to one of the base names", () => {
        const file1 = new File("foo/bar/baz.jpg");
        const file2 = new File("foo/bar/baz_1.jpg");

        expect(isSimilarFileName(file1, file2)).toBeTrue();
    });


    it("returns true when there is _21 appended to one of the base names", () => {
        const file1 = new File("foo/bar/baz.jpg");
        const file2 = new File("quux/bar/baz_21.jpg");

        expect(isSimilarFileName(file1, file2)).toBeTrue();
    });

});
