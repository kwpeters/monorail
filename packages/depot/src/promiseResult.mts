/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable max-len */


import * as _ from "lodash-es";
import { FailedResult, Result, SucceededResult } from "./result.mjs";
import { type IIndexedItem } from "./utilityTypes.mjs";
import { errorToString } from "./errorHelpers.mjs";


////////////////////////////////////////////////////////////////////////////////
// Promise<Result<>> Utility Types


// The following types extract the successful and error types from a Result.
// Since Result is a union, distributivity must be turned off.  See this post:
// https://stackoverflow.com/a/69164888
export type PromiseResultSuccessType<T> = [T] extends [Promise<Result<infer X, infer __Y>>] ? X : never;
export type PromiseResultErrorType<T> = [T] extends [Promise<Result<infer __X, infer Y>>] ? Y : never;

export type AllSuccessTypes<T extends {[n: string]: Promise<Result<unknown, unknown>>; }> = {
    [P in keyof T]: PromiseResultSuccessType<T[P]>
};

export type AllErrorTypes<T extends {[n: string]: Promise<Result<unknown, unknown>>; }> = {
    [P in keyof T]: PromiseResultErrorType<T[P]>
};

export type PossibleErrors<T extends { [n: string]: Promise<Result<unknown, unknown>>; }> = AllErrorTypes<T>[keyof AllErrorTypes<T>];



/**
 * Export a namespace similar to what is done for Result.
 */
export namespace PromiseResult {


    /**
     * If the input Result is successful, invokes _fn_ with the value.  If a
     * successful Result is returned, the original input value is augmented with
     * the value.  Augment is a lot like bind(), except it automatically
     * includes all of the input's properties.  It can also serve as a reality
     * check or gate when augmenting no additional properties.
     *
     * @param fn - Function that will be invoked if the input Result is
     * successful.  Returns a Result.  If successful, the properties will be
     * added to _input_ and returned as a successful Result.
     * @param input - The input Result
     * @returns An error if the input is an error or _fn_ returns an error.
     * Otherwise, a successful Result containing all properties of the original
     * input and the value returned by _fn_.
     */
    export async function augment<TInputSuccess, TInputError, TFnSuccess, TFnError>(
        fn: (input: TInputSuccess) => Promise<Result<TFnSuccess, TFnError>>,
        input: Result<TInputSuccess, TInputError>
    ): Promise<Result<TInputSuccess & TFnSuccess, TInputError | TFnError>> {

        if (input.failed) {
            return input;
        }

        // The input is a successful Result.
        const fnRes = await fn(input.value);
        if (fnRes.failed) {
            // _fn_ has errored.  Return that error.
            return fnRes;
        }

        // _fn_ has succeeded.  Return an object containing all properties of
        // the original input and the value returned by _fn_.
        const augmented = { ...input.value, ...fnRes.value };
        return new SucceededResult(augmented);
    }


    /**
     * Converts a Promise<Result<>> to a Promise.
     *
     * @param pr - The Promise<Result<>> to be converted.
     * @return Either a resolved promise or a rejected promise based on the input
     */
    export async function toPromise<TSuccess, TError>(
        pr: Promise<Result<TSuccess, TError>>
    ): Promise<TSuccess> {
        const result = await pr;
        return result.succeeded ?
            Promise.resolve(result.value) :
            Promise.reject(result.error);
    }


    /**
     * Finds the first successful Result in the input collection.  The input
     * Results can optionally be asynchronous.
     *
     * @param inputResults - The Results to be searched
     * @return The first successful Result found is returned immediately.  If
     *  all Results are failures a failure Result is returned wrapping an array
     *  of all the errors.
     */
    export async function firstSuccess<TSuccess, TError>(
        inputResults: Iterable<Result<TSuccess, TError> | Promise<Result<TSuccess, TError>>>
    ): Promise<Result<TSuccess, Array<TError>>> {

        const errors = [] as Array<TError>;
        for (const curInput of inputResults) {
            const res = await Promise.resolve(curInput);
            if (res.succeeded) {
                return res;
            }
            else {
                errors.push(res.error);
            }
        }
        // If we got here, all inputs were failures.
        return new FailedResult(errors);
    }


