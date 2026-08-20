import { ensureBinaryPrefix, ensureHexPrefix } from "./unsignedHexParsing.mjs";


describe("ensureHexPrefix()", () => {

    it("returns a string that already has 0x prefix unchanged", () => {
        expect(ensureHexPrefix("0x10")).toEqual("0x10");
        expect(ensureHexPrefix("0X10")).toEqual("0X10");
        expect(ensureHexPrefix("0xFFFFFFFFFFFFFFFF")).toEqual("0xFFFFFFFFFFFFFFFF");
    });


    it("inserts 0x prefix when absent", () => {
        expect(ensureHexPrefix("10")).toEqual("0x10");
        expect(ensureHexPrefix("ff")).toEqual("0xff");
        expect(ensureHexPrefix("FFFFFFFFFFFFFFFF")).toEqual("0xFFFFFFFFFFFFFFFF");
    });


    it("returns a negative string that already has 0x prefix unchanged", () => {
        expect(ensureHexPrefix("-0x10")).toEqual("-0x10");
        expect(ensureHexPrefix("-0X10")).toEqual("-0X10");
    });


    it("inserts 0x prefix after leading minus when absent", () => {
        expect(ensureHexPrefix("-10")).toEqual("-0x10");
        expect(ensureHexPrefix("-ff")).toEqual("-0xff");
    });

});


describe("ensureBinaryPrefix()", () => {

    it("returns a string that already has 0b prefix unchanged", () => {
        expect(ensureBinaryPrefix("0b1010")).toEqual("0b1010");
        expect(ensureBinaryPrefix("0B1010")).toEqual("0B1010");
    });


    it("inserts 0b prefix when absent", () => {
        expect(ensureBinaryPrefix("1010")).toEqual("0b1010");
        expect(ensureBinaryPrefix("11111111")).toEqual("0b11111111");
    });


    it("returns a negative string that already has 0b prefix unchanged", () => {
        expect(ensureBinaryPrefix("-0b1010")).toEqual("-0b1010");
        expect(ensureBinaryPrefix("-0B1010")).toEqual("-0B1010");
    });


    it("inserts 0b prefix after leading minus when absent", () => {
        expect(ensureBinaryPrefix("-1010")).toEqual("-0b1010");
        expect(ensureBinaryPrefix("-11111111")).toEqual("-0b11111111");
    });

});
