import { UInt8, UInt16 } from "./primitiveDataType.mjs";
import { Bitstring } from "./bitstring.mjs";
import { pipe } from "./pipe2.mjs";


describe("Bitstring", () => {

    describe("compilation will fail when", () => {

        describe("Bitstring.create()", () => {

            it("fails when a bitfield definition contains a low bit that is less than zero", () => {
                // const bitfieldDefs = {
                //     "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                //     "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
                //     "c": { type: "BitfieldDefBookends",      lowBit: -1, highBit: 6 },  // bits 5, 6    <<-- Error: low bit less than zero
                //     "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                // } as const;
                //
                // const bitstring = Bitstring.create(
                //     UInt8.create(0b1_01_10_101).throwIfFailed(),
                //     bitfieldDefs        // <<--- Compilation error here
                // ).throwIfFailed();

                expect(true).toBeTruthy();
            });


            it("fails when a bitfield definition contains a high bit that is greater than the highest bit number supported by the data type", () => {
                // const bitfieldDefs = {
                //     "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                //     "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
                //     "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 8 },  // bits 5, 6    <<-- Error: high bit exceeds data type
                //     "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                // } as const;
                //
                // const bitstring = Bitstring.create(
                //     UInt8.create(0b1_01_10_101).throwIfFailed(),
                //     bitfieldDefs        // <<--- Compilation error here
                // ).throwIfFailed();

                expect(true).toBeTruthy();
            });


            it("fails when a bitfield definition contains a fractional low bit", () => {
                // const bitfieldDefs = {
                //     "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0,   numBits: 3 },  // bits 0, 1, 2
                //     "b": { type: "BitfieldDefBookends",      lowBit: 3.5, highBit: 4 },  // bits 3, 4    <<-- Error: fractional low bit
                //     "c": { type: "BitfieldDefBookends",      lowBit: 5,   highBit: 6 },  // bits 5, 6
                //     "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7,   numBits: 1 },  // bit 7
                // } as const;
                //
                // const bitstring = Bitstring.create(
                //     UInt8.create(0b1_01_10_101).throwIfFailed(),
                //     bitfieldDefs        // <<--- Compilation error here
                // ).throwIfFailed();

                expect(true).toBeTruthy();
            });


            it("fails when a bitfield definition contains a fractional high bit", () => {
                // const bitfieldDefs = {
                //     "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },    // bits 0, 1, 2
                //     "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4.5 },  // bits 3, 4    <<-- Error: fractional high bit
                //     "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 6 },    // bits 5, 6
                //     "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },    // bit 7
                // } as const;
                //
                // const bitstring = Bitstring.create(
                //     UInt8.create(0b1_01_10_101).throwIfFailed(),
                //     bitfieldDefs        // <<--- Compilation error here
                // ).throwIfFailed();

                expect(true).toBeTruthy();

            });

        });


        describe("getBitfiled()", () => {

            it("is called with an undefined bitfiled name", () => {
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
                // ).throwIfFailed();
                //
                // expect(bitstring.getBitfield("a")).toEqual(5);
                // expect(bitstring.getBitfield("b")).toEqual(2);
                // expect(bitstring.getBitfield("c")).toEqual(1);
                // expect(bitstring.getBitfield("d")).toEqual(1);
                // expect(bitstring.getBitfield("does_not_exist")).toEqual(1);

                expect(true).toBeTruthy();
            });

        });

    });


    describe("static", () => {

        describe("create()", () => {

            it("fails when a bitfield definition contains a low bit that is greater than the high bit", () => {
                const bitfieldDefs = {
                    "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
                    "c": { type: "BitfieldDefBookends",      lowBit: 6, highBit: 5 },  // bits 5, 6    <<-- Error: low bit greater than high bit
                    "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                } as const;

                const res = Bitstring.create(
                    UInt8.create(0b1_01_10_101).throwIfFailed(),
                    bitfieldDefs
                );

                expect(res.failed).toBeTrue();
            });


            it("fails when the bitfield definitions overlap", () => {
                const bitfieldDefs = {
                    "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 5 },  // bits 3, 4    <<-- Error: overlap with bitfield "c"
                    "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 6 },  // bits 5, 6
                    "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                } as const;

                const res = Bitstring.create(
                    UInt8.create(0b1_01_10_101).throwIfFailed(),
                    bitfieldDefs
                );

                expect(res.failed).toBeTrue();
            });


            it("succeeds when all input is valid", () => {
                const bitfieldDefs = {
                    "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
                    "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 6 },  // bits 5, 6
                    "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                } as const;

                const res = Bitstring.create(
                    UInt8.create(0b1_01_10_101).throwIfFailed(),
                    bitfieldDefs
                );
            });

        });

    });


    describe("instance", () => {

        describe("backingValue property", () => {

            it("returns the expected backing value", () => {
                const bitfieldDefs = {
                    "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
                    "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 6 },  // bits 5, 6
                    "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                } as const;

                const bitstring = Bitstring.create(
                    UInt8.create(0b1_01_10_101).throwIfFailed(),
                    bitfieldDefs
                ).throwIfFailed();

                expect(bitstring.backingValue.value).toEqual(0b1_01_10_101);
            });

        });


        describe("enumBitfields()", () => {

            it("returns the expected bitfield names", () => {
                const bitfieldDefs = {
                    "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
                    "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 6 },  // bits 5, 6
                    "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                } as const;

                const bitstring = Bitstring.create(
                    UInt8.create(0b1_01_10_101).throwIfFailed(),
                    bitfieldDefs
                ).throwIfFailed();

                expect(Array.from(bitstring.enumBitfields())).toEqual(["a", "b", "c", "d"]);
            });

        });


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
                ).throwIfFailed();

                expect(bitstring.getBitfield("a")).toEqual(0b101);
                expect(bitstring.getBitfield("b")).toEqual(0b10);
                expect(bitstring.getBitfield("c")).toEqual(0b01);
                expect(bitstring.getBitfield("d")).toEqual(0b1);
            });

        });


        describe("getAllBitfields()", () => {

            it("returns the names and values of all bitfields", () => {
                const bitfieldDefs = {
                    "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
                    "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 6 },  // bits 5, 6
                    "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                } as const;

                const bitstring = Bitstring.create(
                    UInt8.create(0b1_01_10_101).throwIfFailed(),
                    bitfieldDefs
                ).throwIfFailed();

                const allBitfields = Array.from(bitstring.getAllBitfields());
                expect(allBitfields).toEqual([["a", 0b101], ["b", 0b10], ["c", 0b01], ["d", 0b1]]);
            });

        });


        describe("getAllNonZeroBitfields()", () => {

            it("returns only the bitfields with non-zero values", () => {
                const bitfieldDefs = {
                    "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
                    "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 6 },  // bits 5, 6
                    "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                } as const;

                const bitstring = Bitstring.create(
                    UInt8.create(0b1_00_10_101).throwIfFailed(),  // bitfield "c" should be skipped
                    bitfieldDefs
                ).throwIfFailed();

                const bitfields = Array.from(bitstring.getAllNonZeroBitfields());
                expect(bitfields).toEqual([["a", 0b101], ["b", 0b10], ["d", 0b1]]);
            });

        });


        describe("setBitfiled()", () => {

            it("returns a new Bitstring with the value of the bitfiled updated", () => {

                const bitfieldDefs = {
                    "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
                    "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 6 },  // bits 5, 6
                    "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                } as const;

                const newBitstring = pipe(
                    UInt8.create(0b0_00_00_000).throwIfFailed(),
                    (backingVal) => Bitstring.create(backingVal, bitfieldDefs).throwIfFailed(),
                    (bitstring) => bitstring.setBitfield("b", 0b11)
                );
                expect(newBitstring.backingValue.value).toEqual(0b0_00_11_000);
            });


            it("does not affect bit outside of the bitfield when the value specified is larger than the bitfield", () => {
                const bitfieldDefs = {
                    "a": { type: "BitfieldDefLowBitAndSize", lowBit: 0, numBits: 3 },  // bits 0, 1, 2
                    "b": { type: "BitfieldDefBookends",      lowBit: 3, highBit: 4 },  // bits 3, 4
                    "c": { type: "BitfieldDefBookends",      lowBit: 5, highBit: 6 },  // bits 5, 6
                    "d": { type: "BitfieldDefLowBitAndSize", lowBit: 7, numBits: 1 },  // bit 7
                } as const;

                const newBitstring = pipe(
                    UInt8.create(0b0_00_00_000).throwIfFailed(),
                    (backingVal) => Bitstring.create(backingVal, bitfieldDefs).throwIfFailed(),
                    (bitstring) => bitstring.setBitfield("b", 0b111)  // bitfield is only 2 bits, but trying to set 3
                );
                expect(newBitstring.backingValue.value).toEqual(0b0_00_11_000);
            });

        });

    });

});
