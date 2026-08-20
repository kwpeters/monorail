import { FailedResult, Result, SucceededResult } from "@repo/depot/result";


/**
 * Parses an unsigned hexadecimal token as a signed two's-complement bigint
 * using the specified bit width.
 */
export function parseSignedHexToBigInt(
    hexDigits: string,
    bitWidth: bigint
): Result<bigint, string> {
    const maxNibbles = Number(bitWidth / 4n);
    if (hexDigits.length > maxNibbles) {
        return new FailedResult(
            `"0x${hexDigits}" is not a valid value. Too many hex digits for ${bitWidth.toString()}-bit signed integer.`
        );
    }

    const raw = BigInt(`0x${hexDigits}`);
    const signBit = 1n << (bitWidth - 1n);
    const fullRange = 1n << bitWidth;
    const signed = (raw & signBit) === 0n ? raw : raw - fullRange;

    return new SucceededResult(signed);
}


/**
 * Parses an unsigned hexadecimal token as a signed two's-complement number
 * using the specified bit width.
 */
export function parseSignedHexToNumber(
    hexDigits: string,
    bitWidth: bigint
): Result<number, string> {
    return Result.mapSuccess(
        Number,
        parseSignedHexToBigInt(hexDigits, bitWidth)
    );
}
