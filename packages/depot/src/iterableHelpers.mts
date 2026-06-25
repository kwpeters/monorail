import type { MaybePromise } from "./typeUtils.mjs";
import { dispatchLast } from "./curry.mjs";
import { NoneOption, Option, SomeOption } from "./option.mjs";
import { FailedResult, Result } from "./result.mjs";


/**
 * Builds a Map of the specified items.  Each value's key in the map is gotten
 * by calling keyFn.
 *
 * @param keyFn - The function that returns each item's key, invoked with the
 * item and its index
 * @param items - The items that will become the values in the map
 * @return The resulting Map
 */
// Eager (data-last) form.
export function buildIndex<T>(
    keyFn: (curItem: T, index: number) => string,
    items: Iterable<T>
): Map<string, T>;

// Curried (point-free) form.
export function buildIndex<T>(
    keyFn: (curItem: T, index: number) => string
): (items: Iterable<T>) => Map<string, T>;

export function buildIndex(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        (
            keyFn: (curItem: unknown, index: number) => string,
            items: Iterable<unknown>
        ) => {
            const index = new Map<string, unknown>();

            let idx = 0;
            for (const curItem of items) {
                const key = keyFn(curItem, idx);
                index.set(key, curItem);
                idx++;
            }

            return index;
        }
    );
}


/**
 * Finds the first duplicate item in the specified iterable, where duplicates
 * are determined by the specified criterion function.
 *
 * @param criterionFn - The function that determines the criterion for
 * identifying duplicates, invoked with the item and its index
 * @param items - The iterable to search for duplicates
 * @return An Option containing the first duplicate item and its criterion, or
 * NoneOption if no duplicates are found
 */
// Eager (data-last) form.
export function findFirstDuplicateBy<TElem, TCriterion>(
    criterionFn: (curItem: TElem, index: number) => TCriterion,
    items: Iterable<TElem>
): Option<{elem: TElem, criterion: TCriterion}>;

// Curried (point-free) form.
export function findFirstDuplicateBy<TElem, TCriterion>(
    criterionFn: (curItem: TElem, index: number) => TCriterion
): (items: Iterable<TElem>) => Option<{elem: TElem, criterion: TCriterion}>;

export function findFirstDuplicateBy(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        (
            criterionFn: (curItem: unknown, index: number) => unknown,
            items: Iterable<unknown>
        ) => {
            const seen = new Set<unknown>();
            let idx = 0;
            for (const curItem of items) {
                const criterion = criterionFn(curItem, idx);
                if (seen.has(criterion)) {
                    return new SomeOption({ elem: curItem, criterion });
                }
                seen.add(criterion);
                idx++;
            }
            return NoneOption.get();
        }
    );
}


/**
 * Maps the items of an Iterable using a synchronous function.
 *
 * This is a config-first/data-last collection helper: it operates on any
 * `Iterable<TIn>` and supports point-free use with pipe().  Note: the input
 * Iterable is fully materialized, so it is not suitable for infinite iterables.
 *
 * @param fn - The mapping function, invoked with each item and its index.
 * @param items - The Iterable of items to map over.
 * @return An array of the mapped values.
 */
// Eager (data-last) form.
export function map<TIn, TOut>(
    fn:    (curItem: TIn, index: number) => TOut,
    items: Iterable<TIn>
): Array<TOut>;

// Curried (point-free) form.
export function map<TIn, TOut>(
    fn: (curItem: TIn, index: number) => TOut
): (items: Iterable<TIn>) => Array<TOut>;

export function map(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        (fn: (curItem: unknown, index: number) => unknown, items: Iterable<unknown>) => {
            return Array.from(items, (curItem, index) => fn(curItem, index));
        }
    );
}