    /**
     * Finds the first failure Result in the input collection.  The input
     * Results can optionally be asynchronous.
     *
     * @param inputResults - The Results to be searched
     * @return If a failure Result is found, a successful Result is returned
     * wrapping the error.  If all inputs are successful, a failure Result is
     * returned wrapping an array of the success values.
     */
    export async function firstError<TSuccess, TError>(
        inputResults: Iterable<Result<TSuccess, TError> | Promise<Result<TSuccess, TError>>>
    ): Promise<Result<TError, Array<TSuccess>>> {

        const successVals = [] as Array<TSuccess>;
        for (const curInput of inputResults) {
            const res = await Promise.resolve(curInput);
            if (res.failed) {
                return new SucceededResult(res.error);
            }
            else {
                successVals.push(res.value);
            }
        }
        // If we got here, all inputs were successful.
        return new FailedResult(successVals);
    }


    /**
     * Converts a Promise into a Promise<Result<>> that will always resolve with a
     * Result.
     *
     * @param promise - The input Promise
     * @returns A Promise that will always resolve with a Result.  Resolved promises
     * yield a successful Result and rejections yield a failure Result containing a
     * string error message.
     */
    export function fromPromise<TSuccess>(
        promise: Promise<TSuccess>
    ): Promise<Result<TSuccess, string>> {
        return promise.then(
            (val) => {
                return new SucceededResult(val);
            },
            (err) => {
                return new FailedResult(errorToString(err));
            }
        );
    }


    /**
     * Converts a Promise into a Promise<Result<>> that will always resolve with a
     * Result and rejections will be mapped through the specified function.
     *
     * @param promise - The input Promise
     * @param errMapFn - A function that will convert a rejection error to the
     * Result's failure type.
     * @returns A Promise that will always resolve with a Result.  Resolved promises
     * yield a successful Result and rejections yield a failure Result.
     */
    export function fromPromiseWith<TSuccess, TError>(
        promise: Promise<TSuccess>,
        errMapFn: (err: unknown) => TError
    ): Promise<Result<TSuccess, TError>> {
        return promise.then(
            (val) => {
                return new SucceededResult(val);
            },
            (err: unknown) => {
                const mappedErr = errMapFn(err);
                return new FailedResult(mappedErr);
            }
        );
    }


    /**
     * Checks if all input Promise<Result<>> objects resolve with successful
     * Results.
     *
     * @param namedPromiseResults - An object where the keys are strings and the
     * values are Promise<Result<>> objects.
     * @return If all Promise<Result<>> objects resolve with successful Results,
     * a successful Result wrapping an object having the same keys and the
     * values are the unwrapped success values. Otherwise, the first failure Result is
     * returned.
     */
    export async function allObj<T extends {[n: string]: Promise<Result<unknown, unknown>>}>(
        namedPromiseResults: T
    ): Promise<Result<AllSuccessTypes<T>, PossibleErrors<T>>> {
        const promises = Object.values(namedPromiseResults);
        const res = await PromiseResult.allArrayM(promises);
        if (res.succeeded) {
            // All were successful.  Return an object of the success result values.
            const successObj = {} as {[n: string]: unknown};
            const keys = Object.keys(namedPromiseResults);
            for (let curIdx = 0; curIdx < keys.length; curIdx++) {
                successObj[keys[curIdx]!] = res.value[curIdx];
            }
            return new SucceededResult(successObj as AllSuccessTypes<T>);
        }
        else {
            // There was a failure.
            const err = res.error.item as PossibleErrors<T>;
            return new FailedResult(err);
        }
    }


    ////////////////////////////////////////////////////////////////////////////
    // allM()
    ////////////////////////////////////////////////////////////////////////////
    export async function allM<TSA, TFA>(
        a: Promise<Result<TSA, TFA>>
    ): Promise<Result<
        [TSA], IIndexedItem<TFA>
    >>;

