import { TextBlock } from "./textBlock.mjs";
import { pipe } from "./pipe2.mjs";
import { NonNegativeInt } from "./primitiveDataType.mjs";


describe("TextBlock", () => {

    describe("static", () => {

        describe("fromLines()", () => {

            it("when given an empty array an empty TextBlock is returned", () => {
                const tb = pipe(
                    [],
                    TextBlock.fromLines
                );
                expect(tb.lines).toEqual([]);
            });


            it("uses the lines as specified when they don't contain any newline characters", () => {
                const tb = pipe(
                    ["line 1", "line 2", "line 3"],
                    TextBlock.fromLines
                );
                expect(tb.lines).toEqual(["line 1", "line 2", "line 3"]);
            });


            it("breaks lines apart when the lines contain newline characters", () => {
                const tb = pipe(
                    ["line 1", "line 2\nline 2.1", "line 3"],
                    TextBlock.fromLines
                );
                expect(tb.lines).toEqual(["line 1", "line 2", "line 2.1", "line 3"]);
            });

        });


        describe("fromString()", () => {

            it("when given an empty string an empty TextBlock is returned", () => {
                const tb = pipe(
                    "",
                    TextBlock.fromString
                );
                expect(tb.lines).toEqual([]);
            });


            it("uses the string as specified when it doesn't contain any newline characters", () => {
                const tb = pipe(
                    "line 1\nline 2\nline 3",
                    TextBlock.fromString
                );
                expect(tb.lines).toEqual(["line 1", "line 2", "line 3"]);
            });


            it("breaks lines apart when the string contains newline characters", () => {
                const tb = pipe(
                    "line 1\nline 2\nline 2.1\nline 3",
                    TextBlock.fromString
                );
                expect(tb.lines).toEqual(["line 1", "line 2", "line 2.1", "line 3"]);
            });

        });

    });


    describe("instance", () => {

        describe("numColumns", () => {

            it("returns 0 for an empty block", () => {
                const tb = TextBlock.fromLines([]);
                expect(tb.numColumns).toBe(0);
            });


            it("returns the maximum length of any line", () => {
                const tb = pipe(
                    ["123", "12", "123456"],
                    TextBlock.fromLines
                );
                expect(tb.numColumns).toBe(6);
            });

        });


        describe("numLines", () => {

            it("returns 0 for an empty TextBlock", () => {
                const tb = TextBlock.fromLines([]);
                expect(tb.numLines).toBe(0);
            });


            it("return the number of lines", () => {
                const tb = pipe(
                    ["line 1", "line 2\nline 3", "line 4"],
                    TextBlock.fromLines
                );
                expect(tb.numLines).toBe(4);
            });

        });


        describe("lines", () => {

            it("returns a copy of the lines", () => {
                const tb = pipe(
                    ["line 1", "line 2", "line 3"],
                    TextBlock.fromLines
                );
                expect(tb.lines).toEqual(["line 1", "line 2", "line 3"]);
            });
        });


        describe("toString()", () => {


            it("returns an empty string for an empty TextBlock", () => {
                const tb = TextBlock.fromLines([]);
                expect(tb.toString()).toBe("");
            });


            it("returns a string with the lines joined by newline characters", () => {
                const tb = pipe(
                    ["line 1", "line 2", "line 3"],
                    TextBlock.fromLines
                );
                expect(tb.toString()).toBe("line 1\nline 2\nline 3");
            });

        });


        describe("bottomJustify()", () => {

            it("does nothing when the specified number of lines is less than the current number of lines", () => {
                const tb = pipe(
                    ["line 1", "line 2", "line 3"],
                    TextBlock.fromLines,
                    (tb) => tb.bottomJustify(NonNegativeInt.create(2).throwIfFailed())
                );
                expect(tb.lines).toEqual(["line 1", "line 2", "line 3"]);
            });


            it("does nothing when the specified number of lines is equal to the current number of lines", () => {
                const tb = pipe(
                    ["line 1", "line 2", "line 3"],
                    TextBlock.fromLines,
                    (tb) => tb.bottomJustify(NonNegativeInt.create(3).throwIfFailed())
                );
                expect(tb.lines).toEqual(["line 1", "line 2", "line 3"]);
            });


            it("adds leading blank lines when needed", () => {
                const tb = pipe(
                    ["line 1", "line 2", "line 3"],
                    TextBlock.fromLines,
                    (tb) => tb.bottomJustify(NonNegativeInt.create(5).throwIfFailed())
                );
                expect(tb.lines).toEqual(["", "", "line 1", "line 2", "line 3"]);
            });
        });


        describe("topJustify()", () => {

            it("does nothing when the specified number of lines is less than the current number of lines", () => {
                const tb = pipe(
                    ["line 1", "line 2", "line 3"],
                    TextBlock.fromLines,
                    (tb) => tb.topJustify(NonNegativeInt.create(2).throwIfFailed())
                );
                expect(tb.lines).toEqual(["line 1", "line 2", "line 3"]);
            });


            it("does nothing when the specified number of lines is equal to the current number of lines", () => {
                const tb = pipe(
                    ["line 1", "line 2", "line 3"],
                    TextBlock.fromLines,
                    (tb) => tb.topJustify(NonNegativeInt.create(3).throwIfFailed())
                );
                expect(tb.lines).toEqual(["line 1", "line 2", "line 3"]);
            });


            it("adds trailing blank lines when needed", () => {
                const tb = pipe(
                    ["line 1", "line 2", "line 3"],
                    TextBlock.fromLines,
                    (tb) => tb.topJustify(NonNegativeInt.create(5).throwIfFailed())
                );
                expect(tb.lines).toEqual(["line 1", "line 2", "line 3", "", ""]);
            });
        });


        describe("prefixLines()", () => {


            it("returns an empty TextBlock when there are no lines", () => {
                const tb = pipe(
                    [],
                    TextBlock.fromLines,
                    (tb) => tb.prefixLines({ first: "first-", middle: "middle-", last: "last-" })
                );
                expect(tb.lines).toEqual([]);
            });


            it("uses only the first prefix when there is one line", () => {
                const tb = pipe(
                    ["line 1"],
                    TextBlock.fromLines,
                    (tb) => tb.prefixLines({ first: "first-", middle: "middle-", last: "last-" })
                );
                expect(tb.lines).toEqual(["first-line 1"]);
            });


            it("uses only the first and last prefixes when there are two lines", () => {
                const tb = pipe(
                    ["line 1", "line 2"],
                    TextBlock.fromLines,
                    (tb) => tb.prefixLines({ first: "first-", middle: "", last: "last-" })
                );
                expect(tb.lines).toEqual(["first-line 1", "last-line 2"]);
            });


            it("uses all three prefixes when there are three lines", () => {
                const tb = pipe(
                    ["line 1", "line 2", "line 3"],
                    TextBlock.fromLines,
                    (tb) => tb.prefixLines({ first: "first-", middle: "middle-", last: "last-" })
                );
                expect(tb.lines).toEqual(["first-line 1", "middle-line 2", "last-line 3"]);
            });

        });

    });

});
