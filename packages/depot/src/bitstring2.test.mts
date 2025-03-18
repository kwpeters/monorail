import { UInt8, UInt16 } from "./primitiveDataType.mjs";
import { Bitstring } from "./bitstring2.mjs";



describe("Bitstring", () => {

    describe("compilation will fail when", () => {

        it("foo", () => {
            expect(true).toBeTruthy();
        });


        it("Bitstring.create() is passed bitfield definitions that conflict with base data type", () => {
            // const bitfieldDefs = {
            //     "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
            //     "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
            //     "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 8 },  // bits 5, 6
            //     "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
            // } as const;
            //
            // const bitstring = Bitstring.create(
            //     UInt8.create(0b1_01_10_101).throwIfFailed(),
            //     bitfieldDefs
            // );
            //
            // expect(bitstring.getBitfield("a")).toEqual(5);
            // expect(bitstring.getBitfield("b")).toEqual(2);
            // expect(bitstring.getBitfield("c")).toEqual(1);
            // expect(bitstring.getBitfield("d")).toEqual(1);

            expect(true).toBeTruthy();
        });


        it("getBitfiled() is called with an undefined bitfiled name", () => {
            // const bitfieldDefs = {
            //     "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
            //     "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
            //     "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 6 },  // bits 5, 6
            //     "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
            // } as const;
            //
            // const bitstring = Bitstring.create(
            //     UInt8.create(0b1_01_10_101).throwIfFailed(),
            //     bitfieldDefs
            // );
            //
            // expect(bitstring.getBitfield("a")).toEqual(5);
            // expect(bitstring.getBitfield("b")).toEqual(2);
            // expect(bitstring.getBitfield("c")).toEqual(1);
            // expect(bitstring.getBitfield("d")).toEqual(1);
            // expect(bitstring.getBitfield("does_not_exist")).toEqual(1);

            expect(true).toBeTruthy();
        });

    });


    describe("static", () => {

        it("foo", () => {
            expect(true).toBeTruthy();
        });

    });


    describe("instance", () => {

        describe("getBitfield()", () => {

            it("returns the expected bitfield values", () => {

                const bitfieldDefs = {
                    "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
                    "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 6 },  // bits 5, 6
                    "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                } as const;

                const bitstring = Bitstring.create(
                    UInt8.create(0b1_01_10_101).throwIfFailed(),
                    bitfieldDefs
                );

                expect(bitstring.getBitfield("a")).toEqual(0b101);
                expect(bitstring.getBitfield("b")).toEqual(0b10);
                expect(bitstring.getBitfield("c")).toEqual(0b01);
                expect(bitstring.getBitfield("d")).toEqual(0b1);
            });

        });

    });
});
