import {createReadStream} from "node:fs";
import {File} from "./file.mjs";
import {readableStreamToText} from "./streamHelpers.mjs";
import {tmpDir} from "./specHelpers.test.mjs";


describe("readableStreamToText()", () => {

    it("will resolve with the text in the readable stream", async () => {
        const inputFile = new File(tmpDir, "inputFile.txt");
        inputFile.writeSync("hello xyzzy");
        const theStream = createReadStream(inputFile.toString());

        const text = await readableStreamToText(theStream);
        expect(text).toEqual("hello xyzzy");
    });


});
