const factorialCache: Array<bigint> = [];
const FACTORIAL_THRESHOLD = 100;

/**
 * Calculates the factorial of a non-negative integer using a hybrid approach:
 * memoization for small inputs and iterative calculation for large inputs.
 *
 * @param val - The non-negative integer to calculate the factorial for.
 * @return The factorial of the input value as a BigInt. To test if it can be
 * safely converted to a regular number without precision loss:
 * ```js
 * if (Number(result) === result) {
 *     // safe
 * } else {
 *     // use BigInt
 * }
 * ```
 * @throws {Error} If the input is not a non-negative integer.
 */
export function factorial(val: number): bigint {
    if (!Number.isInteger(val)) {
        throw new Error("Input must be an integer.");
    }
    if (val < 0) {
        throw new Error("Input must be non-negative.");
    }
    if (val === 0 || val === 1) {
        return 1n;
    }
    if (val <= FACTORIAL_THRESHOLD) {
        // Use memoized recursive approach for small values
        if (factorialCache[val] !== undefined) {
            return factorialCache[val];
        }
        else {
            const f = factorial(val - 1) * BigInt(val);
            factorialCache[val] = f;
            return f;
        }
    }
    else {
        // Use iterative approach for large values to avoid stack overflow
        let result = 1n;
        for (let i = 2; i <= val; i++) {
            result *= BigInt(i);
        }
        return result;
    }
}
