import * as path from "node:path";
import * as pathHelpers from "./pathHelpers.mjs";
import { Directory } from "./directory.mjs";
import { getOs } from "./os.mjs";


describe("reducePathParts()", () => {

    it("should join the path parts", () => {
        const resultPath: string = pathHelpers.reducePathParts(["foo", "bar", "baz.txt"]);
        expect(resultPath).toEqual(path.join("foo", "bar", "baz.txt"));
    });


    it("will discard items preceding any Directory object", () => {
        const result: string = pathHelpers.reducePathParts(
            [
                "foo",
                new Directory("bar"),
                "baz.txt"
            ]
        );
        expect(result).toEqual(path.join("bar", "baz.txt"));
    });


    it("discards items preceding a string that starts with a Windows drive letter", () => {
        // This test is only relevant on Windows.
        if (getOs() !== "windows") {
            return;
        }

        const result: string = pathHelpers.reducePathParts(
            [
                "foo",
                "C:\\bar",
                "baz.txt"
            ]
        );
        expect(result).toEqual(path.join("C:", "bar", "baz.txt"));
    });


    it("discards items preceding a string that is an absolute path", () => {
        const result: string = pathHelpers.reducePathParts(
            [
                "foo",
                `${path.sep}bar${path.sep}baz.txt`
            ]
        );
        expect(result).toEqual(path.sep + path.join("bar", "baz.txt"));
    });


});
