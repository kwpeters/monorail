/**
 * Converts an error object into a string
 *
 * @param err - The error to be converted
 * @returns The resulting string.  If _err_ was an Error instance, the string
 * will be the Error's message.  Otherwise, the string is the JSON
 * representation of _err_.
 */
export function errorToString(err: unknown): string {

    const errX = err as string | { message?: string; };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof errX === "string") {
        return errX;
    }
    else if (errX.message && typeof errX.message === "string") {
        return errX.message;
    }
    else {
        return JSON.stringify(err);
    }
}
