import { z } from "zod";
import { Option, NoneOption, SomeOption } from "./option.mjs";


////////////////////////////////////////////////////////////////////////////////
// Integer Data Types
////////////////////////////////////////////////////////////////////////////////

// Signed 8-bit integer
export const int8Schema =
    z.number().int()
    .min(-128)
    .max(127);

// Unsigned 8-bit integer
export const uint8Schema =
    z.number().int()
    .min(0)
    .max(0xff);                     // 255

// Signed 16-bit integer
export const int16Schema =
    z.number().int()
    .min(-32768)
    .max(32767);

// Unsigned 16–bit integer
export const uint16Schema =
    z.number().int()
    .min(0)
    .max(0xffff);                   // 65_535

// Signed 32-bit integer
export const int32Schema =
    z.number().int()
    .min(Math.pow(-2, 31))           // -2_147_483_648
    .max(Math.pow(2, 31) - 1);       //  2_147_483_647

// Unsigned 32-bit integer
export const uint32Schema =
    z.number().int()
    .min(0)
    .max(Math.pow(2, 32) - 1);       // 4_294_967_295

// Signed 64-bit integer
export const int64Schema =
    z.bigint()
    .min(BigInt(-2) ** BigInt(63))              // -9_223_372_036_854_775_808
    .max(BigInt(2) ** BigInt(63) - BigInt(1));  //  9_223_372_036_854_775_807

export const uint64Schema =
    z.bigint()
    .min(BigInt(0))
    .max(BigInt(2) ** BigInt(64) - BigInt(1));  // 18_446_744_073_709_551_615

export const float32Schema =
    z.number().min(-3.4028235e+38).max(3.4028235e+38);

export const float64Schema =
    // This range will need to be removed when support for INFINITY, etc. are added.
    z.number().min(-1.7976931348623157e+308).max(1.7976931348623157e+308);


////////////////////////////////////////////////////////////////////////////////
// Option
////////////////////////////////////////////////////////////////////////////////

/**
 * Creates a Zod schema for an Option type.
 *
 * @param valueSchema - The schema of the value to be wrapped by the Option
 * @return A Zod schema that will validate the input and (upon success)
 * transform the output to an Option.
 */
export function optionSchema<TValue>(
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
