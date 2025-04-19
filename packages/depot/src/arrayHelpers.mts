import * as _ from "lodash-es";
import { FailedResult, Result } from "./result.mjs";


/**
 * Checks whether the specified array has an item at the specified index
 * (negative indices are not supported)
 *
 * @param arr - The array to check
 * @param idx - The index to check
 * @returns True if the array has an item at the specified index, false otherwise
 */
export function hasIndex<T>(arr: T[], idx: number): boolean {
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
 * @param idx - The index of the item to retrieve (negative indices are not
 *      supported)
 * @param defaultValue - The value to return if the index is out of bounds
 * @return The item at the specified index or the default value if out of bounds
 */
export function atOrDefault<TElem, TDefault>(arr: TElem[], idx: number, defaultValue: TDefault): TElem | TDefault {
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
 * Tests the strings in `strings` and returns the first non-null match.
 * @param strings - The array of strings to search
 * @param regex - The pattern to search for
 * @returns The first match found.  undefined if no match was found.
 */
export function anyMatchRegex(strings: Array<string>, regex: RegExp): RegExpExecArray | undefined {
    for (const curString of strings) {
        const curMatch: RegExpExecArray|null = regex.exec(curString);
        if (curMatch) {
            return curMatch;
        }
    }

    return undefined;
}


/**
 * Returns `items` when `condition` is truthy and returns [] when it is falsy.
 * This function and the array spread operator can be used together to
 * conditionally including array items in an array literal.  Inspired by
 * http://2ality.com/2017/04/conditional-literal-entries.html.
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
    condition: unknown,  // eslint-disable-line @typescript-eslint/explicit-module-boundary-types
    ...items: Array<TItem>
): Array<TItem> {
    return condition ? items : [];
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
 * Splits an array into two smaller arrays.
 *
 * @param arr - The source array
 * @param numToTake - Maximum number of elements that will be in the first returned array
 * @returns A tuple containing the two parts of the split array.
 */
export function split<T>(arr: Array<T>, numToTake: number): [Array<T>, Array<T>] {
    const first = _.take(arr, numToTake);
    const second = arr.slice(first.length);
    return [first, second];
}


/**
 * Takes an input array and groups consecutive similar items together (as
 * determined by _isSimilarFn_).
 *
 * @param items - Items to be grouped
 * @param isSimilarFn - A function that determines whether any two items can be
 * grouped together
 * @return An array of arrays.  Each inner array is a grouping of consecutive
 * items from the source array that are considered similar.  The order of the
 * items is unchanged from the input.
 */
export function groupConsecutiveBy<T>(items: T[], isSimilarFn: (a: T, b: T) => boolean): T[][] {
    const groups: T[][] = [];
    let currentGroup: T[] = [];
    let prevItem: T | undefined = undefined;

    for (const currentItem of items) {
        // If this is the first item or it is similar to the previous item, add
        // it to the current group.
        if (prevItem === undefined || isSimilarFn(currentItem, prevItem!)) {
            currentGroup.push(currentItem);
        }
        else {
            // Push the previous (completed) group, and start a new group with
            // the current item.
            groups.push(currentGroup);
            currentGroup = [currentItem];
        }

        prevItem = currentItem;
    }

    if (currentGroup.length > 0) {
        groups.push(currentGroup);
    }
    return groups;
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
 * Maps each input value through the specified mapping function.  If the
 * mapping function returns a successful result, its value is added to the
 * output array; otherwise nothing is added to the output array.
 *
 * @param fn - The function that will map each input value to either a
 * successful value that will be included in the output array or a failure
 * if no value will be contributed to the output array.
 * @param collection - The input sequence
 * @returns  The output array of chosen items
 */
export function choose<TIn, TOut, TError>(
    fn:         (v: TIn) => Result<TOut, TError>,
    collection: Iterable<TIn>
): Array<TOut> {

    const outputCol = [] as Array<TOut>;
    for (const cur of collection) {
        const res = fn(cur);
        if (res.succeeded) {
            outputCol.push(res.value);
        }
    }

    return outputCol;
}


/**
 * Maps each input value through the specified mapping function (which can be
 * async).  If the mapping function returns a successful Result, its value is
 * added to the output array; otherwise nothing is added to the output array.
 *
 * @param fn - The function that will map each input value to either a
 * successful value that will be included in the output array or a failure if no
 * value will be contributed to the output array.
 * @param collection - The input sequence
 * @return The output array of chosen items
 */
export async function chooseAsync<TIn, TOut, TError>(
    fn: (v: TIn) => Result<TOut, TError> | Promise<Result<TOut, TError>>,
    collection: Iterable<TIn>
): Promise<Array<TOut>> {

    const promises = [] as Array<Result<TOut, TError> | Promise<Result<TOut, TError>>>;
    for (const curVal of collection) {
        promises.push(fn(curVal));
    }

    const mappedResults = await Promise.all(promises);

    const outputCol = [] as Array<TOut>;
    for (const curRes of mappedResults) {
        if (curRes.succeeded) {
            outputCol.push(curRes.value);
        }
    }
    return outputCol;

}


/**
 * Iterates over _inputs_, passing them into _fn_. Returns the first successful
 * Result that is returned.  If none produce a success, a failed Result wrapping
 * _errVal_ is returned.
 *
 * @param fn - The function to be invoked
 * @param errVal - The failed Result value if no inputs produce a success
 * @param inputs - The inputs to be passed to _fn_
 * @return Description
 */
export function chooseFirst<TIn, TFnSuccess, TFnError, TError>(
    fn: (v: TIn) => Result<TFnSuccess, TFnError>,
    errVal: TError,
    inputs: Iterable<TIn>
): Result<TFnSuccess, TError> {

    for (const curInput of inputs) {
        const res = fn(curInput);
        if (res.succeeded) {
            return res;
        }
    }
    // If we got here, non of the inputs produced a successful Result.
    return new FailedResult(errVal);
}


/**
 * Iterates over _inputs_, passing them into _fn_ (which is potentially
 * asynchronous). Returns the first successful Result that is returned.  If none
 * produce a success, a failed Result wrapping _errVal_ is returned.
 *
 * @param fn - The function to be invoked
 * @param errVal - The failed Result value if no inputs produce a success
 * @param inputs - The inputs to be passed to _fn_
 * @return Description
 */
export async function chooseFirstAsync<TIn, TFnSuccess, TFnError, TError>(
    fn: (v: TIn) => Result<TFnSuccess, TFnError> | Promise<Result<TFnSuccess, TFnError>>,
    errVal: TError,
    inputs: Iterable<TIn>
): Promise<Result<TFnSuccess, TError>> {

    for (const curInput of inputs) {
        const res = await fn(curInput);
        if (res.succeeded) {
            return res;
        }
    }
    // If we got here, non of the inputs produced a successful Result.
    return new FailedResult(errVal);
}
