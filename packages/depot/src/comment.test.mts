import { comment, uncomment, toggleComment } from "./comment.mjs";
import {splitIntoLines} from "./stringHelpers.mjs";


describe("comment()", () => {

    it("will return undefined when given an empty string", () => {
        expect(comment("")).toEqual(undefined);
    });


    it("will return undefined when given a single line of whitespace", () => {
        expect(comment("  \t  ")).toEqual(undefined);
    });


    it("will return undefined when given multiple lines of whitespace", () => {
        const text = [
            "",
            "    \t",
            "\t\t",
            "        ",
            "",
            "",
            ""
        ];
        const result = comment(text.join("\n"));
        expect(result).toEqual(undefined);
    });


    it("will place a comment token at the beginning when there is no indentation", () => {
        expect(comment("xyzzy")).toEqual("// xyzzy");
    });


    it("will place a comment token between initial whitespace and non-whitespace when there is indentation", () => {
        expect(comment("    xyzzy")).toEqual("    // xyzzy");
    });


    it("will place the comment token at the same place on all lines",  () => {
        const text = [
            "",
            "        one",
            "",
            "    two",
            "",
            "            three",
            ""
        ];
        const result = comment(text.join("\n"));
        const resultLines = splitIntoLines(result!);
        expect(resultLines).toEqual([
            "    //",
            "    //     one",
            "    //",
            "    // two",
            "    //",
            "    //         three",
            "    //"
        ]);
    });


    it("will comment source that already has a comment in it (single line)", () => {
        expect(comment("    // xyzzy")).toEqual("    // // xyzzy");
    });


    it("will comment source that already has a comment in it (multi line)", () => {
        const text = [
            "",
            "        one",
            "",
            "    two",
            "",
            "            // three",
            ""
        ];
        const result = comment(text.join("\n"));
        const resultLines = splitIntoLines(result!);
        expect(resultLines).toEqual([
            "    //",
            "    //     one",
            "    //",
            "    // two",
            "    //",
            "    //         // three",
            "    //"
        ]);
    });


    it("will comment a single line of code, matching the comment that precedes it.", () => {
        const text = [
            "    // Preceding line",
            "        will be commented"
        ];
        const precedingLine: string = text.shift()!;
        const resultLines = splitIntoLines(comment(text.join("\n"), precedingLine)!);
        expect(resultLines).toEqual(
            [
                "    //     will be commented"
            ]
        );
    });


    it("will continue a comment onto an empty line", () => {
        const text = [
            "    // Preceding line",
            ""
        ];
        const precedingLine: string = text.shift()!;
        const resultLines = splitIntoLines(comment(text.join("\n"), precedingLine)!);
        expect(resultLines).toEqual(
            [
                "    //"
            ]
        );
    });


    it("will indent appropriately when preceding line has no comment", () => {
        const text = [
            "    {",
            "        codeToBeCommented();"
        ];

        const precedingLine: string = text.shift()!;
        const resultLines = splitIntoLines(comment(text.join("\n"), precedingLine)!);
        expect(resultLines).toEqual([
            "        // codeToBeCommented();"
        ]);
    });


});


describe("uncomment()", () => {

    it("returns undefined when given an empty string", () => {
        expect(uncomment("")).toEqual(undefined);
    });


    it("returns undefined when given a single line of whitespace", () => {
        expect(uncomment("  \t  ")).toEqual(undefined);
    });


    it("returns undefined when given multiple lines of whitespace", () => {
        expect(uncomment("\t\n    \n  \t  \n")).toEqual(undefined);
    });


    it("will remove the comment token when there is no indentation", () => {
        expect(uncomment("// xyzzy")).toEqual("xyzzy");
    });


    it("will remove the comment token when there is indentation", () => {
        expect(uncomment("    // xyzzy")).toEqual("    xyzzy");
    });


    it("will remove the comment token when it appears in different columns", () => {
        const orig = [
            "    // foo",
            "        // bar",
            "            // baz"
        ];

        const result = splitIntoLines(uncomment(orig.join("\n"))!);
        expect(result).toEqual([
            "    foo",
            "        bar",
            "            baz"
        ]);

    });


    it("will remove the commenting appropriately when the code is indented different amounts", () => {

        const orig = [
            "// let a = 5;",
            "//",
            "// if (true) {",
            "//     a = 8;",
            "// }",
            "//",
            "// // A dummy comment.",
            "// const b = 3;",
            "// const c = 7;",
            "// return a + b + c;",
        ];
        const result = splitIntoLines(uncomment(orig.join("\n"))!);
        expect(result).toEqual([
            "let a = 5;",
            "",
            "if (true) {",
            "    a = 8;",
            "}",
            "",
            "// A dummy comment.",
            "const b = 3;",
            "const c = 7;",
            "return a + b + c;",
        ]);



    });


});


describe("toggleComment()", () => {

    it("returns undefined when there is nothing to comment or uncomment", () => {
        expect(toggleComment("")).toEqual(undefined);
    });


    it("will comment out code that is not commented", () => {
        const orig = [
            "    // preceding",
            "        blah",
            "        blah",
            "        blah"
        ];
        const precedingLine = orig.shift();

        const result = toggleComment(orig.join("\n"), precedingLine);
        expect(result).toBeDefined();
        expect(splitIntoLines(result!)).toEqual([
            "    //     blah",
            "    //     blah",
            "    //     blah"
        ]);

    });


    it("will uncomment code that is commented", () => {
        const orig = [
            "    //     blah",
            "    //     blah",
            "    //     blah"
        ];

        const result = toggleComment(orig.join("\n"));
        expect(result).toBeDefined();
        expect(splitIntoLines(result!)).toEqual([
            "        blah",
            "        blah",
            "        blah"
        ]);
    });


});
