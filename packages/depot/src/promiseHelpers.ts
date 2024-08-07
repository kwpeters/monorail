import {random, chain, partition, map} from "lodash-es";


/**
 * A task is any operation that can be started (i.e. called) which completes at
 * some point in the future.
 */
export type Task<TResolve> = () => Promise<TResolve>;


/**
 * Runs a sequence of functions in order with each returned value feeding into
 * the parameter of the next.
 *
 * @param tasks - The functions to execute in sequence.  Each function will
 * receive 1 parameter, the return value of the previous function.  A function
 * should throw an exception if it wishes to terminate the sequence and reject
 * the returned promise.
 * @param initialValue - The value that will be passed into the first function.
 * @returns A promise that will be resolved with the return value
 * of the last function.
 */
export function sequence(
    tasks: Array<(previousValue: unknown) => unknown>,
    initialValue: unknown
): Promise<unknown> {
    return tasks.reduce(
        (accumulator, curTask) => {
            const newAcc = accumulator.then(curTask);
            return newAcc;
        },
        Promise.resolve(initialValue)
    );
}


/**
 * Gets a Promise that will resolve with resolveValue after the specified number
 * of milliseconds.
 *
 * @param ms - The number of milliseconds to delay before the Promise will be
 * resolved.
 * @param resolveValue - The value the Promise will be resolved with.
 * @returns A Promise that will be resolved with the specified value
 * after the specified delay
 */
export function getTimerPromise<TResolve>(
    ms:            number,
    resolveValue:  TResolve
): Promise<TResolve> {
    return new Promise(
        (resolve: (resolveValue: TResolve) => void) => {
            setTimeout(
                () => {
                    resolve(resolveValue);
                },
                ms
            );
        }
    );
}


/**
 * Gets a Promise that will reject after the specified number of milliseconds.
 *
 * @param ms - The number of milliseconds to delay before the returned Promise
 * will reject.
 * @param err - The rejection value
 * @return A Promise that will reject with the specified value after the
 * specified delay.
 */
export function getDelayedRejection(ms: number, err: unknown): Promise<never> {
    return new Promise((resolve, reject) => {
        setTimeout(() => reject(err), ms);
    });
}


/**
 * Invokes a task only when a condition is true.
 *
 * @param condition - The condition that controls whether the task is run
 * @param task - The task that is run when `condition` is truthy
 * @param falseResolveValue - The value the returned promise will resolve with
 * when `condition` is falsy.
 * @return When `condition` is true, a promise that resolves with the result of
 * `task`.  When `condition` is false, a promise that resolves with
 * `falseResolveValue`.
 */
export function conditionalTask<TResolve>(
    condition: unknown,
    task: Task<TResolve>,
    falseResolveValue: TResolve
): Promise<TResolve> {
    if (condition) {
        return task();
    }
    else {
        return Promise.resolve(falseResolveValue);
    }
}




/**
 * Adapts a promise-returning function into a promise-returning function that
 * will retry the operation up to `maxNumAttempts` times before rejecting.
 * Retries are performed using exponential back off.
 *
 * @param theFunc - The promise-returning function that will be retried multiple
 * times
 *
 * @param maxNumAttempts - The maximum number of times to invoke theFunc before
 * rejecting the returned Promise.  This argument should always be greater than
 * or equal to 1.  If it is not, theFunc will be tried only once.
 *
 * @returns A Promise that will be resolved immediately (with the same
 * value) when the promise returned by the Func resolves.  If the Promise
 * returned by theFunc rejects, it will be retried up to `maxNumAttempts`
 * invocations.  If the Promise returned by the last invocation of theFunc
 * rejects, the returned Promise will be rejected with the same value.
 */
export function retry<TResolve>(
    theFunc:         () => Promise<TResolve>,
    maxNumAttempts:  number
): Promise<TResolve> {
    return retryWhileImpl(theFunc, () => true, maxNumAttempts, 0);
}


/**
 * Adapts a promise-returning function into a promise-returning function that
 * will continue to retry the operation as long as whilePredicate returns true
 * up to `maxNumAttempts` attempts before rejecting.  Retries are performed using
 * exponential back off.
 *
 * @param theFunc - The promise-returning function that will be retried multiple
 * times
 *
 * @param whilePredicate - A function that determines whether the operation
 * should continue being retried.  This function takes the value returned by the
 * last rejection and returns true if retrying should continue or false otherwise.
 *
 * @param maxNumAttempts - The maximum number of times to invoke theFunc before
 * rejecting the returned Promise.  This argument should always be greater than
 * or equal to 1.  If it is not, theFunc will be tried only once.
 *
 * @returns A Promise that will be resolved immediately (with the same
 * value) when the promise returned by the Func resolves.  If the Promise
 * returned by theFunc rejects, it will be retried up to `maxNumAttempts`
 * invocations.  If the Promise returned by the last invocation of theFunc
 * rejects, the returned Promise will be rejected with the same value.
 */
