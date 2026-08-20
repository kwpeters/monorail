// These regexes are intentionally defined without "g" or "y" flags so they
// remain safe to reuse across calls without lastIndex state interactions.
// If a future shared regex requires "g" or "y", prefer exporting a factory
// function that returns a new RegExp instance on each call.

/**
 * Regular expression for parsing unsigned decimal integer tokens.
 */
export const DECIMAL_INTEGER_TOKEN_REGEX = /^\d+$/;

/**
 * Regular expression for parsing signed decimal integer tokens.
 */
export const SIGNED_DECIMAL_INTEGER_TOKEN_REGEX = /^[+-]?\d+$/;

/**
 * Regular expression for parsing unsigned hexadecimal integer tokens with
 * 0x/0X prefix.
 */
export const HEX_INTEGER_TOKEN_REGEX = /^0[xX](?<hexDigits>[0-9a-fA-F]+)$/;

/**
 * Regular expression for parsing optionally signed hexadecimal integer tokens
 * with 0x/0X prefix (e.g. "0xFF", "-0x10").
 */
export const SIGNED_HEX_INTEGER_TOKEN_REGEX = /^(?<sign>-?)0[xX](?<hexDigits>[0-9a-fA-F]+)$/;

/**
 * Regular expression for parsing unsigned binary integer tokens with 0b/0B
 * prefix.
 */
export const BINARY_INTEGER_TOKEN_REGEX = /^0[bB](?<binaryDigits>[01]+)$/;

/**
 * Regular expression for parsing scientific notation tokens.
 */
export const SCIENTIFIC_NOTATION_TOKEN_REGEX =
    /^[+-]?(?:\d+\.?\d*|\.\d+)[eE][+-]?\d+$/;

/**
 * Regular expression for parsing decimal floating-point tokens.
 */
export const FLOATING_NOTATION_TOKEN_REGEX =
    /^[+-]?(?:\d+\.\d*|\.\d+)$/;

/**
 * Regular expression for parsing special floating-point symbol tokens.
 */
export const SPECIAL_SYMBOL_TOKEN_REGEX =
    /^(?:QUIET-NAN|SIGNAL-NAN|[+-]?INFINITY)$/i;
