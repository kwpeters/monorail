/**
 * Checks whether the specified array has an item at the specified index
 * (negative indices are not supported)
 *
 * @param arr - The array to check
 * @param idx - The index to check
 * @returns True if the array has an item at the specified index, false otherwise
 */
export function hasIndex(arr: readonly unknown[], idx: number): boolean {
    // If _idx_ is not an integer, _arr_ does not have that index.
    if (!Number.isInteger(idx)) {
        return false;
    }

    // If _idx_ is negative, _arr_ does not have that index.
    if (idx < 0) {
        return false;
    }

    const arrMaxIndex = arr.length - 1;
    return arrMaxIndex >= idx;
}


/**
 * Returns the item at the specified index in the array, or a default value if
 * the index is out of bounds.
 *
 * @param arr - The array to get the item from
 * @param idx - The index of the item to retrieve (negative indices are
 *     intentionally not supported)
 * @param defaultValue - The value to return if the index is out of bounds
 * @return The item at the specified index or the default value if out of bounds
 */
export function atOrDefault<TElem, TDefault>(
    arr: readonly TElem[],
    idx: number,
    defaultValue: TDefault
): TElem | TDefault {
    if (hasIndex(arr, idx)) {
        return arr[idx] as TElem;
    }
    return defaultValue;
}


/**
 * Returns the last index of the specified array, or undefined if the array is empty.
 *
 * @param arr - The array to get the last index from
 * @return The last index of the array or undefined if the array is empty
 */
export function lastIndex(arr: Array<unknown>): number | undefined {
    if (arr.length === 0) {
        return undefined;
    }
    return arr.length - 1;
}


/**
 * Returns `items` when `condition` is truthy and returns [] when it is falsy.
 * This function and the array spread operator can be used together to
 * conditionally including array items in an array literal.  Inspired by
 * http://2ality.com/2017/04/conditional-literal-entries.html.
 *
 * Note, if any of the `items` expressions are dependent on `condition` being
 * truthy, use `insertIfWith()` instead.
 *
 * @example
 * const arr = [
 *     "always present",
 *     ...insertIf(cond, "a", "b", "c"),
 *     "always present"
 * ];
 *
 * @param condition - The condition that controls whether to insert the items
 * @param items - The items that will be in the returned array if `condition` is
 * truthy
 * @return An array containing `items` if `condition` is truthy.  An empty array
 * if `condition` is falsy.
 */
export function insertIf<TItem>(
    condition: unknown,
    ...items: Array<TItem>
): Array<TItem> {
    return condition ? items : [];
}


/**
 * Returns `fn()` when `condition` is truthy and returns [] when it is falsy.
 * This function and the array spread operator can be used together to
 * conditionally including array items in an array literal.  This function must
 * be used instead of insertIf() when condition must be true in order to access
 * the items to be returned.
 *
 * @example
 * const arr = [
 *     "always present",
 *     ...insertIfWith(opt.isSome, () => [opt.value!.toString()]),
 *     "always present"
 * ];
 *
 * @param condition - The condition that controls whether to insert the items
 * @param fn - A function that returns the items that will be in the returned
 * array if `condition` is truthy
 * @return An array containing the result of `fn()` if `condition` is truthy.  An
 * empty array if `condition` is falsy.
 */
export function insertIfWith<TReturn>(
    condition: unknown,
    fn: () => Array<TReturn>
): Array<TReturn> {
    if (condition) {
        return fn();
    }
    return [];
}


/**
 * Calculates all possible permutations of an array.
 * @param vals - The values for which all permutations will be calculated.
 * @returns An array in which each value is an array representing one
 * permutation of the original array.
 */
export function permutations<T>(vals: Array<T>): Array<Array<T>> {
    if (vals.length === 0) {
        return [];
    }

    if (vals.length === 1) {
        return [vals];
    }

    let allPermutations: Array<Array<T>> = [];

    // To calculate the permutations, calculate the permutations where each
    // element is the first element.
    for (let curIndex = 0; curIndex < vals.length; ++curIndex) {
        const rest = vals.filter((val, index) => index !== curIndex);
        const restPermutations = permutations(rest);
        allPermutations = allPermutations.concat(
            restPermutations.map((curRestPermutation) => [vals[curIndex]!, ...curRestPermutation])
        );
    }

    return allPermutations;
}


/**
 * If needed, converts the specified value to an array.
 * @param val - The value to convert into an array (if it is not already an
 * array)
 * @returns - The resulting array.
 */
export function toArray<T>(val: undefined | null | T | Array<T>): Array<T> {
    if (val === undefined || val === null) {
        return [];
    }

    return Array.isArray(val) ? val : [val];
}



/**
 * Filters an array and keeps only those items that are not null or undefined.
 *
 * @param collection - The collection to be filtered
 * @return A new array containing the items from `collection` that are not null
 *      or undefined
 */
export function filterDefined<TItem>(
    collection: Array<TItem | null | undefined>
): Array<TItem> {
    return collection.filter(
        (item): item is TItem => item !== null && item !== undefined
    );
}


/**
 * Converts a nullable array to a non-nullable array.
 *
 * @param nullableArr - The nullable array to convert
 * @return The non-nullable array
 */
export function fromNullable<T>(nullableArr: T[] | null | undefined): T[] {
    if (nullableArr === null || nullableArr === undefined) {
        return [];
    }
    return nullableArr;
}
