import { type Brand } from "@repo/depot/brand";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";


/**
 * A distance in miles.  Always a non-negative integer multiple of 25.
 */
export type Miles = Brand<number, "Miles">;


export namespace Miles {

    /**
     * Creates a Miles value.
     * @param n - The number of miles
     * @returns A successful result containing the Miles or a failed result
     * containing an error message
     */
    export function tryCreate(n: number): Result<Miles, string> {
        if (!Number.isInteger(n) || n < 0 || n % 25 !== 0) {
            return new FailedResult(`Miles must be a non-negative multiple of 25, but got ${n}.`);
        }
        return new SucceededResult(n as Miles);
    }


    /**
     * Zero miles.
     */
    export const zero = 0 as Miles;


    /**
     * Adds two Miles values.
     * @param a - The first value
     * @param b - The second value
     * @returns The sum
     */
    export function add(a: Miles, b: Miles): Miles {
        return (a + b) as Miles;
    }

}
