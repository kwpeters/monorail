import { File } from "../../../packages/depot-node/src/file.js"
import { isDuplicateFile, isSimilarFileName } from "../src/fixCommand.js";
import { tmpDir } from "./specHelpers.js";


describe("isDuplicateFile()", () => {


    it("returns false whhen the files are not named similarly", async () => {
        const fileData = "identical data";
        const file1 = new File(tmpDir, "file1.txt");
        file1.writeSync(fileData);
        const file2 = new File(tmpDir, "file2.txt");
        file2.writeSync(fileData);

        expect((await isDuplicateFile(file1, file2))).toBeFalse();
    });


    it("returns false when the files have different sizes", async () => {
        const fileData1 = "hello world";
        const fileData2 = "hello world!";

        const file1 = new File(tmpDir, "file.txt");
        file1.writeSync(fileData1);
        const file2 = new File(tmpDir, "file_1.txt");
        file2.writeSync(fileData2);

        expect((await isDuplicateFile(file1, file2))).toBeFalse();
    });


    it("returns false when the files have same size but different content", async () => {
        const fileData1 = "data 1";
        const fileData2 = "data 2";

        const file1 = new File(tmpDir, "file.txt");
        file1.writeSync(fileData1);
        const file2 = new File(tmpDir, "file_1.txt");
        file2.writeSync(fileData2);

        expect((await isDuplicateFile(file1, file2))).toBeFalse();
    });


    it("returns true when the files are named similarly, have the same size and have the same content", async () => {
        const fileData = "identical data";
        const file1 = new File(tmpDir, "file.txt");
        file1.writeSync(fileData);
        const file2 = new File(tmpDir, "file_1.txt");
        file2.writeSync(fileData);

        expect((await isDuplicateFile(file1, file2))).toBeTrue();
    });


    it("returns true when files are duplicates regardless of the order they are specified", async () => {
        const fileData = "identical data";
        const file1 = new File(tmpDir, "file.txt");
        file1.writeSync(fileData);
        const file2 = new File(tmpDir, "file_1.txt");
        file2.writeSync(fileData);

        expect((await isDuplicateFile(file1, file2))).toBeTrue();
        expect((await isDuplicateFile(file2, file1))).toBeTrue();
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