/**
 * Maps the items of an Iterable using an async function.  The async function is
 * invoked for every item concurrently.  The returned Promise rejects as soon as
 * the first async function rejects.  If none reject, it resolves with an array
 * of the mapped results.
 *
 * This is the config-first/data-last analog of `mapAsync()` from
 * promiseHelpers.mts: it operates on any `Iterable` (not just arrays) and
 * supports point-free use with pipeAsync().  Note: the input Iterable is fully
 * materialized, so it is not suitable for infinite iterables.
 *
 * @param fn - The async mapping function, invoked with each item and its index.
 * @param items - The Iterable of items to map over.
 * @return A Promise for an array of the mapped values.
 */
// Eager (data-last) form.
export function mapAsync<TIn, TOut>(
    fn:    (curItem: TIn, index: number) => Promise<TOut>,
    items: Iterable<TIn>
): Promise<Array<TOut>>;

// Curried (point-free) form.
export function mapAsync<TIn, TOut>(
    fn: (curItem: TIn, index: number) => Promise<TOut>
): (items: Iterable<TIn>) => Promise<Array<TOut>>;

export function mapAsync(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        (
            fn: (curItem: unknown, index: number) => Promise<unknown>,
            items: Iterable<unknown>
        ) => Promise.all(Array.from(items, (curItem, index) => fn(curItem, index)))
    );
}


/**
 * Augments the items of an Iterable with the value returned by the specified
 * async function.  The async function is invoked for every item concurrently,
 * and the object it returns is merged into the original item.
 *
 * This is the config-first/data-last analog of the original `augmentAsync()`
 * from promiseHelpers.mts: it operates on any `Iterable` (not just arrays) and
 * supports point-free use with pipeAsync().  Note: the input Iterable is fully
 * materialized, so it is not suitable for infinite iterables.
 *
 * @param asyncValueFn - The function that returns the data that will augment the
 * original item, invoked with each item and its index.
 * @param items - The Iterable of items to augment.
 * @return A Promise for an array of the augmented items.
 */
// Eager (data-last) form.
export function augmentAsync<TIn, TAugment>(
    asyncValueFn: (curItem: TIn, index: number) => MaybePromise<TAugment>,
    items:        Iterable<TIn>
): Promise<Array<TIn & TAugment>>;

// Curried (point-free) form.
export function augmentAsync<TIn, TAugment>(
    asyncValueFn: (curItem: TIn, index: number) => MaybePromise<TAugment>
): (items: Iterable<TIn>) => Promise<Array<TIn & TAugment>>;

export function augmentAsync(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        (
            asyncValueFn: (curItem: object, index: number) => unknown,
            items: Iterable<object>
        ) => mapAsync(
            async (item: object, idx: number) => {
                const augment = await Promise.resolve(asyncValueFn(item, idx)) as object;
                return {...item, ...augment};
            },
            items
        )
    );
}


/**
 * Zips the items of an Iterable into tuples with the result of calling the async
 * function for each item.  The async function is invoked for every item
 * concurrently.  The returned Promise rejects as soon as the first async
 * function rejects.
 *
 * This is the config-first/data-last successor to `zipWithAsyncValues()` from
 * promiseHelpers.mts: it operates on any `Iterable` (not just arrays) and
 * supports point-free use with pipeAsync().  Note: the input Iterable is fully
 * materialized, so it is not suitable for infinite iterables.
 *
 * @param asyncValueFn - The async function called for each item, invoked with
 * the item and its index.
 * @param items - The Iterable of items to zip.
 * @return A Promise for an array of 2-element tuples.  The first element is the
 * item and the second is the resolved value returned from `asyncValueFn`.
 */
// Eager (data-last) form.
export function zipWithAsync<TIn, TOut>(
    asyncValueFn: (curItem: TIn, index: number) => Promise<TOut>,
    items:        Iterable<TIn>
): Promise<Array<[TIn, TOut]>>;

// Curried (point-free) form.
export function zipWithAsync<TIn, TOut>(
    asyncValueFn: (curItem: TIn, index: number) => Promise<TOut>
): (items: Iterable<TIn>) => Promise<Array<[TIn, TOut]>>;

