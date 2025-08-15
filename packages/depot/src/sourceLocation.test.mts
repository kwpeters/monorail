import { SomeOption, NoneOption } from "./option.mjs";
import { offsetToLineColumn, SourceLocation } from "./sourceLocation.mjs";


describe("offsetToLineColumn()", () => {

    it("when offset is 0 returns line 1 column 1", () => {
        const res = offsetToLineColumn("text", 0);
        expect(res).toEqual({ line: 1, column: 1 });
    });


    it("when offset is somewhere in the first line returns line 1 column offset+1", () => {
        const res = offsetToLineColumn("one hen, two ducks", 5);
        expect(res).toEqual({ line: 1, column: 6 });
    });


    it("when offset is somewhere other than the first line", () => {
        const res = offsetToLineColumn("01234\n6789a", 8);
        expect(res).toEqual({ line: 2, column: 3 });
    });

});


describe("SourceLocation", () => {

    describe("instance", () => {

        describe("startToString()", () => {

            it("when no parts are specified returns a failure", () => {
                const loc = new SourceLocation(
                    NoneOption.get(),
                    {line: Number.NaN, column: NoneOption.get()}
                );
                expect(loc.startToString().failed).toBeTrue();
            });


            it("when column is not specified it is not included", () => {
                const loc = new SourceLocation(
                    new SomeOption("foo/bar.ts"),
                    {line: 10, column: NoneOption.get()}
                );
                const res = loc.startToString();
                expect(res.succeeded).toBeTrue();
                expect(res.value).toEqual("foo/bar.ts:10");
            });


            it("when line is not specified, line and column are not included", () => {
                const loc = new SourceLocation(
                    new SomeOption("foo/bar.ts"),
                    {line: Number.NaN, column: new SomeOption(5)}
                );
                const res = loc.startToString();
                expect(res.succeeded).toBeTrue();
                expect(res.value).toEqual("foo/bar.ts");
            });


            it("when file is not specified while line and col are, only line and col are included", () => {
                const loc = new SourceLocation(
                    NoneOption.get(),
                    {line: 10, column: new SomeOption(5)}
                );
                const res = loc.startToString();
                expect(res.succeeded).toBeTrue();
                expect(res.value).toEqual("10:5");
            });


            it("when only line is specified, only it is included", () => {
                const loc = new SourceLocation(
                    NoneOption.get(),
                    {line: 10, column: NoneOption.get()}
                );
                const res = loc.startToString();
                expect(res.succeeded).toBeTrue();
                expect(res.value).toEqual("10");
            });


            it("when only column is specified returns a failure", () => {
                const loc = new SourceLocation(
                    NoneOption.get(),
                    {line: Number.NaN, column: new SomeOption(5)}
                );
                const res = loc.startToString();
                expect(res.failed).toBeTrue();
            });


            it("when all three elements provided returns the expected string", () => {
                const loc = new SourceLocation(
                    new SomeOption("foo/bar.ts"),
                    {line: 10, column: new SomeOption(5)}
                );
                const res = loc.startToString();
                expect(res.succeeded).toBeTrue();
                expect(res.value).toEqual("foo/bar.ts:10:5");
            });

        });


        describe("codeFrame", () => {

            it("when everything is specified, everything is included", () => {
                const loc = new SourceLocation(
                    new SomeOption("foo/bar.ts"),
                    {line: 10, column: new SomeOption(5)},
                    {line: 12, column: new SomeOption(6)}
                );

                expect(loc.codeFrame).toEqual({
                    start: {line: 10, column: 5},
                    end:   {line: 12, column: 6}
                });
            });


            it("when end is not specified, it is undefined", () => {
                const loc = new SourceLocation(
                    new SomeOption("foo/bar.ts"),
                    {line: 10, column: new SomeOption(5)}
                );

                expect(loc.codeFrame).toEqual({
                    start: {line: 10, column: 5},
                    end:   undefined
                });
            });


            it("when only start line is specified, column is undefined", () => {
                const loc = new SourceLocation(
                    new SomeOption("foo/bar.ts"),
                    {line: 10, column: NoneOption.get()}
                );

                expect(loc.codeFrame).toEqual({
                    start: {line: 10, column: undefined},
                    end:   undefined
                });
            });


            it("when only end line is specified, column is undefined", () => {
                const loc = new SourceLocation(
                    new SomeOption("foo/bar.ts"),
                    {line: 10, column: new SomeOption(5)},
                    {line: 12, column: NoneOption.get()}
                );

                expect(loc.codeFrame).toEqual({
                    start: {line: 10, column: 5},
                    end:   {line: 12, column: undefined}
                });
            });

        });

    });

});
