import { Directory } from "../../../packages/depot-node/src/directory.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { ConfidenceLevel } from "../src/datestampDeduction.js";
import { datestampStrategyFilePath } from "../src/datestampStrategy.js";


describe("datestampStrategyFilePath()", () => {

    function setup(): {tmpSrcDir: Directory, tmpDestDir: Directory} {
        return {
            tmpSrcDir:  new Directory(".", "tmp", "src"),
            tmpDestDir: new Directory(".", "tmp", "dest")
        };
    }


    it("when datestamp is not found, returns no confidence deduction", async () => {
        const context = setup();
        const tmpSrcFile = new File(context.tmpSrcDir, "foo_bar.txt");

        const deduction = await datestampStrategyFilePath(tmpSrcFile, context.tmpDestDir);
        expect(deduction.confidence).toEqual(ConfidenceLevel.NoClue);
    });


    it("when separator char is omitted, returns medium confidence deduction", async () => {
        const context = setup();
        const tmpSrcFile = new File(context.tmpSrcDir, "2012-0806.jpg");

        const deduction = await datestampStrategyFilePath(tmpSrcFile, context.tmpDestDir);
        expect(deduction.confidence).toEqual(ConfidenceLevel.Medium);
    });


    it("when dashed datestamp exists, returns medium confidence deduction", async () => {
        const context = setup();
        const tmpSrcFile = new File(context.tmpSrcDir, "2012-08-06.jpg");

        const deduction = await datestampStrategyFilePath(tmpSrcFile, context.tmpDestDir);
        expect(deduction.confidence).toEqual(ConfidenceLevel.Medium);
    });


    it("when underscored datestamp exists, returns medium confidence deduction", async () => {
        const context = setup();
        const tmpSrcFile = new File(context.tmpSrcDir, "2012_08_06.jpg");

        const deduction = await datestampStrategyFilePath(tmpSrcFile, context.tmpDestDir);
        expect(deduction.confidence).toEqual(ConfidenceLevel.Medium);
    });

});
