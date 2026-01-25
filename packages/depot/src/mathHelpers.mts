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

/**
 * Calculates the number of distinct permutations of n elements with duplicates.
 * The duplicateCounts array specifies the sizes of duplicate groups (only
 * include counts > 1; unique elements are assumed for the rest).
 *
 * Formula: n! / (k1! * k2! * ... * km!), where k1, k2, etc., are the duplicate
 * counts, and the remaining elements are unique (1! = 1).
 *
 * @param n - The total number of elements.
 * @param duplicateCounts - Array of counts for duplicate groups (default: []).
 * Each count must be an integer > 1.
 * @return The number of distinct permutations as a BigInt.
 * @throws {Error} If n is not a non-negative integer, or if duplicateCounts
 * contains invalid values, or if the sum of duplicates exceeds n.
 *
 * @example
 * // All unique elements: 3! = 6
 * permutations(3) // 6n
 *
 * @example
 * // Two duplicates of one type, one unique: 3! / (2! * 1!) = 3
 * permutations(3, [2]) // 3n
 *
 * @example
 * // Two groups of duplicates: 5! / (2! * 2! * 1!) = 30
 * permutations(5, [2, 2]) // 30n
 */
export function permutations(n: number, duplicateCounts: number[] = []): bigint {
    if (!Number.isInteger(n) || n < 0) {
        throw new Error("n must be a non-negative integer.");
    }
    const sumDuplicates = duplicateCounts.reduce((sum, count) => sum + count, 0);
    const numGroups = duplicateCounts.length;
    const numUnique = n - sumDuplicates + numGroups;
    if (numUnique < 0 || sumDuplicates > n) {
        throw new Error("Invalid duplicate counts: sum exceeds n or negative uniques.");
    }
    for (const count of duplicateCounts) {
        if (!Number.isInteger(count) || count <= 1) {
            throw new Error("Each duplicate count must be an integer > 1.");
        }
    }
    let denominator = 1n;
    for (const count of duplicateCounts) {
        denominator *= factorial(count);
    }
    return factorial(n) / denominator;
}