export function zipWithAsync(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        async (
            asyncValueFn: (curItem: unknown, index: number) => Promise<unknown>,
            items: Iterable<unknown>
        ) => {
            const itemArr = Array.from(items);
            const values = await mapAsync(asyncValueFn, itemArr);
            return itemArr.map((curItem, index): [unknown, unknown] => [curItem, values[index]!]);
        }
    );
}


/**
 * Filters the items of an Iterable, keeping only those for which `predicate`
 * returns a truthy value.
 *
 * This is a config-first/data-last collection helper: it operates on any
 * `Iterable<T>` and supports point-free use with pipe().  Note: the input
 * Iterable is fully materialized, so it is not suitable for infinite iterables.
 *
 * @param predicate - Invoked with each item and its index; items for which it
 * returns a truthy value are kept.
 * @param items - The Iterable of items to filter.
 * @return A new array containing the items that satisfied the predicate.
 */
// Eager (data-last) form.
export function filter<T>(
    predicate: (curItem: T, index: number) => unknown,
    items:     Iterable<T>
): Array<T>;

// Curried (point-free) form.
export function filter<T>(
    predicate: (curItem: T, index: number) => unknown
): (items: Iterable<T>) => Array<T>;

export function filter(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        (predicate: (curItem: unknown, index: number) => unknown, items: Iterable<unknown>) => {
            const result: Array<unknown> = [];
            let index = 0;
            for (const curItem of items) {
                if (predicate(curItem, index)) {
                    result.push(curItem);
                }
                index += 1;
            }
            return result;
        }
    );
}


/**
 * Filters the items of an Iterable based on the result of an async predicate.
 * The predicate is invoked for every item concurrently; an item is kept when its
 * predicate resolves to a truthy value.  The returned Promise rejects as soon as
 * the first predicate rejects.
 *
 * This is the config-first/data-last successor to `filterAsync()` from
 * promiseHelpers.mts: it operates on any `Iterable` (not just arrays) and
 * supports point-free use with pipeAsync().  Note: the input Iterable is fully
 * materialized, so it is not suitable for infinite iterables.
 *
 * @param asyncPredicate - The async predicate, invoked with each item and its
 * index.  Items whose predicate resolves to a truthy value are kept.
 * @param items - The Iterable of items to filter.
 * @return A Promise for an array of the items that satisfied the predicate.
 */
// Eager (data-last) form.
export function filterAsync<T>(
    asyncPredicate: (curItem: T, index: number) => Promise<unknown>,
    items:          Iterable<T>
): Promise<Array<T>>;

// Curried (point-free) form.
export function filterAsync<T>(
    asyncPredicate: (curItem: T, index: number) => Promise<unknown>
): (items: Iterable<T>) => Promise<Array<T>>;

export function filterAsync(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        async (
            asyncPredicate: (curItem: unknown, index: number) => Promise<unknown>,
            items: Iterable<unknown>
        ) => {
            const pairs = await zipWithAsync(asyncPredicate, items);
            return pairs
            .filter((curPair) => !!curPair[1])
            .map((curPair) => curPair[0]);
        }
    );
}


/**
 * Partitions the items of an Iterable into two arrays based on the result of an
 * async predicate invoked on each item concurrently.  The returned Promise
 * rejects as soon as the first predicate rejects.
 *
 * This is the config-first/data-last successor to `partitionAsync()` from
 * promiseHelpers.mts: it operates on any `Iterable` (not just arrays) and
 * supports point-free use with pipeAsync().  Note: the input Iterable is fully
 * materialized, so it is not suitable for infinite iterables.
 *
 * @param asyncPredicate - The async predicate, invoked with each item and its
 * index.
 * @param items - The Iterable of items to partition.
 * @return A Promise for a 2-element tuple.  The first array holds the items
 * whose predicate resolved to a truthy value; the second holds those that
 * resolved to a falsy value.
 */
// Eager (data-last) form.
export function partitionAsync<T>(
    asyncPredicate: (curItem: T, index: number) => Promise<unknown>,
    items:          Iterable<T>
): Promise<[Array<T>, Array<T>]>;

