import { UInt8, UInt16, UInt32 } from "./primitiveDataType.mjs";
import { Result, FailedResult, SucceededResult } from "./result.mjs";


/**
 * A type that represents valid bit numbers for a given data type
 */
export type BitNumber<TDataType> =
  TDataType extends UInt8 ? 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 :
  TDataType extends UInt16 ? 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 :
  TDataType extends UInt32 ? 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
                    16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 :
  never;


/**
 * A type that represents a range of bits that define a bitfield within a
 * bitstring.
 */
export type BitRange<TBackingDT> =
    { type: "BitfieldDefBookends",      lowBit: BitNumber<TBackingDT>; highBit: BitNumber<TBackingDT> } |
    { type: "BitfieldDefLowBitAndSize", lowBit: BitNumber<TBackingDT>; numBits: number };


/**
 * Data type that defines the bitfields within a Bitstring.
 */
export type BitfieldsDef<TBackingValue extends UInt8 | UInt16 | UInt32> = Record<string, BitRange<TBackingValue>>;

/**
 * Represents a sequence of bits with named bitfields
 */
export class Bitstring<
    TBackingValue extends UInt8 | UInt16 | UInt32,
    TBitfieldDef extends BitfieldsDef<TBackingValue>
> {
    /**
     * Creates a new Bitstring instance
     * @param backingValue - The backing integer value
     * @param bitfieldDefs - The bitfield definitions
     * @return A Result containing either the new Bitstring instance or an error
     * message
     */
    static create<
        TBackingValue extends UInt8 | UInt16 | UInt32,
        TBitfieldDef extends BitfieldsDef<TBackingValue>
    >(
        backingValue: TBackingValue,
        bitfieldDefs: TBitfieldDef
    ): Result<Bitstring<TBackingValue, TBitfieldDef>, string> {
        return bitfieldDefinitionsAreValid(backingValue, bitfieldDefs)
        .mapSuccess(() => new Bitstring(backingValue, bitfieldDefs));
    }


    private readonly _backingValue: TBackingValue;
    private readonly _bitfieldDefs: TBitfieldDef;


    private constructor(backingValue: TBackingValue, bitfieldDefs: TBitfieldDef) {
        this._backingValue = backingValue;
        this._bitfieldDefs = bitfieldDefs;
    }


    /**
     * Gets the backing value for this Bitstring
     * @return The backing value
     */
    public get backingValue(): TBackingValue {
        return this._backingValue;
    }


    /**
     * Gets the names of the bitfields within this Bitstring
     * @return The bitfield definitions
     */
    public enumBitfields(): IterableIterator<keyof TBitfieldDef> {
        return Object.keys(this._bitfieldDefs)[Symbol.iterator]();

    }


    /**
     * Gets the value of the specified bitfield
     * @param bitfieldName - The name of the bitfield to get
     * @return The value of the bitfield
     */
    public getBitfield(bitfieldName: keyof TBitfieldDef): number {
        const bitfiledDef = this._bitfieldDefs[bitfieldName]!;

        const numBitfieldBits = bitfiledDef.type === "BitfieldDefLowBitAndSize" ?
            bitfiledDef.numBits :
            bitfiledDef.highBit - bitfiledDef.lowBit + 1;

        // Create a mask to extract the bits from the value.
        const mask = (1 << numBitfieldBits) - 1;

        // Shift the value to the right by the low bit and apply the mask.
        const shiftedValue = (this._backingValue.value >> bitfiledDef.lowBit) & mask;
        return shiftedValue;
    }


    /**
     * Gets the name and value of all bitfields within this Bitstring.
     * @return An array of tuples.  Each tuple contains the bitfield name and
     * its value.
     */
    public *getAllBitfields(): IterableIterator<[keyof TBitfieldDef, number]> {
        const keys = Object.keys(this._bitfieldDefs) as Array<keyof TBitfieldDef>;
        const iter = keys[Symbol.iterator]();

        while (true) {
            const next = iter.next();
            if (next.done) {
                break;
            }

            const bitfieldName = next.value;
            const bitfieldVal = this.getBitfield(bitfieldName);
            yield [bitfieldName, bitfieldVal];
        }
    }


    /**
     * Gets the name and value of all bitfields within this Bitstring that have
     * a non-zero value.  Similar to getAllBitfields(), but filters for only
     * those bitfields that have a non-zero value.  Provided as a convenience,
     * because it is common to want to iterate over all bitfields that are
     * non-zero.
     * @return An array of tuples.  Each tuple contains the bitfield name and
     * its value.
     */
    public *getAllNonZeroBitfields(): IterableIterator<[keyof TBitfieldDef, number]> {
        const iter = this.getAllBitfields();

        while (true) {
            const next = iter.next();
            if (next.done) {
                break;
            }

            const [__bitfieldName, bitfieldValue] = next.value;
            if (bitfieldValue !== 0) {
                yield next.value;
            }
        }
    }


    /**
     * Returns a new Bitstring instance with the specified bitfield set to the
     * new value.
     * @param bitfieldName - The name of the bitfield to set
     * @param value - The new value of the bitfield
     * @return The new Bitstring instance with the specified bitfield set to the
     * new value
     */
    public setBitfield(bitfieldName: keyof TBitfieldDef, value: number): Bitstring<TBackingValue, TBitfieldDef> {
        const bitfiledDef = this._bitfieldDefs[bitfieldName]!;

        const numBitfieldBits = bitfiledDef.type === "BitfieldDefLowBitAndSize" ?
            bitfiledDef.numBits :
            bitfiledDef.highBit - bitfiledDef.lowBit + 1;

        // Create a mask to clear the bits in the value.
        const mask = ((1 << numBitfieldBits) - 1) << bitfiledDef.lowBit;

        // Clear the bits in the value and then set the new value.
        const clearedValue = this._backingValue.value & ~mask;
        const shiftedValue = value << bitfiledDef.lowBit;
        const newValue = clearedValue | (shiftedValue & mask);

        const backingValue = this._backingValue.static.create(newValue).throwIfFailed() as TBackingValue;
        const newBitstring = new Bitstring(backingValue, this._bitfieldDefs);
        return newBitstring;
    }
}


