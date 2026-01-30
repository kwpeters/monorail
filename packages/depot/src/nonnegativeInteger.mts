/* eslint-disable @typescript-eslint/no-namespace */
import { type Brand } from "./brand.mjs";
import { FailedResult, Result, SucceededResult } from "./result.mjs";


/**
 * NonnegativeInteger is a branded number that represents a non-negative
 * integer value.
 */
export type NonnegativeInteger = Brand<number, "NonnegativeInteger">;


export namespace NonnegativeInteger {

    /**
     * Attempts to create a new NonnegativeInteger.
     *
     * @param x - The number to be wrapped
     * @return If _x_ is valid, a successful Result containing the
     * NonnegativeInteger.  Otherwise, a failed Result containing an error
     * message.
     */
    export function tryCreate(x: number): Result<NonnegativeInteger, string> {
        if (x < 0) {
            return new FailedResult(`The value "${x}" is not a valid NonnegativeInteger.`);
        }

        if (!Number.isInteger(x)) {
            return new FailedResult(`The value "${x}" is not a valid NonnegativeInteger.`);
        }

        return new SucceededResult(x as NonnegativeInteger);
    }


    /**
     * Creates a new NonnegativeInteger.  Throws if the input is invalid.
     *
     * @param x - The number to be wrapped
     * @return If _x_ is valid, the resulting NonnegativeInteger value.
     * Otherwise, an exception is thrown.
     */
    export function create(x: number): NonnegativeInteger {
        const result = tryCreate(x);
        if (result.failed) {
            throw new Error(result.error);
        }
        return result.value;
    }

}
