import { z } from "zod";
import { Option, NoneOption, SomeOption } from "./option.mjs";


////////////////////////////////////////////////////////////////////////////////
// Integer Data Types
////////////////////////////////////////////////////////////////////////////////

// Signed 8-bit integer bounds
export const INT8_MIN = Math.pow(-2, 7);        // -128
export const INT8_MAX = Math.pow(2, 7) - 1;    // 127

export const int8Schema =
    z.number().int()
    .min(INT8_MIN)
    .max(INT8_MAX);

// Unsigned 8-bit integer bounds
export const UINT8_MIN = 0x00;
export const UINT8_MAX = 0xFF;                          // 255

export const uint8Schema =
    z.number().int()
    .min(UINT8_MIN)
    .max(UINT8_MAX);

// Signed 16-bit integer bounds
export const INT16_MIN = Math.pow(-2, 15);      // -32_768
export const INT16_MAX = Math.pow(2, 15) - 1;   // 32_767

export const int16Schema =
    z.number().int()
    .min(INT16_MIN)
    .max(INT16_MAX);

// Unsigned 16–bit integer bounds
export const UINT16_MIN = 0x00;
export const UINT16_MAX = 0xFF_FF;                      // 65_535

export const uint16Schema =
    z.number().int()
    .min(UINT16_MIN)
    .max(UINT16_MAX);

// Signed 32-bit integer bounds
export const INT32_MIN = Math.pow(-2, 31);           // -2_147_483_648
export const INT32_MAX = Math.pow(2, 31) - 1;       //  2_147_483_647

export const int32Schema =
    z.number().int()
    .min(INT32_MIN)
    .max(INT32_MAX);

// Unsigned 32-bit integer bounds
export const UINT32_MIN = 0x00;
export const UINT32_MAX = 0xFF_FF_FF_FF;                // 4_294_967_295

export const uint32Schema =
    z.number().int()
    .min(UINT32_MIN)
    .max(UINT32_MAX);

// Signed 64-bit integer bounds
export const INT64_MIN = -(2n ** 63n);       // -9_223_372_036_854_775_808
export const INT64_MAX = (2n ** 63n) - 1n;  //  9_223_372_036_854_775_807

export const int64Schema =
    z.bigint()
    .min(INT64_MIN)
    .max(INT64_MAX);

// Unsigned 64-bit integer bounds
export const UINT64_MIN = 0x00n;
export const UINT64_MAX = 0xFF_FF_FF_FF_FF_FF_FF_FFn;  // 18_446_744_073_709_551_615

export const uint64Schema =
    z.bigint()
    .min(UINT64_MIN)
    .max(UINT64_MAX);

// Signed 32-bit floating point bounds
export const FLOAT32_MIN = -3.4028235e+38;
export const FLOAT32_MAX = 3.4028235e+38;

export const float32Schema =
    z.number().min(FLOAT32_MIN).max(FLOAT32_MAX);

// Signed 64-bit floating point bounds
export const FLOAT64_MIN = -Number.MAX_VALUE;
export const FLOAT64_MAX = Number.MAX_VALUE;

export const float64Schema =
    // This range will need to be removed when support for INFINITY, etc. are added.
    z.number().min(FLOAT64_MIN).max(FLOAT64_MAX);


////////////////////////////////////////////////////////////////////////////////
// Option
////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a Zod schema for an Option type.
 *
 * @param valueSchema - The schema of the value to be wrapped by the Option
 * @returns A Zod schema that will validate the input and (upon success)
 * transform the output to an Option.
 */
export function discriminatedOptionSchema<TValue>(
    valueSchema: z.ZodType<TValue>
): z.ZodType<Option<TValue>> {
    return z.discriminatedUnion("isSome", [
        z.object({isSome: z.literal(false)}).strict(),                    // Don't allow extra properties
        z.object({isSome: z.literal(true), value: valueSchema}).strict()  // Don't allow extra properties
    ]).transform((val, ctx) => {
        return val.isSome ?
            new SomeOption(val.value) : NoneOption.get();
    });
}


/**
 * Creates a Zod schema that accepts an optional value and transforms it to an
 * Option. Missing/undefined values become NoneOption, while defined values
 * become SomeOption.
 *
 * @param valueSchema - The schema of the value that may be omitted
 * @returns A Zod schema that converts optional input into an Option
 */
export function optionalValueToOptionSchema<TValue>(
    valueSchema: z.ZodType<TValue>
): z.ZodType<Option<TValue>> {
    return z.optional(valueSchema)
    .transform((val) => {
        return val === undefined ? NoneOption.get() : new SomeOption(val);
    });
}


////////////////////////////////////////////////////////////////////////////////
// String containing a regular expression
////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a Zod schema that accepts a string and transforms it to a RegExp
 * object.
 */
export function regexpSchema(): z.ZodType<RegExp> {
    return z.string()
    .transform((val, ctx) => {
        try {
            return new RegExp(val);
        }
        catch (err) {
            const errMsg = err instanceof Error ?
                `Invalid regular expression: ${err.message}` :
                "Invalid regular expression.";
            ctx.addIssue({
                code:    "custom",
                message: errMsg
            });
            return z.NEVER;
        }
    });
}


////////////////////////////////////////////////////////////////////////////////
// Filesystem path schema
////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a Zod schema that accepts a filesystem path string and normalizes
 * all slash separators to the value returned by _separatorFn_.
 *
 * @param separatorFn - Function that returns the path separator to use
 * @returns A Zod schema that normalizes slash separators in path strings
 */
export function fileSystemPathSchema(
    separatorFn: () => "/" | "\\"
): z.ZodType<string> {
    return z.string().transform((path) => normalizePathSeparators(path, separatorFn()));
}


/**
 * Replaces all slash separators in a path string with a specific separator.
 *
 * @param path - The path string to normalize
 * @param separator - The separator character to apply
 * @returns A normalized path string
 */
export function normalizePathSeparators(path: string, separator: "/" | "\\"): string {
    return path.replace(/[\\/]/g, separator);
}
