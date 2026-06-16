import { type Result, SucceededResult, FailedResult } from "./result.mjs";

/**
 * Sets or clears the specified bit in the specified number.
 *
 * @param inputInt - The number in which the bit is to be set or cleared.
 * @param bitIndex - The index of the bit to be set or cleared. The least
 * significant bit is index 0.
 * @param value - The new value of the bit. If true, the bit is set. If false,
 * the bit is cleared.
 * @return The new number with the specified bit set or cleared.
 */
export function setBitInNumber(inputInt: number, bitIndex: number, value: boolean | 0 | 1): number {

    const mask = 1 << bitIndex;
    const newVal = value ? inputInt | mask : inputInt & ~mask;

    // JavaScript's bitwise operators only work on 32-bit *signed* integers, so
    // if a large number results in a negative value, it’s due to the 32-bit
    // signed integer interpretation. To handle this, you can use the >>>
    // (unsigned right shift) operator to convert the result to an unsigned
    // 32-bit integer, ensuring it's interpreted as a positive number.
    const unsignedVal = newVal >>> 0;
    return unsignedVal;
}


/**
 * Sets or clears the specified bit in the specified bigint.
 *
 * @param inputInt - The bigint in which the bit is to be set or cleared.
 * @param bitIndex - The index of the bit to be set or cleared. The least
 * significant bit is index 0.
 * @param value - The new value of the bit. If true, the bit is set. If false,
 * the bit is cleared.
 * @return The new bigint with the specified bit set or cleared.
 */
export function setBitInBigInt(inputInt: bigint, bitIndex: number, value: boolean | 0 | 1): bigint {
    const mask = 1n << BigInt(bitIndex);
    return value ? inputInt | mask : inputInt & ~mask;

}


/**
 * Validates that the bit index is an integer in the inclusive range [0,
 * maxBitIndex].
 *
 * @param bitIndex - The candidate bit index.
 * @param maxBitIndex - The maximum allowed bit index.
 * @param typeName - The data type display name used in error messaging.
 * @return A successful Result if bitIndex is valid; otherwise a failed Result
 * with the validation error message.
 */
export function validateBitIndex(
    bitIndex: number,
    maxBitIndex: number,
    typeName: string
): Result<void, string> {

    if (!Number.isInteger(bitIndex)) {
        return new FailedResult(`"${bitIndex}" is not a valid ${typeName} bit index. Must be an integer.`);
    }

    if ((bitIndex < 0) || (bitIndex > maxBitIndex)) {
        return new FailedResult(`"${bitIndex}" is not a valid ${typeName} bit index. Must be between 0 and ${maxBitIndex}.`);
    }

    return new SucceededResult(undefined);

}
