import {createReadStream} from "fs";
import {File} from "../src/file.js";
import {readableStreamToText} from "../src/streamHelpers.js";
import {tmpDir} from "./specHelpers.js";


describe("readableStreamToText()", () => {

    it("will resolve with the text in the readable stream", async () => {
        const inputFile = new File(tmpDir, "inputFile.txt");
        inputFile.writeSync("hello xyzzy");
        const theStream = createReadStream(inputFile.toString());

        const text = await readableStreamToText(theStream);
        expect(text).toEqual("hello xyzzy");
    });


});