// Curried (point-free) form.
export function partitionAsync<T>(
    asyncPredicate: (curItem: T, index: number) => Promise<unknown>
): (items: Iterable<T>) => Promise<[Array<T>, Array<T>]>;

export function partitionAsync(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        async (
            asyncPredicate: (curItem: unknown, index: number) => Promise<unknown>,
            items: Iterable<unknown>
        ) => {
            const pairs = await zipWithAsync(asyncPredicate, items);
            const truthy = pairs.filter((curPair) => !!curPair[1]).map((curPair) => curPair[0]);
            const falsy = pairs.filter((curPair) => !curPair[1]).map((curPair) => curPair[0]);
            return [truthy, falsy];
        }
    );
}


/**
 * Reduces the items of an Iterable to a single value using a synchronous
 * accumulator function, applied in iteration order.
 *
 * This is a config-first/data-last collection helper: it operates on any
 * `Iterable<TItem>` and supports point-free use with pipe().
 *
 * @param fn - The accumulator function, invoked with the current accumulator,
 * the item, and its index.
 * @param initialValue - The initial accumulator value.
 * @param items - The Iterable of items to reduce.
 * @return The final accumulator value.
 */
// Eager (data-last) form.
export function reduce<TItem, TAcc>(
    fn:           (acc: TAcc, curItem: TItem, index: number) => TAcc,
    initialValue: TAcc,
    items:        Iterable<TItem>
): TAcc;

// Curried (point-free) form.
export function reduce<TItem, TAcc>(
    fn:           (acc: TAcc, curItem: TItem, index: number) => TAcc,
    initialValue: TAcc
): (items: Iterable<TItem>) => TAcc;

export function reduce(...args: Array<unknown>): unknown {
    return dispatchLast(
        3,
        args,
        (
            fn: (acc: unknown, curItem: unknown, index: number) => unknown,
            initialValue: unknown,
            items: Iterable<unknown>
        ) => {
            let acc = initialValue;
            let index = 0;
            for (const curItem of items) {
                acc = fn(acc, curItem, index);
                index += 1;
            }
            return acc;
        }
    );
}


/**
 * Reduces the items of an Iterable using an asynchronous accumulator function.
 * The accumulator function is invoked sequentially (each call awaits the
 * previous), in iteration order.
 *
 * This is the config-first/data-last successor to `reduceAsync()` from
 * promiseHelpers.mts: it operates on any `Iterable` (not just arrays) and
 * supports point-free use with pipeAsync().
 *
 * @param asyncAccFn - The accumulator function returning a Promise for the next
 * accumulator value, invoked with the current accumulator, the item, and its
 * index.
 * @param initialAcc - The initial accumulator value.
 * @param items - The Iterable of items to reduce.
 * @return A Promise for the final accumulator value.
 */
// Eager (data-last) form.
export function reduceAsync<TItem, TAcc>(
    asyncAccFn: (acc: TAcc, curItem: TItem, index: number) => Promise<TAcc>,
    initialAcc: TAcc,
    items:      Iterable<TItem>
): Promise<TAcc>;

// Curried (point-free) form.
export function reduceAsync<TItem, TAcc>(
    asyncAccFn: (acc: TAcc, curItem: TItem, index: number) => Promise<TAcc>,
    initialAcc: TAcc
): (items: Iterable<TItem>) => Promise<TAcc>;

export function reduceAsync(...args: Array<unknown>): unknown {
    return dispatchLast(
        3,
        args,
        async (
            asyncAccFn: (acc: unknown, curItem: unknown, index: number) => Promise<unknown>,
            initialAcc: unknown,
            items: Iterable<unknown>
        ) => {
            let acc = initialAcc;
            let index = 0;
            for (const curItem of items) {
                acc = await asyncAccFn(acc, curItem, index);
                index += 1;
            }
            return acc;
        }
    );
}


