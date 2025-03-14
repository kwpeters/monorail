import { setBitInNumber, setBitInBigInt } from "./bitstringHelpers.mjs";


describe("setBitInNumber()", () => {

    it("should set the bit at the specified index to 1", () => {
        expect(setBitInNumber(0, 0, true)).toBe(1);
        expect(setBitInNumber(0, 1, true)).toBe(2);
        expect(setBitInNumber(0, 2, true)).toBe(4);
    });

    it("should clear the bit at the specified index to 0", () => {
        expect(setBitInNumber(1, 0, false)).toBe(0);
        expect(setBitInNumber(2, 1, false)).toBe(0);
        expect(setBitInNumber(4, 2, false)).toBe(0);
    });

    it("should not change other bits when setting a bit", () => {
        expect(setBitInNumber(5, 1, true)).toBe(7); // 5 is 101 in binary, setting bit 1 makes it 111 which is 7
    });

    it("should not change other bits when clearing a bit", () => {
        expect(setBitInNumber(7, 1, false)).toBe(5); // 7 is 111 in binary, clearing bit 1 makes it 101 which is 5
    });

    it("should handle setting and clearing the same bit", () => {
        expect(setBitInNumber(0, 0, true)).toBe(1);
        expect(setBitInNumber(1, 0, false)).toBe(0);
    });
});


describe("setBitInBigInt()", () => {

    it("should set the bit at the specified index to 1", () => {
        expect(setBitInBigInt(0n, 0, true)).toBe(1n);
        expect(setBitInBigInt(0n, 1, true)).toBe(2n);
        expect(setBitInBigInt(0n, 2, true)).toBe(4n);
    });


    it("should clear the bit at the specified index to 0", () => {
        expect(setBitInBigInt(1n, 0, false)).toBe(0n);
        expect(setBitInBigInt(2n, 1, false)).toBe(0n);
        expect(setBitInBigInt(4n, 2, false)).toBe(0n);
    });


    it("should not change other bits when setting a bit", () => {
        expect(setBitInBigInt(5n, 1, true)).toBe(7n); // 5 is 101 in binary, setting bit 1 makes it 111 which is 7
    });


    it("should not change other bits when clearing a bit", () => {
        expect(setBitInBigInt(7n, 1, false)).toBe(5n); // 7 is 111 in binary, clearing bit 1 makes it 101 which is 5
    });


    it("should handle setting and clearing the same bit", () => {
        expect(setBitInBigInt(0n, 0, true)).toBe(1n);
        expect(setBitInBigInt(1n, 0, false)).toBe(0n);
    });
});
