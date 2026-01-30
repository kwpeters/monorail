/* eslint-disable @typescript-eslint/no-namespace */
import { type Brand } from "./brand.mjs";
import { FailedResult, Result, SucceededResult } from "./result.mjs";


/**
 * PositiveInteger is a branded number that represents an integer value
 * greater than or equal to 1.
 */
export type PositiveInteger = Brand<number, "PositiveInteger">;

export namespace PositiveInteger {

    /**
     * Attempts to create a new PositiveInteger.
     *
     * @param x - The number to be wrapped
     * @return If _x_ is valid, a successful Result containing the
     * PositiveInteger.  Otherwise, a failed Result containing an error
     * message.
     */
    export function tryCreate(x: number): Result<PositiveInteger, string> {
        if (x < 1) {
            return new FailedResult(`The value "${x}" is not a valid PositiveInteger.`);
        }

        if (!Number.isInteger(x)) {
            return new FailedResult(`The value "${x}" is not a valid PositiveInteger.`);
        }

        return new SucceededResult(x as PositiveInteger);
    }


    /**
     * Creates a new PositiveInteger.  Throws if the input is invalid.
     *
     * @param x - The number to be wrapped
     * @return If _x_ is valid, the resulting PositiveInteger value.
     * Otherwise, an exception is thrown.
     */
    export function create(x: number): PositiveInteger {
        const result = tryCreate(x);
        if (result.failed) {
            throw new Error(result.error);
        }
        return result.value;
    }

}