export function retryWhile<TResolve>(
    theFunc: () => Promise<TResolve>,
    whilePredicate: (err: unknown) => boolean,
    maxNumAttempts: number
): Promise<TResolve> {
    return retryWhileImpl(theFunc, whilePredicate, maxNumAttempts, 0);
}

/**
 * The value that will be multiplied by successively higher powers of 2 when
 * calculating delay time during exponential back off.
 */
const BACKOFF_MULTIPLIER = 20;


/**
 * Recursive implementation of retryWhile(), allowing for additional
 * implementation specific arguments.
 *
 * @param theFunc - The operation to perform
 * @param whilePredicate - Predicate that determines whether to retry
 * @param maxNumAttempts - Maximum number of invocations of theFunc
 * @param attemptsSoFar - Number of theFunc invocations so far
 * @returns The Promise returned to the client
 */
function retryWhileImpl<TResolve>(
    theFunc:         () => Promise<TResolve>,
    whilePredicate:  (err: unknown) => boolean,
    maxNumAttempts:  number,
    attemptsSoFar:   number
): Promise<TResolve> {
    return new Promise(
        (resolve: (value: TResolve|Promise<TResolve>) => void, reject: (err: unknown) => void) => {
            ++attemptsSoFar;
            theFunc()
            .then(
                (value: TResolve) => {
                    // The current iteration resolved.  Return the value to the client
                    // immediately.
                    resolve(value);
                },
                (err: unknown): void => {
                    // The promise was rejected.
                    if (attemptsSoFar >= maxNumAttempts) {
                        // logger.error("Retry operation failed after " + maxNumAttempts + " attempts.");
                        reject(err);
                    }
                    else if (!whilePredicate(err)) {
                        // logger.error("Stopped retrying operation because while predicate returned false." + err);
                        reject(err);
                    }
                    else {
                        const backoffBaseMs: number = Math.pow(2, attemptsSoFar - 1) * BACKOFF_MULTIPLIER;

                        // A random amount of time should be added to or
                        // subtracted from the base so that multiple retries
                        // don't get stacked on top of each other, making
                        // the congestion even worse.  This random range
                        // should be either the multiplier or 25% of the
                        // calculated base, whichever is larger.

                        const randomHalfRange: number = Math.max(BACKOFF_MULTIPLIER, 0.25 * backoffBaseMs);
                        const randomMs: number = random(-1 * randomHalfRange, randomHalfRange);
                        const delayMs: number = backoffBaseMs + randomMs;

                        // logger.info("Failed. Queuing next attempt in " + backoffBaseMs + " + " + randomMs + " (" + delayMs + ") ms\n");
                        const timerPromise: Promise<void> = getTimerPromise(delayMs, undefined);
                        resolve(
                            timerPromise
                            .then(() => {
                                return retryWhileImpl(theFunc, whilePredicate, maxNumAttempts, attemptsSoFar);
                            })
                        );
                    }
                }
            );
        }
    );
}


/**
 * A promise version of a while() {} loop
 *
 * @param predicate - A predicate that will be invoked before each iteration of
 * body.  Iteration will stop when this function returns false.
 * @param body - A promise returning function that will be invoked for each
 * iteration.  This function is responsible for making predicate eventually return false.
 * @returns A Promise that is resolved when all iterations have
 * successfully completed or will be rejected when body returns a rejected promise.
 */
export function promiseWhile(predicate: () => boolean, body: Task<void>): Promise<void> {
    return new Promise<void>((resolve: () => void, reject: () => void) => {
        function loop(): void {
            if (!predicate()) {
                // We are done iterating.  Resolve with a void value.
                return resolve();
            }

            // We are not done iterating.  Invoke body() and execute this loop
            // again when it resolves.  Note: The value returned from body() is
            // wrapped in a promise in case it doesn't return a promise.
            Promise.resolve(body())
            .then(loop, reject);
        }

        // Get things started.  loop() will queue itself to run for further
        // iterations.
        setTimeout(loop, 0);
    });
}


