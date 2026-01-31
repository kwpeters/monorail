import * as z from "zod";
import { Result, FailedResult, SucceededResult } from "./result.mjs";


/**
 * Converts a Zod error to a human-readable error message string.
 *
 * @param error - The ZodError to convert
 * @return A string summarizing all validation issues
 */
export function zodErrorToString(error: z.ZodError): string {
    return error.issues
    .map((issue) => issue.path.length > 0 ? `${issue.path.join(".")}: ${issue.message}` :
                                            issue.message)
    .join("; ");
}


/**
 * Converts a Zod safeParse result into a Result type in a type-safe way.
 *
 * @param zodResult - The Zod safeParse result to convert
 * @return A Result containing either the parsed data or error message
 */
export function zodResultToResult<TSuccessParseData>(
    zodResult: z.ZodSafeParseResult<TSuccessParseData>
): Result<TSuccessParseData, string> {
    if (zodResult.success) {
        return new SucceededResult(zodResult.data);
    }
    else {
        const err = zodErrorToString(zodResult.error);
        return new FailedResult(err);
    }
}


/**
 * Parses an unknown value with a Zod schema and returns a Result
 *
 * @param schema - The Zod schema to use for parsing
 * @param input - The unknown input to parse
 * @return A Result containing either the parsed data or error message
 */
export function safeParse<TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    input: unknown
): Result<z.infer<TSchema>, string> {
    const zodResult = schema.safeParse(input);
    return zodResultToResult(zodResult);
}


/**
 * Asynchronously parses an unknown value with a Zod schema and returns a Result
 *
 * @param schema - The Zod schema to use for parsing
 * @param input - The unknown input to parse
 * @return A Promise of Result containing either the parsed data or error message
 */
export async function safeParseAsync<TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    input: unknown
): Promise<Result<z.infer<TSchema>, string>> {
    const zodResult = await schema.safeParseAsync(input);
    return zodResultToResult(zodResult);
}
