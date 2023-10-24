import { File } from "../src/file.js";
import { isExtantFile, isNotExtantFile } from "../src/fileValidatorFns.js";
import { tmpDir } from "./specHelpers.js";


describe("isExtantFile()", () => {

    beforeEach(() => {
        tmpDir.emptySync();
    });


    it("returns true when the subject exists", async () => {
        const extantFile = new File(tmpDir, "extantFile.txt");
        extantFile.writeSync("text");

        expect(await isExtantFile(extantFile)).toEqual(true);
    });


    it("returns false when the subject does not exist", async () => {
        const nonExtantFile = new File(tmpDir, "nonExtantFile.txt");

        expect(await isExtantFile(nonExtantFile)).toEqual(false);
    });

});


describe("isNotExtantFile()", () => {

    beforeEach(() => {
        tmpDir.emptySync();
    });


    it("returns true when the subject does not exist", async () => {
        const nonExtantFile = new File(tmpDir, "nonExtantFile.txt");

        expect(await isNotExtantFile(nonExtantFile)).toEqual(true);
    });


    it("return false when the subject does exist", async () => {
        const extantFile = new File(tmpDir, "extantFile.txt");
        extantFile.writeSync("text");

        expect(await isNotExtantFile(extantFile)).toEqual(false);

    });

});