/**
 * Maps an array of Promises to a new same sized array of Promises.  The new
 * array of Promises will settle starting at index 0 and continue through the
 * array sequentially.
 *
 * @param inputPromises - The array of Promises to transform
 * @returns A new array of Promises that will settle sequentially,
 * starting at index 0.
 */
export function sequentialSettle<TResolve>(inputPromises: Array<Promise<TResolve>>): Array<Promise<TResolve>> {
    const outputPromises: Array<Promise<TResolve>> = [];

    inputPromises.forEach((curInputPromise) => {
        const previousPromise: Promise<unknown> = outputPromises.length > 0 ?
                                                  outputPromises[outputPromises.length - 1]! :
                                                  Promise.resolve();

        const promise: Promise<TResolve> = delaySettle(curInputPromise, previousPromise);
        outputPromises.push(promise);
    });

    return outputPromises;
}


/**
 * Returns a promise that wraps thePromise, but will be resolved or rejected
 * after the resolution or rejection of waitFor.
 *
 * @param thePromise - the Promise to be wrapped/delayed
 * @param waitFor - The Promise that must be settled before the returned promise
 * will settle.
 * @returns A Promise wrapping thePromise, but will be settled after waitFor is
 * settled
 */
export function delaySettle<TResolve>(
    thePromise: Promise<TResolve>,
    waitFor:    Promise<unknown>
): Promise<TResolve> {
    return thePromise
    .then((result: TResolve) => {
        // Whether waitFor resolved or rejected, we should resolve
        // with the original resolved value.
        return waitFor
        .then(() => result)
        .catch(() => result);
    })
    .catch((err: unknown) => {
        // Whether waitFor resolved or rejected, we should reject with the
        // original error.
        return waitFor
        .then(() => { throw err; })
        .catch(() => { throw err; });
    });
}


/**
 * Maps values in `collection` using an async function.  The async function will
 * be invoked for each item in the collection concurrently.  The returned
 * Promise will reject as soon as the first async function rejects.  If none of
 * the async functions reject, an array containing their results is returned.
 *
 * @param collection - The collection of items to iterate over.
 * @param asyncValueFunc - The async mapping function.
 * @return A Promise for an array of the resulting mapped values.
 */
export async function mapAsync<TInput, TOutput>(
    collection:     Array<TInput>,
    asyncValueFunc: (curItem: TInput, index: number, col: Array<TInput>) => Promise<TOutput>
): Promise<Array<TOutput>> {
    const promises = collection.map((curItem, idx, col) => asyncValueFunc(curItem, idx, col));
    const values = await Promise.all(promises);
    return values;
}


/**
 * Augments values in `collection` with the value returned by the specified
 * async function.
 *
 * @param collection - The collection of items to be augmented
 * @param asyncValueFn - The async function that returns the data that will
 *      augment the original data
 * @return A Promise for an array of the augmented items.
 */
export async function augmentAsync<TInput, TAugment>(
    collection:     Array<TInput>,
    asyncValueFn:   (curItem: TInput, idx: number, col: Array<TInput>) => Promise<TAugment> | TAugment
): Promise<Array<TInput & TAugment>> {
    return mapAsync(collection, async (item, idx, col) => {
        const augment = await Promise.resolve(asyncValueFn(item, idx, col));
        return {...item, ...augment};
    });
}


/**
 * Zips values in `collection` into a tuple with the result of calling the async
 * function.
 *
 * @param collection - The collection of items.
 * @param asyncValueFunction - The async function that will be called for each
 * item in the collection.
 * @return A promise for an array of 2-element tuples.  The first item is the
 * item from `collection` and the second item is the resolved value returned
 * from `asyncValueFunction`.
 */
export async function zipWithAsyncValues<TInput, TOutput>(
    collection:     Array<TInput>,
    asyncValueFunc: (curItem: TInput) => Promise<TOutput>
): Promise<Array<[TInput, TOutput]>> {
    const values = await mapAsync(collection, (curItem) => asyncValueFunc(curItem));

    const pairs: Array<[TInput, TOutput]> = [];
    collection.forEach((curItem, index) => {
        pairs.push([curItem, values[index]!]);
    });

    return pairs;
}


