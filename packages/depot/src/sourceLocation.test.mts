import { SomeOption, NoneOption } from "./option.mjs";
import { sourceLocation } from "./sourceLocation.mjs";


describe("sourceLocation()", () => {

    it("returns an empty string when nothing is specified", () => {
        const opt = sourceLocation(
            NoneOption.get(),
            NoneOption.get(),
            NoneOption.get()
        );
        expect(opt.isNone).toBeTrue();
    });


    it("when column is not specified, it is not included", () => {
        const opt = sourceLocation(
            new SomeOption("foo/bar.ts"),
            new SomeOption(10),
            NoneOption.get()
        );
        expect(opt.isSome).toBeTrue();
        expect(opt.value).toEqual("foo/bar.ts:10");
    });


    it("when line is not specified, line and column are not included", () => {
        const opt = sourceLocation(
            new SomeOption("foo/bar.ts"),
            NoneOption.get(),
            new SomeOption(5)
        );
        expect(opt.isSome).toBeTrue();
        expect(opt.value).toEqual("foo/bar.ts");
    });


    it("when file is not specified while line and col are, only line and col are included", () => {
        const opt = sourceLocation(
            NoneOption.get(),
            new SomeOption(10),
            new SomeOption(5)
        );
        expect(opt.isSome).toBeTrue();
        expect(opt.value).toEqual("10:5");
    });

    it("when only line is specified, only it is included", () => {
        const opt = sourceLocation(
            NoneOption.get(),
            new SomeOption(10),
            NoneOption.get()
        );
        expect(opt.isSome).toBeTrue();
        expect(opt.value).toEqual("10");
    });


    it("when only column is specified, an empty string is returned", () => {
        const opt = sourceLocation(
            NoneOption.get(),
            NoneOption.get(),
            new SomeOption(5)
        );
        expect(opt.isNone).toBeTrue();
    });


    it("when all three elements provided returns the expected string", () => {
        const opt = sourceLocation(
            new SomeOption("foo/bar.ts"), new SomeOption(10), new SomeOption(5)
        );
        expect(opt.isSome).toBeTrue();
        expect(opt.value).toEqual("foo/bar.ts:10:5");
    });

});
