import { inspect } from "./inspect.mjs";

describe("inspect", () => {


    it("converts a number to the expected string", () => {
        expect(inspect(5)).toEqual("5");
    });


    it("converts a boolean to the expected string", () => {
        expect(inspect(false)).toEqual("false");
        expect(inspect(true)).toEqual("true");
    });


    it("converts a string to the expected string", () => {
        expect(inspect("hello")).toEqual('"hello"');
    });


    it("converts an object to the expected string", () => {
        expect(inspect({a: 1, b: 2})).toEqual("{ a: 1, b: 2 }");
    });

});