/**
 * Filters a collection based on the result of an asynchronous predicate.
 *
 * @param collection - The collection of items.
 * @param asyncPredicate - The async function that will be called for each item
 * in collection.  Returns a truthy or falsy value indicating whether the
 * collection item should be included.
 * @return A promise for an array of collection items for which the async
 * predicate returned a truthy value.
 */
export async function filterAsync<T>(
    collection:     Array<T>,
    asyncPredicate: (curVal: T) => Promise<unknown>
): Promise<Array<T>> {
    const pairs = await zipWithAsyncValues(collection, asyncPredicate);
    return chain(pairs)
    .filter((curPair) => !!curPair[1])
    .map((curPair) => curPair[0])
    .value();
}


/**
 * Reduces a collection based on the results of an asynchronous accumulator
 * function.
 *
 * @param collection - The collection to be reduced
 * @param asyncAccFn - Accumulator function that returns a Promise for the next
 * accumulator value
 * @param acc - The initial value for the accumulator
 * @return Description
 */
export async function reduceAsync<TColItem, TAcc>(
    collection: Array<TColItem>,
    asyncAccFn: (acc: TAcc, curVal: TColItem, curIndex: number, col: Array<TColItem>) => Promise<TAcc>,
    acc: TAcc
): Promise<TAcc> {

    let curIndex = 0;
    for (const curItem of collection) {
        acc = await asyncAccFn(acc, curItem, curIndex, collection);
        curIndex += 1;
    }

    return acc;
}


/**
 * Partitions a collection into two collections based on the result of invoking
 * an asynchronous predicate on each item.
 *
 * @param collection - The collection of items.
 * @param asyncPredicate - The async function that will be called for each item
 * in the collection.  Returns a truthy or falsy value indicating whether the
 * collection belongs in the first array or second array.
 * @return A promise for a 2-item tuple. The first item is an array for which
 * the predicate resolved to a truthy value.  The second item is an array for
 * which the predicate resolved to a falsy value.
 */
export async function partitionAsync<T>(
    collection:     Array<T>,
    asyncPredicate: (curVal: T) => Promise<unknown>
): Promise<[Array<T>, Array<T>]> {
    const pairs = await zipWithAsyncValues(collection, asyncPredicate);

    const [truthyPairs, falsyPairs] = partition(pairs, (curPair) => !!curPair[1]);
    return [
        map(truthyPairs, (curPair) => curPair[0]),
        map(falsyPairs, (curPair) => curPair[0])
    ];

}


/**
 * Removes items from a collection based on the result of an asynchronous predicate.
 *
 * @param collection - The collection of items.
 * @param asyncPredicate - The async function that will be called for each item
 * in collection.  Returns a truthy or falsy value indicating whether the
 * collection item should be removed.
 * @return A promise for an array of collection items that have been removed.
 */
export async function removeAsync<T>(
    collection:     Array<T>,
    asyncPredicate: (curVal: T) => Promise<unknown>
): Promise<Array<T>> {
    const pairs = await zipWithAsyncValues(collection, asyncPredicate);

    const removed: Array<T> = [];
    for (let i = pairs.length - 1; i >= 0; i--) {
        const [item, predicateResult] = pairs[i]!;
        if (predicateResult) {
            // Remove the current item.
            removed.push(item);
            collection.splice(i, 1);
        }
    }

    return removed;
}




/**
 * When given an object with type {[k: string]: Promise<T>}, the following type
 * will give you an object type where the keys are taken from T and the values
 * have their associated resolved type.
 */
export type AllResolveTypes<T extends {[n: string]: Promise<unknown>}> = {
    [P in keyof T]: Awaited<T[P]>
};


/**
 * Accepts an object whose values are Promises.  This method waits for all of
 * them to resolve or the first rejection.  If they all resolve, an object with
 * the same keys is returned and the values are the resolved values.
 *
 * @param namedPromises - An object where the keys are strings and the values
 * are promises.
 * @return If all Promises resolve, the returned Promise will resolve with an
 * object containing their resolved values.  Otherwise, the first rejection is
 * returned.
 */
export function allObj<T extends {[n: string]: Promise<unknown>}>(
    namedPromises: T
): Promise<AllResolveTypes<T>> {
    const promises = Object.values(namedPromises);
    return Promise.all(promises)
    .then(
        (resolvedValues) => {
            const entries =
                Object.keys(namedPromises)
                .map((curKey, idx) => [curKey, resolvedValues[idx]] as [string, unknown]);
            const retObj = Object.fromEntries(entries) as AllResolveTypes<T>;
            return retObj;
        }
    );
}
