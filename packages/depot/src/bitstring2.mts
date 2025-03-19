import { UInt8, UInt16, UInt32 } from "./primitiveDataType.mjs";
import { Result, FailedResult, SucceededResult } from "./result.mjs";


export type BitNumber<T> =
  T extends UInt8 ? 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 :
  T extends UInt16 ? 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 :
  T extends UInt32 ? 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
                    16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 :
  never;


export type BitRange<T> =
    { type: "BitfieldDefBookends",      lowBit: BitNumber<T>; highBit: BitNumber<T> } |
    { type: "BitfieldDefLowBitAndSize", lowBit: BitNumber<T>; numBits: number };


export class Bitstring<T extends UInt8 | UInt16 | UInt32, TDef extends Record<string, BitRange<T>>> {

    static create<T extends UInt8 | UInt16 | UInt32, TDef extends Record<string, BitRange<T>>>(
        backing: T,
        defs: TDef
    ): Result<Bitstring<T, TDef>, string> {
        return bitfieldDefinitionsAreValid(backing, defs)
        .mapSuccess(() => new Bitstring(backing, defs));
    }


    private readonly _backing: T;
    private readonly _defs:    TDef;


    private constructor(backing: T, defs: TDef) {
        this._backing = backing;
        this._defs = defs;
    }


    /**
     * Gets the backing value for this Bitstring.
     *
     * @return The backing value.
     */
    public get backingValue(): T {
        return this._backing;
    }


    public getBitfield(key: keyof TDef): number {
        const def = this._defs[key]!;

        const numBitfieldBits = def.type === "BitfieldDefLowBitAndSize" ?
            def.numBits :
            def.highBit - def.lowBit + 1;

        // Create a mask to extract the bits from the value.
        const mask = (1 << numBitfieldBits) - 1;

        // Shift the value to the right by the low bit and apply the mask.
        const shiftedValue = (this._backing.value >> def.lowBit) & mask;
        return shiftedValue;
    }
}


/**
 * A function to validate the bitfield definitions.  This checks that the bit
 * ranges are valid and do not overlap.
 * @param defs - The bitfield definitions to validate
 * @param cls - The class type of the backing integer
 * @return If the definitions are valid, a successful Result containing the
 * definitions; otherwise a failed Result containing an error message
 */
function bitfieldDefinitionsAreValid<T extends UInt8 | UInt16 | UInt32>(
    backing: T,
    defs: Record<string, BitRange<T>>
): Result<Record<string, BitRange<T>>, string> {
    const minBitNum = 0;
    const maxBitNum = backing.static.numBits - 1;

    for (const [name, bitfieldSpecifier] of Object.entries(defs)) {

        // Even though the type system checks this for literals,
        // add a runtime check for safety with non-literal values.

        const lowBitNum = bitfieldSpecifier.lowBit;
        const highBitNum =
            bitfieldSpecifier.type === "BitfieldDefBookends" ? bitfieldSpecifier.highBit :
            lowBitNum + bitfieldSpecifier.numBits - 1;

        // Make sure that the lowBit and highBit are integers.
        if (!Number.isInteger(lowBitNum)) {
            return new FailedResult(`Bitfield ${name} has a non-integer low bit: ${lowBitNum}`);
        }

        if (!Number.isInteger(highBitNum)) {
            return new FailedResult(`Bitfield ${name} has a non-integer high bit: ${highBitNum}`);
        }

        // Make sure that the lowBit and highBit are within the range of the bit string.
        if (lowBitNum < minBitNum) {
            return new FailedResult(`Bitfield ${name} has a low bit less than the minimum: ${lowBitNum}`);
        }

        if (highBitNum > maxBitNum) {
            return new FailedResult(`Bitfield ${name} has a high bit greater than the maximum: ${highBitNum}`);
        }

        // Make sure that the lowBit is less than or equal to the highBit.
        if (lowBitNum > highBitNum) {
            return new FailedResult(`Bitfield ${name} has a low bit greater than the high bit: [${lowBitNum}, ${highBitNum}]`);
        }
    }

    // Make sure that none of the ranges specified in _defs_ overlap.
    const usedBits = Array(backing.static.numBits).fill(false) as boolean[];
    for (const [name, bitRange] of Object.entries(defs)) {
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
    return new SucceededResult(defs);
}
