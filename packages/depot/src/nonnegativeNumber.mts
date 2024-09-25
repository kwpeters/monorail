/* eslint-disable @typescript-eslint/no-namespace */
import { type Brand } from "./brand.mjs";
import { FailedResult, Result, SucceededResult } from "./result.mjs";


/**
 * NonnegativeNumber is a branded number.
 */
export type NonnegativeNumber = Brand<number, "NonnegativeNumber">;

export namespace NonnegativeNumber {

    /**
     * Attempts to create a new NonnegativeNumber.
     *
     * @param x - The number to be wrapped
     * @return If _x_ is valid, a successful Result containing the
     * NonnegativeNumber.  Otherwise, a failed Result containing an error
     * message.
     */
    export function tryCreate(x: number): Result<NonnegativeNumber, string> {
        return x < 0 ?
            new FailedResult(`The value "${x}" is not a valid NonnegativeNumber.`) :
            new SucceededResult(x as NonnegativeNumber);
    }


    /**
     * Creates a new NonnegativeNumber.  Throws if the input is invalid.
     *
     * @param x - The number to be wrapped
     * @return If _x_ is valid, the resulting Nonnegative value.  Otherwise, and exception is thrown.
     */
    export function create(x: number): NonnegativeNumber {
        if (x < 0) {
            throw new Error(`The value "${x}" is not a valid NonnegativeNumber.`);
        }

        return x as NonnegativeNumber;
    }

}
