import { hashSync } from "./hash.mjs";


describe("hash()", () => {

    it("returns a non-empty string", () => {
        const hashVal = hashSync("foo");
        expect(hashVal.length).toBeGreaterThan(0);
    });


    it("when given an empty string, returns a non-empty string", () => {
        const hashVal = hashSync("");
        expect(hashVal.length).toBeGreaterThan(0);
    });


    it("returns the same hash for an equal string", () => {
        const hash1 = hashSync("foo");
        const hash2 = hashSync("foo");
        expect(hash1).toEqual(hash2);
    });


    it("returns different hashes for different strings", () => {
        const hash1 = hashSync("foo");
        const hash2 = hashSync("bar");
        expect(hash1).not.toEqual(hash2);
    });


    it("returns hexadecimal output when requested", () => {
        const hash1 = hashSync("foo", "hex");
        expect(hash1).toEqual("f7fbba6e0636f890e56fbbf3283e524c6fa3204ae298382d624741d0dc6638326e282c41be5e4254d8820772c5518a2c5a8c0c7f7eda19594a7eb539453e1ed7");
    });


    it("returns base64 output when requested", () => {
        const hash1 = hashSync("foo", "base64");
        expect(hash1).toEqual("9/u6bgY2+JDlb7vzKD5STG+jIErimDgtYkdB0NxmODJuKCxBvl5CVNiCB3LFUYosWowMf37aGVlKfrU5RT4e1w==");
    });

});
