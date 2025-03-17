import { BitString8 } from "./bitstring.mjs";
import { UInt8 } from "./primitiveDataType.mjs";



describe("BitString8", () => {

    describe("static", () => {

        describe("create()", () => {

            it("fails when a bitfield definition contains a fractional low bit", () => {
                const bitfieldDefs = {
                    "a": { type: "IBitfieldStartAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "IBitfieldBookends", lowBit: 3.5, highBit: 4 },    // bits 3, 4
                } as const;

                const val = UInt8.create(0b1_01_10_101).throwIfFailed();
                const res = BitString8.create(val, bitfieldDefs);

                expect(res.failed).toBe(true);
            });


            it("fails when a bitfield definition contains a fractional high bit", () => {
                const bitfieldDefs = {
                    "a": { type: "IBitfieldStartAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "IBitfieldBookends", lowBit: 3, highBit: 4.5 },    // bits 3, 4
                } as const;

                const val = UInt8.create(0b1_01_10_101).throwIfFailed();
                const res = BitString8.create(val, bitfieldDefs);

                expect(res.failed).toBe(true);
            });


            it("fails when a bitfield definition contains a low bit that is less than zero", () => {
                const bitfieldDefs = {
                    "a": { type: "IBitfieldStartAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "IBitfieldBookends", lowBit: -1, highBit: 4 },     // bits 3, 4
                } as const;

                const val = UInt8.create(0b1_01_10_101).throwIfFailed();
                const res = BitString8.create(val, bitfieldDefs);

                expect(res.failed).toBe(true);
            });


            it("fails when a bitfield definition contains a high bit that is greater than the highest bit number supported by the data type", () => {
                const bitfieldDefs = {
                    "a": { type: "IBitfieldStartAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "IBitfieldBookends", lowBit: 3, highBit: 8 },      // bits 3, 4
                } as const;

                const val = UInt8.create(0b1_01_10_101).throwIfFailed();
                const res = BitString8.create(val, bitfieldDefs);

                expect(res.failed).toBe(true);
            });


            it("fails when a bitfield definition contains a low bit that is greater than the high bit", () => {
                const bitfieldDefs = {
                    "a": { type: "IBitfieldStartAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "IBitfieldBookends", lowBit: 5, highBit: 4 },      // bits 3, 4
                } as const;

                const val = UInt8.create(0b1_01_10_101).throwIfFailed();
                const res = BitString8.create(val, bitfieldDefs);

                expect(res.failed).toBe(true);
            });

            it("fails when the bitfield definitions overlap", () => {
                const bitfieldDefs = {
                    "a": { type: "IBitfieldStartAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "IBitfieldBookends", lowBit: 2, highBit: 4 },      // bits 3, 4
                } as const;

                const val = UInt8.create(0b1_01_10_101).throwIfFailed();
                const res = BitString8.create(val, bitfieldDefs);

                expect(res.failed).toBe(true);
            });


            it("succeeds when all bitfield definitions are valid", () => {
                const bitfieldDefs = {
                    "a": { type: "IBitfieldStartAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "IBitfieldBookends", lowBit: 3, highBit: 4 },      // bits 3, 4
                } as const;

                const val = UInt8.create(0b000_10_101).throwIfFailed();
                const res = BitString8.create(val, bitfieldDefs);

                expect(res.succeeded).toBe(true);
            });
        });

    });


    describe("instance", () => {

        describe("asUInt8", () => {

            it("returns the wrapped value", () => {
                const bitfieldDefs = {
                    "a": { type: "IBitfieldStartAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "IBitfieldBookends", lowBit: 3, highBit: 4 },      // bits 3, 4
                } as const;

                const val = UInt8.create(0b1_01_10_101).throwIfFailed();
                const bitstring8 = BitString8.create(val, bitfieldDefs).throwIfFailed();

                expect(bitstring8.asUInt8().value).toEqual(val.value);
            });

        });


        describe("getBitfield()", () => {

            it("returns the expected bitfield value", () => {
                const bitfieldDefs = {
                    "a": { type: "IBitfieldStartAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "IBitfieldBookends", lowBit: 3, highBit: 4 },      // bits 3, 4
                    "c": { type: "IBitfieldBookends", lowBit: 5, highBit: 6 },      // bits 5, 6
                    "d": { type: "IBitfieldStartAndSize", lowBit: 7, numBits: 1 },  // bit 7
                } as const;

                const val = UInt8.create(0b1_01_10_101).throwIfFailed();
                const bitstring8 = BitString8.create(val, bitfieldDefs).throwIfFailed();

                expect(bitstring8.getBitfield("a")).toEqual(5);
                expect(bitstring8.getBitfield("b")).toEqual(2);
                expect(bitstring8.getBitfield("c")).toEqual(1);
                expect(bitstring8.getBitfield("d")).toEqual(1);
            });

        });

    });

});