/**
 * Tests each string in `items` against `regex` and returns the first non-null
 * match.
 *
 * This is a config-first/data-last collection helper: it operates on any
 * `Iterable<string>` and supports point-free use with pipe().
 *
 * @remarks
 * Prefer a stateless regular expression.  This function calls
 * `RegExp.prototype.exec()` repeatedly on the same regex instance, and any flag
 * that makes a regex stateful will produce surprising results because that state
 * (the regex's `lastIndex`) persists across those calls — and, when `regex` is
 * partially applied, across separate invocations of the returned function:
 *
 *   - The global (`g`) and sticky (`y`) flags cause `exec()` to advance
 *     `lastIndex` after each call, so matching resumes mid-string on the next
 *     string instead of starting from the beginning.  A string that should match
 *     can be skipped, and the result depends on prior calls.
 *
 * Pass a regex without the `g` and `y` flags.  (Flags such as `i`, `m`, `s`, and
 * `u` are stateless and safe to use.)
 *
 * @param regex - The pattern to search for.  Should not use the `g` or `y` flag.
 * @param items - The Iterable of strings to search.
 * @return The first match found, or undefined if no string matched.
 */
// Eager (data-last) form.
export function firstMatch(
    regex: RegExp,
    items: Iterable<string>
): RegExpExecArray | undefined;

// Curried (point-free) form.
export function firstMatch(
    regex: RegExp
): (items: Iterable<string>) => RegExpExecArray | undefined;

export function firstMatch(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        (regex: RegExp, items: Iterable<string>) => {
            for (const curString of items) {
                const curMatch = regex.exec(curString);
                if (curMatch) {
                    return curMatch;
                }
            }
            return undefined;
        }
    );
}


/**
 * Returns a new array containing the items of `items` with `separator` inserted
 * between each pair of adjacent items.  The input is not modified.
 *
 * This is a config-first/data-last collection helper: it operates on any
 * `Iterable<T>` and supports point-free use with pipe().
 *
 * @param separator - The value to insert between items.
 * @param items - The Iterable of items to intersperse.
 * @return A new array with `separator` inserted between the items.
 */
// Eager (data-last) form.
export function intersperse<T>(
    separator: T,
    items:     Iterable<T>
): Array<T>;

// Curried (point-free) form.
export function intersperse<T>(
    separator: T
): (items: Iterable<T>) => Array<T>;

export function intersperse(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        (separator: unknown, items: Iterable<unknown>) => {
            const result: Array<unknown> = [];
            for (const curItem of items) {
                if (result.length > 0) {
                    result.push(separator);
                }
                result.push(curItem);
            }
            return result;
        }
    );
}


/**
 * Splits the items of an Iterable into two arrays: the first holds up to
 * `numToTake` items (in iteration order) and the second holds the rest.  The
 * input is not modified.
 *
 * This is a config-first/data-last collection helper: it operates on any
 * `Iterable<T>` and supports point-free use with pipe().
 *
 * @param numToTake - The maximum number of items to place in the first array.  A
 * value less than or equal to zero puts all items in the second array.
 * @param items - The Iterable of items to split.
 * @return A 2-element tuple `[first, second]`, where `first` has up to
 * `numToTake` items and `second` has the remainder.
 */
// Eager (data-last) form.
export function split<T>(
    numToTake: number,
    items:     Iterable<T>
): [Array<T>, Array<T>];

// Curried (point-free) form.
export function split<T>(
    numToTake: number
): (items: Iterable<T>) => [Array<T>, Array<T>];

export function split(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        (numToTake: number, items: Iterable<unknown>) => {
            const first: Array<unknown> = [];
            const second: Array<unknown> = [];
            let index = 0;
            for (const curItem of items) {
                if (index < numToTake) {
                    first.push(curItem);
                }
                else {
                    second.push(curItem);
                }
                index += 1;
            }
            return [first, second];
        }
    );
}


/**
 * Groups consecutive similar items of an Iterable together, as determined by
 * `isSimilarFn`.  The input is not modified.
 *
 * This is a config-first/data-last collection helper: it operates on any
 * `Iterable<T>` and supports point-free use with pipe().
 *
 * @param isSimilarFn - Determines whether two adjacent items belong in the same
 * group.
 * @param items - The Iterable of items to group.
 * @return An array of arrays.  Each inner array is a run of consecutive items
 * considered similar.  Item order is preserved.
 */