    export async function allM<TSA, TFA, TSB, TFB>(
        a: Promise<Result<TSA, TFA>>,
        b: Promise<Result<TSB, TFB>>
    ): Promise<Result<
        [TSA, TSB],
        IIndexedItem<TFA | TFB>
    >>;

    export async function allM<TSA, TFA, TSB, TFB, TSC, TFC>(
        a: Promise<Result<TSA, TFA>>,
        b: Promise<Result<TSB, TFB>>,
        c: Promise<Result<TSC, TFC>>
    ): Promise<Result<
        [TSA, TSB, TSC],
        IIndexedItem<TFA | TFB | TFC>
    >>;

    export async function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD>(
        a: Promise<Result<TSA, TFA>>,
        b: Promise<Result<TSB, TFB>>,
        c: Promise<Result<TSC, TFC>>,
        d: Promise<Result<TSD, TFD>>
    ): Promise<Result<
        [TSA, TSB, TSC, TSD],
        IIndexedItem<TFA | TFB | TFC | TFD>
    >>;

    export async function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE>(
        a: Promise<Result<TSA, TFA>>,
        b: Promise<Result<TSB, TFB>>,
        c: Promise<Result<TSC, TFC>>,
        d: Promise<Result<TSD, TFD>>,
        e: Promise<Result<TSE, TFE>>
    ): Promise<Result<
        [TSA, TSB, TSC, TSD, TSE],
        IIndexedItem<TFA | TFB | TFC | TFD | TFE>
    >>;

    export async function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE, TSF, TFF>(
        a: Promise<Result<TSA, TFA>>,
        b: Promise<Result<TSB, TFB>>,
        c: Promise<Result<TSC, TFC>>,
        d: Promise<Result<TSD, TFD>>,
        e: Promise<Result<TSE, TFE>>,
        f: Promise<Result<TSF, TFF>>
    ): Promise<Result<
        [TSA, TSB, TSC, TSD, TSE, TSF],
        IIndexedItem<TFA | TFB | TFC | TFD | TFE | TFF>
    >>;

    export async function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE, TSF, TFF, TSG, TFG>(
        a: Promise<Result<TSA, TFA>>,
        b: Promise<Result<TSB, TFB>>,
        c: Promise<Result<TSC, TFC>>,
        d: Promise<Result<TSD, TFD>>,
        e: Promise<Result<TSE, TFE>>,
        f: Promise<Result<TSF, TFF>>,
        g: Promise<Result<TSG, TFG>>
    ): Promise<Result<
        [TSA, TSB, TSC, TSD, TSE, TSF, TSG],
        IIndexedItem<TFA | TFB | TFC | TFD | TFE | TFF | TFG>
    >>;

    export async function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE, TSF, TFF, TSG, TFG, TSH, TFH>(
        a: Promise<Result<TSA, TFA>>,
        b: Promise<Result<TSB, TFB>>,
        c: Promise<Result<TSC, TFC>>,
        d: Promise<Result<TSD, TFD>>,
        e: Promise<Result<TSE, TFE>>,
        f: Promise<Result<TSF, TFF>>,
        g: Promise<Result<TSG, TFG>>,
        h: Promise<Result<TSH, TFH>>
    ): Promise<Result<
        [TSA, TSB, TSC, TSD, TSE, TSF, TSG, TSH],
        IIndexedItem<TFA | TFB | TFC | TFD | TFE | TFF | TFG | TFH>
    >>;

    export async function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE, TSF, TFF, TSG, TFG, TSH, TFH, TSI, TFI>(
        a: Promise<Result<TSA, TFA>>,
        b: Promise<Result<TSB, TFB>>,
        c: Promise<Result<TSC, TFC>>,
        d: Promise<Result<TSD, TFD>>,
        e: Promise<Result<TSE, TFE>>,
        f: Promise<Result<TSF, TFF>>,
        g: Promise<Result<TSG, TFG>>,
        h: Promise<Result<TSH, TFH>>,
        i: Promise<Result<TSI, TFI>>
    ): Promise<Result<
        [TSA, TSB, TSC, TSD, TSE, TSF, TSG, TSH, TSI],
        IIndexedItem<TFA | TFB | TFC | TFD | TFE | TFF | TFG | TFH | TFI>
    >>;

