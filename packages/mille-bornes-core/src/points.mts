import { type Brand } from "@repo/depot/brand";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";


/**
 * A score in points.  Always a non-negative integer.
 */
export type Points = Brand<number, "Points">;


export namespace Points {

    /**
     * Creates a Points value.
     * @param n - The number of points
     * @returns A successful result containing the Points or a failed result
     * containing an error message
     */
    export function tryCreate(n: number): Result<Points, string> {
        if (!Number.isInteger(n) || n < 0) {
            return new FailedResult(`Points must be a non-negative integer, but got ${n}.`);
        }
        return new SucceededResult(n as Points);
    }


    /**
     * Zero points.
     */
    export const zero = 0 as Points;


    /**
     * Adds two Points values.
     * @param a - The first value
     * @param b - The second value
     * @returns The sum
     */
    export function add(a: Points, b: Points): Points {
        return (a + b) as Points;
    }

}