// Eager (data-last) form.
export function groupConsecutiveBy<T>(
    isSimilarFn: (a: T, b: T) => boolean,
    items:       Iterable<T>
): Array<Array<T>>;

// Curried (point-free) form.
export function groupConsecutiveBy<T>(
    isSimilarFn: (a: T, b: T) => boolean
): (items: Iterable<T>) => Array<Array<T>>;

export function groupConsecutiveBy(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        (isSimilarFn: (a: unknown, b: unknown) => boolean, items: Iterable<unknown>) => {
            const groups: Array<Array<unknown>> = [];
            let currentGroup: Array<unknown> = [];
            let prevItem: unknown;
            let havePrev = false;

            for (const currentItem of items) {
                // If this is the first item or it is similar to the previous
                // item, add it to the current group.
                if (!havePrev || isSimilarFn(currentItem, prevItem)) {
                    currentGroup.push(currentItem);
                }
                else {
                    // Push the previous (completed) group, and start a new group
                    // with the current item.
                    groups.push(currentGroup);
                    currentGroup = [currentItem];
                }

                prevItem = currentItem;
                havePrev = true;
            }

            if (currentGroup.length > 0) {
                groups.push(currentGroup);
            }
            return groups;
        }
    );
}


/**
 * Maps each item of an Iterable through `fn`.  When `fn` returns a successful
 * Result, its value is added to the output array; when it returns a failure,
 * nothing is added.
 *
 * This is a config-first/data-last collection helper: it operates on any
 * `Iterable<TIn>` and supports point-free use with pipe().
 *
 * @param fn - Maps each item to either a successful value (included in the
 * output) or a failure (contributes nothing).
 * @param collection - The Iterable of items to map.
 * @return The array of chosen (successful) values.
 */
// Eager (data-last) form.
export function choose<TIn, TOut, TError>(
    fn:         (v: TIn) => Result<TOut, TError>,
    collection: Iterable<TIn>
): Array<TOut>;

// Curried (point-free) form.
export function choose<TIn, TOut, TError>(
    fn: (v: TIn) => Result<TOut, TError>
): (collection: Iterable<TIn>) => Array<TOut>;

export function choose(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        (fn: (v: unknown) => Result<unknown, unknown>, collection: Iterable<unknown>) => {
            const outputCol = [] as Array<unknown>;
            for (const cur of collection) {
                const res = fn(cur);
                if (res.succeeded) {
                    outputCol.push(res.value);
                }
            }
            return outputCol;
        }
    );
}


/**
 * Maps each item of an Iterable through `fn` (which may be async), invoking it
 * for every item concurrently.  When `fn` resolves to a successful Result, its
 * value is added to the output array; when it resolves to a failure, nothing is
 * added.
 *
 * This is a config-first/data-last collection helper: it operates on any
 * `Iterable<TIn>` and supports point-free use with pipeAsync().
 *
 * @param fn - Maps each item to either a successful value (included in the
 * output) or a failure (contributes nothing).
 * @param collection - The Iterable of items to map.
 * @return A Promise for the array of chosen (successful) values.
 */
// Eager (data-last) form.
export function chooseAsync<TIn, TOut, TError>(
    fn:         (v: TIn) => MaybePromise<Result<TOut, TError>>,
    collection: Iterable<TIn>
): Promise<Array<TOut>>;

// Curried (point-free) form.
export function chooseAsync<TIn, TOut, TError>(
    fn: (v: TIn) => MaybePromise<Result<TOut, TError>>
): (collection: Iterable<TIn>) => Promise<Array<TOut>>;