/**
 * A function to validate the bitfield definitions.  This checks that the bit
 * ranges are valid and do not overlap.
 * @param bitfieldDefs - The bitfield definitions to validate
 * @param cls - The class type of the backing integer
 * @return If the definitions are valid, a successful Result containing the
 * definitions; otherwise a failed Result containing an error message
 */
function bitfieldDefinitionsAreValid<TBackingValue extends UInt8 | UInt16 | UInt32>(
    backingValue: TBackingValue,
    bitfieldDefs: BitfieldsDef<TBackingValue>
): Result<BitfieldsDef<TBackingValue>, string> {
    const minBitNum = 0;
    const maxBitNum = backingValue.static.numBits - 1;

    for (const [bitfieldName, bitfieldDef] of Object.entries(bitfieldDefs)) {

        // Even though the type system checks this for literals,
        // add a runtime check for safety with non-literal values.

        const lowBitNum = bitfieldDef.lowBit;
        const highBitNum =
            bitfieldDef.type === "BitfieldDefBookends" ? bitfieldDef.highBit :
            lowBitNum + bitfieldDef.numBits - 1;

        // Make sure that the lowBit and highBit are integers.
        if (!Number.isInteger(lowBitNum)) {
            return new FailedResult(`Bitfield ${bitfieldName} has a non-integer low bit: ${lowBitNum}`);
        }

        if (!Number.isInteger(highBitNum)) {
            return new FailedResult(`Bitfield ${bitfieldName} has a non-integer high bit: ${highBitNum}`);
        }

        // Make sure that the lowBit and highBit are within the range of the bit string.
        if (lowBitNum < minBitNum) {
            return new FailedResult(`Bitfield ${bitfieldName} has a low bit less than the minimum: ${lowBitNum}`);
        }

        if (highBitNum > maxBitNum) {
            return new FailedResult(`Bitfield ${bitfieldName} has a high bit greater than the maximum: ${highBitNum}`);
        }

        // Make sure that the lowBit is less than or equal to the highBit.
        if (lowBitNum > highBitNum) {
            return new FailedResult(`Bitfield ${bitfieldName} has a low bit greater than the high bit: [${lowBitNum}, ${highBitNum}]`);
        }
    }

    // Make sure that none of the ranges specified in _defs_ overlap.
    const usedBits = Array(backingValue.static.numBits).fill(false) as boolean[];
    for (const [name, bitRange] of Object.entries(bitfieldDefs)) {
        const highBit = bitRange.type === "BitfieldDefBookends" ? bitRange.highBit :
            bitRange.lowBit + bitRange.numBits - 1;
        for (let curBitNum = bitRange.lowBit; curBitNum <= highBit; curBitNum++) {
            if (usedBits[curBitNum]) {
                return new FailedResult(`Bitfield ${name} overlaps with another bitfield at bit ${curBitNum}.`);
            }
            usedBits[curBitNum] = true;
        }
    }

    // If we made it this far, then the bitfield definitions are valid.
    return new SucceededResult(bitfieldDefs);
}