    export async function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE, TSF, TFF, TSG, TFG, TSH, TFH, TSI, TFI,
                              TSJ, TFJ>(
        a: Promise<Result<TSA, TFA>>,
        b: Promise<Result<TSB, TFB>>,
        c: Promise<Result<TSC, TFC>>,
        d: Promise<Result<TSD, TFD>>,
        e: Promise<Result<TSE, TFE>>,
        f: Promise<Result<TSF, TFF>>,
        g: Promise<Result<TSG, TFG>>,
        h: Promise<Result<TSH, TFH>>,
        i: Promise<Result<TSI, TFI>>,
        j: Promise<Result<TSJ, TFJ>>
    ): Promise<Result<
        [TSA, TSB, TSC, TSD, TSE, TSF, TSG, TSH, TSI, TSJ],
        IIndexedItem<TFA | TFB | TFC | TFD | TFE | TFF | TFG | TFH | TFI | TFJ>
    >>;

    //
    // Implementation
    //
    export function allM(
        ...promises: Array<Promise<Result<unknown, unknown>>>
    ): Promise<Result<Array<unknown>, IIndexedItem<unknown>>> {
        return allArrayM<unknown, unknown>(promises);
    }


    /**
     * Checks to see if all input Promise<Result<>> objects resolve successfully.
     * Returns all failures (the "A" stands for "applicative").
     *
     * @param promises - The input array of Promise<Result<>>s
     * @returns  If all input Promises resolve with successful Results, a successful
     * Result containing an array of those successful values.  Otherwise, a failure
     * Result is returned containing information about each failure.
     */
    export async function allArrayA<TSuccess, TError>(
        promises: Array<Promise<Result<TSuccess, TError>>>
    ): Promise<Result<Array<TSuccess>, Array<IIndexedItem<TError>>>> {
        let results: Array<Result<TSuccess, TError>>;
        try {
            results = await Promise.all(promises);
        }
        catch (err) {
            // This should never happen, because failure is supposed to be
            // communicated with a Promise that *resolves* (not rejects) with a
            // failed Result object.  See promiseResult.forceResult() for a way to
            // wrap a Promise<Result<>> so that it never rejects.
            const errMsg = `Promise for Result unexpectedly rejected. ${errorToString(err)}`;
            throw new Error(errMsg);
        }

        if (results.every((res) => res.succeeded)) {
            // Return a successful Result wrapping all of the successful values.
            return new SucceededResult(results.map((res) => res.value));
        }
        else {
            // Returns a failure Result wrapping an array of IIndexedItems
            // referencing each error.
            const failures = results.reduce<Array<IIndexedItem<TError>>>(
                (acc, res, idx) => {
                    if (res.failed) {
                        acc.push({
                            index: idx,
                            item:  res.error
                        });
                    }
                    return acc;
                },
                []
            );
            return new FailedResult(failures);
        }
    }