export function chooseAsync(...args: Array<unknown>): unknown {
    return dispatchLast(
        2,
        args,
        async (
            fn: (v: unknown) => MaybePromise<Result<unknown, unknown>>,
            collection: Iterable<unknown>
        ) => {
            const promises = [] as Array<Promise<Result<unknown, unknown>>>;
            for (const curVal of collection) {
                promises.push(Promise.resolve(fn(curVal)));
            }

            const mappedResults = await Promise.all(promises);

            const outputCol = [] as Array<unknown>;
            for (const curRes of mappedResults) {
                if (curRes.succeeded) {
                    outputCol.push(curRes.value);
                }
            }
            return outputCol;
        }
    );
}


/**
 * Iterates over `inputs`, passing each into `fn`, and returns the first
 * successful Result.  If none produce a success, a failed Result wrapping
 * `errVal` is returned.
 *
 * This is a config-first/data-last collection helper: it operates on any
 * `Iterable<TIn>` and supports point-free use with pipe().
 *
 * @param fn - The function invoked for each input.
 * @param errVal - The failed Result value used when no input produces a success.
 * @param inputs - The Iterable of inputs to pass to `fn`.
 * @return The first successful Result, or a failed Result wrapping `errVal`.
 */
// Eager (data-last) form.
export function chooseFirst<TIn, TFnSuccess, TFnError, TError>(
    fn:     (v: TIn) => Result<TFnSuccess, TFnError>,
    errVal: TError,
    inputs: Iterable<TIn>
): Result<TFnSuccess, TError>;

// Curried (point-free) form.
export function chooseFirst<TIn, TFnSuccess, TFnError, TError>(
    fn:     (v: TIn) => Result<TFnSuccess, TFnError>,
    errVal: TError
): (inputs: Iterable<TIn>) => Result<TFnSuccess, TError>;

export function chooseFirst(...args: Array<unknown>): unknown {
    return dispatchLast(
        3,
        args,
        (
            fn: (v: unknown) => Result<unknown, unknown>,
            errVal: unknown,
            inputs: Iterable<unknown>
        ) => {
            for (const curInput of inputs) {
                const res = fn(curInput);
                if (res.succeeded) {
                    return res;
                }
            }
            // If we got here, none of the inputs produced a successful Result.
            return new FailedResult(errVal);
        }
    );
}


/**
 * Iterates over `inputs`, passing each into `fn` (which may be async), and
 * returns the first successful Result.  If none produce a success, a failed
 * Result wrapping `errVal` is returned.  Inputs are processed sequentially, so
 * iteration stops at the first success.
 *
 * This is a config-first/data-last collection helper: it operates on any
 * `Iterable<TIn>` and supports point-free use with pipeAsync().
 *
 * @param fn - The (potentially async) function invoked for each input.
 * @param errVal - The failed Result value used when no input produces a success.
 * @param inputs - The Iterable of inputs to pass to `fn`.
 * @return A Promise for the first successful Result, or a failed Result wrapping
 * `errVal`.
 */
// Eager (data-last) form.
export function chooseFirstAsync<TIn, TFnSuccess, TFnError, TError>(
    fn:     (v: TIn) => MaybePromise<Result<TFnSuccess, TFnError>>,
    errVal: TError,
    inputs: Iterable<TIn>
): Promise<Result<TFnSuccess, TError>>;

// Curried (point-free) form.
export function chooseFirstAsync<TIn, TFnSuccess, TFnError, TError>(
    fn:     (v: TIn) => MaybePromise<Result<TFnSuccess, TFnError>>,
    errVal: TError
): (inputs: Iterable<TIn>) => Promise<Result<TFnSuccess, TError>>;

export function chooseFirstAsync(...args: Array<unknown>): unknown {
    return dispatchLast(
        3,
        args,
        async (
            fn: (v: unknown) => MaybePromise<Result<unknown, unknown>>,
            errVal: unknown,
            inputs: Iterable<unknown>
        ) => {
            for (const curInput of inputs) {
                const res = await fn(curInput);
                if (res.succeeded) {
                    return res;
                }
            }
            // If we got here, none of the inputs produced a successful Result.
            return new FailedResult(errVal);
        }
    );
}
