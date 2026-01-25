import { factorial, permutations } from "./mathHelpers.mjs";


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


describe("permutations()", () => {

    it("returns n! for all unique elements", () => {
        expect(permutations(0)).toEqual(1n);
        expect(permutations(1)).toEqual(1n);
        expect(permutations(2)).toEqual(2n);
        expect(permutations(3)).toEqual(6n);
        expect(permutations(4)).toEqual(24n);
    });

    it("calculates permutations with duplicates", () => {
        // 3 elements: 2 duplicates, 1 unique -> 3! / (2! * 1!) = 6 / 2 = 3
        expect(permutations(3, [2])).toEqual(3n);
        // 5 elements: 2 groups of 2 duplicates -> 5! / (2! * 2! * 1!) = 120 / 4 = 30
        expect(permutations(5, [2, 2])).toEqual(30n);
        // 4 elements: 3 duplicates, 1 unique -> 4! / (3! * 1!) = 24 / 6 = 4
        expect(permutations(4, [3])).toEqual(4n);
    });

    it("handles empty duplicate array", () => {
        expect(permutations(3, [])).toEqual(6n);
    });

    it("throws error for invalid n", () => {
        expect(() => permutations(-1)).toThrowError("n must be a non-negative integer.");
        expect(() => permutations(1.5)).toThrowError("n must be a non-negative integer.");
    });

    it("throws error for invalid duplicate counts", () => {
        expect(() => permutations(3, [1])).toThrowError("Each duplicate count must be an integer > 1.");
        expect(() => permutations(3, [2.5])).toThrowError("Each duplicate count must be an integer > 1.");
        expect(() => permutations(3, [4])).toThrowError("Invalid duplicate counts: sum exceeds n or negative uniques.");
    });

});
