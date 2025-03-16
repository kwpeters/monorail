import { BitString8 } from "./bitstring.mjs";
import { UInt8 } from "./primitiveDataType.mjs";



describe("BitString8", () => {

    const bitfieldDefs = {
        "a": { type: "IBitfieldStartAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
        "b": { type: "IBitfieldBookends", lowBit: 3, highBit: 4 },      // bits 3, 4
        "c": { type: "IBitfieldBookends", lowBit: 5, highBit: 6 },      // bits 5, 6
        "d": { type: "IBitfieldStartAndSize", lowBit: 7, numBits: 1 },  // bit 7
    } as const;

    const val = UInt8.create(0b1_01_10_101).throwIfFailed();
    const bitstring8 = BitString8.create(val, bitfieldDefs).throwIfFailed();


    // describe("static", () => {
    // });


    describe("instance", () => {

        describe("getBitfield()", () => {

            it("returns the expected bitfield value", () => {
                expect(bitstring8.getBitfield("a")).toEqual(5);
                expect(bitstring8.getBitfield("b")).toEqual(2);
                expect(bitstring8.getBitfield("c")).toEqual(1);
                expect(bitstring8.getBitfield("d")).toEqual(1);
            });

        });

    });

});
