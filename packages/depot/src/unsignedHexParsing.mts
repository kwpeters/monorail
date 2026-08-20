import { FailedResult, Result, SucceededResult } from "@repo/depot/result";


/**
 * Removes a leading 0x/0X prefix from a hexadecimal string.
 */
export function stripHexPrefix(value: string): string {
    return value.startsWith("0x") || value.startsWith("0X") ?
        value.slice(2) :
        value;
}


/**
 * Ensures a hexadecimal string has a "0x" prefix, inserting it after any
 * leading minus sign if not already present. Accepts "0x"/"0X" and
 * "-0x"/"-0X" as already-prefixed.
 *
 * @param value - A hex string, optionally with a leading minus sign or
 *     0x/0X prefix.
 * @returns The string with "0x" prefix in the correct position.
 */
export function ensureHexPrefix(value: string): string {
    const isNeg = value.startsWith("-");
    const unsigned = isNeg ? value.slice(1) : value;
    const hasPrefix = unsigned.startsWith("0x") || unsigned.startsWith("0X");
    if (hasPrefix) {
        return value;
    }
    return isNeg ? `-0x${unsigned}` : `0x${unsigned}`;
}


/**
 * Ensures a binary string has a "0b" prefix, inserting it after any leading
 * minus sign if not already present. Accepts "0b"/"0B" and "-0b"/"-0B" as
 * already-prefixed.
 *
 * @param value - A binary string, optionally with a leading minus sign or
 *     0b/0B prefix.
 * @returns The string with "0b" prefix in the correct position.
 */
export function ensureBinaryPrefix(value: string): string {
    const isNeg = value.startsWith("-");
    const unsigned = isNeg ? value.slice(1) : value;
    const hasPrefix = unsigned.startsWith("0b") || unsigned.startsWith("0B");
    if (hasPrefix) {
        return value;
    }
    return isNeg ? `-0b${unsigned}` : `0b${unsigned}`;
}


/**
 * Parses an unsigned hexadecimal token as an unsigned bigint
 * using the specified bit width.
 */
export function parseUnsignedHexToBigInt(
    hexDigits: string,
    bitWidth: bigint
): Result<bigint, string> {
    const maxNibbles = Number(bitWidth / 4n);
    if (hexDigits.length > maxNibbles) {
        return new FailedResult(
            `"0x${hexDigits}" is not a valid value. Too many hex digits for ${bitWidth.toString()}-bit unsigned integer.`
        );
    }

    const raw = BigInt(`0x${hexDigits}`);
    const maxValue = (1n << bitWidth) - 1n;

    if (raw > maxValue) {
        return new FailedResult(
            `"0x${hexDigits}" is not a valid value. Must be between 0x0 and 0x${maxValue.toString(16).toUpperCase()}.`
        );
    }

    return new SucceededResult(raw);
}


/**
 * Parses an unsigned hexadecimal token as an unsigned number
 * using the specified bit width.
 */
export function parseUnsignedHexToNumber(
    hexDigits: string,
    bitWidth: bigint
): Result<number, string> {
    return Result.mapSuccess(
        Number,
        parseUnsignedHexToBigInt(hexDigits, bitWidth)
    );
}
