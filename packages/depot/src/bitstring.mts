import { FailedResult, Result, SucceededResult } from "./result.mjs";
import { pipe } from "./pipe2.mjs";
import { UInt8 } from "./primitiveDataType.mjs";


export interface IBitfieldBookends {
    type:    "IBitfieldBookends";
    lowBit:  number;
    highBit: number;
}


export interface IBitfieldStartAndSize {
    type:    "IBitfieldStartAndSize";
    lowBit:  number;
    numBits: number;
}


/**
 * A function to validate the bitfield definitions.  This checks that the bit
 * ranges are valid and do not overlap.
 * @param defs -  The bitfield definitions to validate
 * @param bitStringNumBits - The number of bits in the bit string
 * @return If the definitions are valid, a successful Result containing the
 * definitions; otherwise a failed Result containing an error message.
 */
export function bitfieldDefinitionsAreValid(
    defs: {[name: string]: BitfieldSpecifier},
    bitStringNumBits: number
): Result<{[name: string]: BitfieldSpecifier}, string> {

    const minBitNum = 0;
    const maxBitNum = bitStringNumBits - 1;

    for (const [name, bitfieldSpecifier] of Object.entries(defs)) {
        const lowBitNum = bitfieldSpecifier.lowBit;
        const highBitNum = bitfieldSpecifier.type === "IBitfieldBookends" ?
            bitfieldSpecifier.highBit :
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

    // Make sure that none of the ranges specified in `defs` overlap.
    const usedBits: boolean[] = Array(bitStringNumBits).fill(false) as boolean[];
    for (const [name, bitRange] of Object.entries(defs)) {
        const highBit = bitRange.type === "IBitfieldBookends" ?
            bitRange.highBit :
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


export type BitfieldSpecifier = IBitfieldStartAndSize | IBitfieldBookends;


/**
 * An 8-bit bit string.  A bit string is a sequence of bits, and a definition of
 * the bitfields contained within it.
 */
export class BitString8<T extends {[name: string]: BitfieldSpecifier}> {

    /**
     * Creates a new BitString8 instance.
     * @param value - The value to wrap
     * @param defs - The bitfield definitions to use for the bit string.
     * @return A Result containing the new BitString8 instance if successful;
     *      otherwise a failed Result containing an error message.
     */
    public static create<T extends {[name: string]: BitfieldSpecifier}>(
        value: UInt8,
        defs: T
    ): Result<BitString8<T>, string> {
        return pipe(
            bitfieldDefinitionsAreValid(defs, 8),
            (res) => Result.mapSuccess(() => new BitString8(value, defs), res)
        );
    }


    private readonly _val:  UInt8;
    private readonly _defs: T;


    private constructor(value: UInt8, defs: T) {
        this._val = value;
        this._defs = defs;
    }


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public asUInt8(): UInt8 {
        return UInt8.create(this._val.value).throwIfFailed();
    }


    /**
     * Gets the value of the specified bitfield.
     *
     * @param name - The name of the bitfield as defined in the bitfield
     *      definitions.
     * @return Description
     */
    public getBitfield(name: keyof T): number {
        const bitfieldSpecification = this._defs[name] as BitfieldSpecifier;
        const numBitfieldBits = bitfieldSpecification.type === "IBitfieldBookends" ?
            bitfieldSpecification.highBit - bitfieldSpecification.lowBit + 1 :
            bitfieldSpecification.numBits;
        // Create a mask to extract the bits from the value.
        const mask = (1 << numBitfieldBits) - 1;
        // Shift the value to the right by the low bit and apply the mask.
        const shiftedValue = (this._val.value >> bitfieldSpecification.lowBit) & mask;
        return shiftedValue;
    }

}