    /**
     * Checks to see if all input Promise<Result<>> objects resolve successfully.
     * Returns the first failure as soon as possible upon any failure (the "M"
     * stands for "monadic").
     *
     * This function accepts the inputs as an array.  This has the advantage that
     * higher order functions can be used to create the array (i.e. _.map()), but
     * has the disadvantage that there can only be one Result success type and one
     * Result failure type.
     *
     * @param promises - The input array of Promise<Result<>>s.
     * @return If all input Promises resolve with successful Results, a successful
     * Result containing an array of those successful values.  Otherwise, a failure
     * Result is returned as soon as possible containing information about the first
     * error.
     */
    export function allArrayM<TSuccess, TError>(
        promises: Array<Promise<Result<TSuccess, TError>>>
    ): Promise<Result<Array<TSuccess>, IIndexedItem<TError>>> {

        if (promises.length === 0) {
            return Promise.resolve(new SucceededResult([]));
        }

        return new Promise((resolve, reject) => {
            const numPromises = promises.length;
            let numSuccesses = 0;
            const successfulResults: Array<TSuccess> = [];
            void _.forEach(promises, (curPromise, index) => {
                curPromise
                .then((curResult) => {
                    if (curResult.succeeded) {
                        // The current async operation succeeded.
                        successfulResults[index] = curResult.value;
                        numSuccesses++;

                        // If this is the last successful async operation, resolve
                        // with an array of all the success values.  Otherwise, keep
                        // waiting.
                        if (numSuccesses === numPromises) {
                            resolve(new SucceededResult(successfulResults));
                        }
                    }
                    else {
                        // It failed.  Return the failed result immediately.
                        const indexed: IIndexedItem<TError> = {
                            index: index,
                            item:  curResult.error
                        };
                        resolve(new FailedResult(indexed));
                    }
                })
                .catch((err) => {
                    // This should never happen, because failure is supposed to be
                    // communicated with a Promise that *resolves* (not rejects) with
                    // a failed Result object. See promiseResult.forceResult() for a
                    // way to wrap a Promise<Result<>> so that it never rejects.
                    const errMsg = `Promise for Result unexpectedly rejected. ${errorToString(err)}`;
                    reject(new Error(errMsg));
                });
            });
        });
    }


    /**
     * Awaits the input Result.  If successful, unwraps the value and passes it into
     * _fn_, returning its Result or Promise<Result>.  If the input was not
     * successful, returns it.
     *
     * @param fn - The function to invoke when the input is successful.
     * @param input - The input Result or Promise<Result>
     * @returns Either the passed through failure Result or the Result returned from
     * _fn_.
     */
    export async function bind<TInSuccess, TOutSuccess, TError>(
        fn: (x: TInSuccess) => Result<TOutSuccess, TError> | Promise<Result<TOutSuccess, TError>>,
        input: Result<TInSuccess, TError> | Promise<Result<TInSuccess, TError>>
    ): Promise<Result<TOutSuccess, TError>> {
        const awaitedInputRes = await Promise.resolve(input);
        if (awaitedInputRes.succeeded) {
            // Execute the specified fn.
            const output = fn(awaitedInputRes.value);
            return output;
        }
        else {
            return awaitedInputRes;
        }
    }


     /**
      * If _input_ is successful, invokes _fn_ with the value.  If a successful
      * Result is returned, the original _input_ is returned.
      *
      * @param fn - Function that is invoked to determine whether the original
      *  successful input is returned.  If this function returns a failure, that
      *  failed Result is returned.
      * @param input - The input PromiseResult
      * @return _input_ is returned if it is a failed Result.  Otherwise, if _fn_
      * is successful, _input_ is returned.  If _fn_ is a failure, that failed
      * result is returned.
      */
    export async function gate<TInSuccess, TInError, TOutSuccess, TOutError>(
        fn: (successVal: TInSuccess) => Result<TOutSuccess, TOutError> | Promise<Result<TOutSuccess, TOutError>>,
        input: Result<TInSuccess, TInError> | Promise<Result<TInSuccess, TInError>>
    ): Promise<Result<TInSuccess, TInError | TOutError>> {
        const awaitedInputRes = await Promise.resolve(input);

        if (awaitedInputRes.failed) {
            return input;
        }

        const resGate = await Promise.resolve(fn(awaitedInputRes.value));
        return resGate.succeeded ?
            input :
            resGate;
    }


    /**
     * If _input_ is an error, unwraps the error and passes it into _fn_,
     * returning its returned Result.  If _input_ is successful, returns it.
     *
     * This function effectively allows you to "fallback" if a previous
     * operation errored.
     *
     * @param fn - The function to invoke when _input_ is an error.  It is
     * passed the error.
     * @param input - The input Result.
     * @return Either the passed-through successful Result or the Result
     * returned from _fn_.
     */
    export async function bindError<TInSuccess, TInError, TOutSuccess, TOutError>(
        fn: (err: TInError) => Result<TOutSuccess, TOutError> | Promise<Result<TOutSuccess, TOutError>>,
        input: Result<TInSuccess, TInError> | Promise<Result<TInSuccess, TInError>>
    ): Promise<Result<TInSuccess | TOutSuccess, TOutError>> {
        const awaitedInputRes = await Promise.resolve(input);
        if (awaitedInputRes.succeeded) {
            return awaitedInputRes;
        }
        else {
            // Execute the specified fn.
            const output = fn(awaitedInputRes.error);
            return output;
        }
    }


