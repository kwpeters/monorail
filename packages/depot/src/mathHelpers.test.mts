import { factorial } from "./mathHelpers.mjs";


describe("factorial()", () => {

    it("returns the expected value", () => {
        expect(factorial(0)).toEqual(1n);
        expect(factorial(1)).toEqual(1n);
        expect(factorial(2)).toEqual(2n);
        expect(factorial(3)).toEqual(6n);
        expect(factorial(4)).toEqual(24n);
        expect(factorial(5)).toEqual(120n);
        expect(factorial(6)).toEqual(720n);
        expect(factorial(7)).toEqual(5040n);
    });

    it("handles large values", () => {
        expect(factorial(10)).toEqual(3628800n);
        expect(factorial(20)).toEqual(2432902008176640000n);
        expect(factorial(30)).toEqual(265252859812191058636308480000000n);
    });

    it("throws error for negative numbers", () => {
        expect(() => factorial(-1)).toThrowError("Input must be non-negative.");
        expect(() => factorial(-5)).toThrowError("Input must be non-negative.");
    });

    it("throws error for non-integers", () => {
        expect(() => factorial(1.5)).toThrowError("Input must be an integer.");
        expect(() => factorial(3.14)).toThrowError("Input must be an integer.");
    });

});