    /**
     * Awaits the input Result.  If failure, maps the error using _fn_ (the mapping
     * may also be async).  When the input is a successful Result, it is returned.
     * Note:  If using pipeAsync(), you can use Result.mapError() instead.
     *
     * @param fn - Error mapping function that is invoked when the input is an error
     * @param input - The input Result or Promise<Result>
     * @returns Either the successful Result or the mapped error Result.
     */
    export async function mapError<TInSuccess, TInError, TOutError>(
        fn: (x: TInError) => TOutError | Promise<TOutError>,
        input: Result<TInSuccess, TInError> | Promise<Result<TInSuccess, TInError>>
    ): Promise<Result<TInSuccess, TOutError>> {
        const awaitedInputRes = await Promise.resolve(input);
        if (awaitedInputRes.failed) {
            const outErr = await Promise.resolve(fn(awaitedInputRes.error));
            return new FailedResult(outErr);
        }
        else {
            return awaitedInputRes;
        }
    }


    /**
     * Awaits the input Result.  If successful, maps its value using _fn_ (the
     * mapping may also be async).  When the input is a failed Result, it is
     * returned.  Note:  If using pipeAsync(), you can use Result.mapSuccess()
     * instead.
     *
     * @param fn - Success mapping function that is invoked when the input is
     * successful
     * @param input - The input Result or Promise<Result>
     * @returns Either the mapped successful Promise<Result> or the passed-through
     * failure Result or Promise<Result>.
     */
    export async function mapSuccess<TInSuccess, TOutSuccess, TError>(
        fn: (x: TInSuccess) => TOutSuccess | Promise<TOutSuccess>,
        input: Result<TInSuccess, TError> | Promise<Result<TInSuccess, TError>>
    ): Promise<Result<TOutSuccess, TError>> {
        const awaitedInputRes = await Promise.resolve(input);
        if (awaitedInputRes.succeeded) {
            const outVal = await Promise.resolve(fn(awaitedInputRes.value));
            return new SucceededResult(outVal);
        }
        else {
            return awaitedInputRes;
        }
    }


    /**
     * Performs side-effects when the specified Result is a failure
     *
     * @param fn - The function to invoke, passing the failed Result's error
     * @param input - The input Result
     * @returns The original input Result
     */
    export async function tapError<TSuccess, TError>(
        fn: (val: TError) => unknown,
        input: Result<TSuccess, TError>
    ): Promise<Result<TSuccess, TError>> {
        if (input.failed) {
            await fn(input.error);
        }
        return input;
    }


    /**
     * Performs side-effects when the specified Result is successful
     *
     * @param fn - The function to invoke, passing the successful Result's value
     * @param input - The input Result
     * @returns The original input Result
     */
    export async function tapSuccess<TSuccess, TError>(
        fn: (val: TSuccess) => unknown,
        input: Result<TSuccess, TError>
    ): Promise<Result<TSuccess, TError>> {
        if (input.succeeded) {
            await fn(input.value);
        }
        return input;
    }


    /**
     * Forces a Promise<Result<>> to always resolve (and never reject) with a
     * Result<>.
     *
     * @param pr - The input Promise<Result<>> that may reject
     * @returns A Promise that will always resolve with a Result.
     */
    export async function forceResult<TSuccess, TError>(
        pr: Promise<Result<TSuccess, TError>> | Result<TSuccess, TError>
    ): Promise<Result<TSuccess, TError | string>> {
        return Promise.resolve(pr)
        .catch((err) => {
            return new FailedResult(errorToString(err));
        });
    }

}
