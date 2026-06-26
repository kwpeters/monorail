/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
/* eslint-disable max-len */

import * as _ from "lodash-es";
import { dispatchLast } from "./curry.mjs";
import { isIToString } from "./primitives.mjs";
import { NoneOption, Option, SomeOption } from "./option.mjs";
import { inspect } from "./inspect.mjs";


/**
 * Represents a successful result returned from a function.
 */
export class SucceededResult<TSuccess> {

    private readonly _value: TSuccess;

    /**
     * Creates a new SucceededResult instance.
     * @param value - The successful result value
     */
    public constructor(value: TSuccess) {
        this._value = value;
    }

    public readonly succeeded = true;

    public get value(): TSuccess {
        return this._value;
    }

    public readonly failed = false;

    public readonly error = undefined;

    public toString(): string {
        return isIToString(this._value) ?
            `Successful Result (${this._value.toString()})` :
            "Successful Result";
    }


    public augment<TFnSuccess, TFnError>(
        this: SucceededResult<TSuccess & object>,
        fn: (input: TSuccess) => Result<TFnSuccess, TFnError>
    ): Result<TSuccess & TFnSuccess, TFnError> {
        const res = fn(this._value);
        if (res.succeeded) {
            const resRet = {...this._value, ...res.value};
            return new SucceededResult(resRet);
        }
        else {
            return res;
        }
    }


    public async augmentAsync<TFnSuccess, TFnError>(
        this: SucceededResult<TSuccess & object>,
        fn: (input: TSuccess) => Promise<Result<TFnSuccess, TFnError>>
    ): Promise<Result<TSuccess & TFnSuccess, TFnError>> {
        const res = await fn(this._value);
        if (res.succeeded) {
            const resRet = {...this._value, ...res.value};
            return new SucceededResult(resRet);
        }
        else {
            return res;
        }
    }


    public bind<TFnSuccess, TFnError>(
        fn: (input: TSuccess) => Result<TFnSuccess, TFnError>
    ): Result<TFnSuccess, TFnError> {
        const res = fn(this._value);
        return res;
    }


    public bindAsync<TFnSuccess, TFnError>(
        fn: (input: TSuccess) => Promise<Result<TFnSuccess, TFnError>>
    ): Promise<Result<TFnSuccess, TFnError>> {
        const resPromise = fn(this._value);
        return resPromise;
    }


    public bindError<TFnSuccess, TFnError>(
        fn: (err: never) => Result<TFnSuccess, TFnError>
    ): this {
        return this;
    }


    public bindErrorAsync<TFnSuccess, TFnError>(
        fn: (err: never) => Promise<Result<TFnSuccess, TFnError>>
    ): Promise<this> {
        return Promise.resolve(this);
    }


    public defaultValue<TDefault>(
        defaultValue: TDefault
    ): TSuccess {
        return this._value;
    }


    public defaultWith<TDefault>(
        fn: (err: never) => TDefault
    ): TSuccess {
        return this._value;
    }


    public defaultWithAsync<TDefault>(
        fn: (err: never) => Promise<TDefault>
    ): Promise<TSuccess> {
        return Promise.resolve(this._value);
    }


    public gate<TFnSuccess, TFnError>(
        fn: (successVal: TSuccess) => Result<TFnSuccess, TFnError>
    ): Result<TSuccess, TFnError> {
        const res = fn(this._value);
        return res.succeeded ? this : res;
    }


    public async gateAsync<TFnSuccess, TFnError>(
        fn: (successVal: TSuccess) => Promise<Result<TFnSuccess, TFnError>>
    ): Promise<Result<TSuccess, TFnError>> {
        const res = await fn(this._value);
        return res.succeeded ? this : res;
    }


    public mapError<TMappedError>(
        fn: (err: never) => TMappedError
    ): this {
        return this;
    }


    public mapErrorAsync<TMappedError>(
        fn: (err: never) => Promise<TMappedError>
    ): Promise<this> {
        return Promise.resolve(this);
    }


    public mapSuccess<TMappedSuccess>(
        fn: (successVal: TSuccess) => TMappedSuccess
    ): SucceededResult<TMappedSuccess> {
        const mappedVal = fn(this._value);
        return new SucceededResult(mappedVal);
    }


    public async mapSuccessAsync<TMappedSuccess>(
        fn: (successVal: TSuccess) => Promise<TMappedSuccess>
    ): Promise<SucceededResult<TMappedSuccess>> {
        const mappedVal = await fn(this._value);
        return new SucceededResult(mappedVal);
    }


    public match<TSuccessOut, TErrorOut = never>(
        fnSuccess: (val: TSuccess) => TSuccessOut,
        fnError: (err: never) => TErrorOut
    ): TSuccessOut {
        const out = fnSuccess(this._value);
        return out;
    }


    public matchWith<TSuccessOut, TErrorOut = never>(
        matcherFns: {success: (val: TSuccess) => TSuccessOut, error: (err: never) => TErrorOut}
    ): TSuccessOut {
        const out = matcherFns.success(this._value);
        return out;

    }


    public matchWithAsync<TSuccessOut, TErrorOut = never>(
        matcherFns: {success: (val: TSuccess) => Promise<TSuccessOut>, error: (err: never) => Promise<TErrorOut>}
    ): Promise<TSuccessOut> {
        return matcherFns.success(this._value);
    }


    public tap(
        fn: (res: SucceededResult<TSuccess>) => unknown
    ): this {
        fn(this);
        return this;
    }


    public async tapAsync(
        fn: (res: SucceededResult<TSuccess>) => Promise<unknown>
    ): Promise<this> {
        await fn(this);
        return this;
    }


    public tapError(
        fn: (err: never) => unknown
    ): this {
        return this;
    }


    public tapErrorAsync(
        fn: (err: never) => Promise<unknown>
    ): Promise<this> {
        return Promise.resolve(this);
    }


    public tapSuccess(
        fn: (val: TSuccess) => unknown
    ): this {
        fn(this._value);
        return this;
    }


    public async tapSuccessAsync(
        fn: (val: TSuccess) => Promise<unknown>
    ): Promise<this> {
        await fn(this._value);
        return this;
    }


    public throwIfFailed(): TSuccess {
        return this._value;
    }


    public throwIfFailedWith(errorMsg: string): TSuccess;
    public throwIfFailedWith(errorMapFn: (error: never) => string): TSuccess;
    public throwIfFailedWith(errorMsgOrFn: string | ((error: never) => string)): TSuccess;
    public throwIfFailedWith(errorMsgOrFn: string | ((error: never) => string)): TSuccess {
        return this._value;
    }


    public throwIfSucceeded(): never {
        const errMsg = inspect(this._value);
        throw new Error(errMsg);
    }


    public throwIfSucceededWith(successMsg: string): never;
    public throwIfSucceededWith(successMapFn: (val: TSuccess) => string): never;
    public throwIfSucceededWith(successMsgOrFn: string | ((val: TSuccess) => string)): never;
    public throwIfSucceededWith(successMsgOrFn: string | ((val: TSuccess) => string)): never {
        const msg = typeof successMsgOrFn === "string" ?
            successMsgOrFn :
            successMsgOrFn(this._value);
        throw new Error(msg);
    }


    public toNullable<TNullish extends undefined | null>(nullishValue: TNullish): TSuccess {
        return this._value;
    }


    public toOption(): Option<TSuccess> {
        return new SomeOption(this._value);
    }
}


export class FailedResult<TError> {

    private readonly _error: TError;

    public constructor(error: TError) {
        this._error = error;
    }


    public readonly succeeded = false;


    public readonly value = undefined;


    public readonly failed = true;


    public get error(): TError {
        return this._error;
    }

    public toString(): string {
        return isIToString(this._error) ?
            `Failed Result (${this._error.toString()})` :
            "Failed Result";
    }


    public augment<TFnSuccess, TFnError>(
        fn: (input: never) => Result<TFnSuccess, TFnError>
    ): this {
        return this;
    }


    public augmentAsync<TFnSuccess, TFnError>(
        fn: (input: never) => Promise<Result<TFnSuccess, TFnError>>
    ): Promise<this> {
        return Promise.resolve(this);
    }


    public bind<TFnSuccess, TFnError>(
        fn: (input: never) => Result<TFnSuccess, TFnError>
    ): this {
        return this;
    }


    public bindAsync<TFnSuccess, TFnError>(
        fn: (input: never) => Promise<Result<TFnSuccess, TFnError>>
    ): Promise<this> {
        return Promise.resolve(this);
    }


    public bindError<TFnSuccess, TFnError>(
        fn: (err: TError) => Result<TFnSuccess, TFnError>
    ): Result<TFnSuccess, TFnError> {
        const res = fn(this._error);
        return res;
    }


    public bindErrorAsync<TFnSuccess, TFnError>(
        fn: (err: TError) => Promise<Result<TFnSuccess, TFnError>>
    ): Promise<Result<TFnSuccess, TFnError>> {
        return fn(this._error);
    }


    public defaultValue<TDefault>(
        defaultValue: TDefault
    ): TDefault {
        return defaultValue;
    }


    public defaultWith<TDefault>(
        fn: (err: TError) => TDefault
    ): TDefault {
        const val = fn(this._error);
        return val;
    }


    public defaultWithAsync<TDefault>(
        fn: (err: TError) => Promise<TDefault>
    ): Promise<TDefault> {
        return fn(this._error);
    }


    public gate<TFnSuccess, TFnError>(
        fn: (successVal: never) => Result<TFnSuccess, TFnError>
    ): this {
        return this;
    }


    public gateAsync<TFnSuccess, TFnError>(
        fn: (successVal: never) => Promise<Result<TFnSuccess, TFnError>>
    ): Promise<this> {
        return Promise.resolve(this);
    }


    public mapError<TMappedError>(
        fn: (err: TError) => TMappedError
    ): FailedResult<TMappedError> {
        const mappedErr = fn(this._error);
        return new FailedResult(mappedErr);
    }


    public async mapErrorAsync<TMappedError>(
        fn: (err: TError) => Promise<TMappedError>
    ): Promise<FailedResult<TMappedError>> {
        const mappedErr = await fn(this._error);
        return new FailedResult(mappedErr);
    }


    public mapSuccess<TMappedSuccess>(
        fn: (successVal: never) => TMappedSuccess
    ): this {
        return this;
    }


    public mapSuccessAsync<TMappedSuccess>(
        fn: (successVal: never) => Promise<TMappedSuccess>
    ): Promise<this> {
        return Promise.resolve(this);
    }


    public match<TSuccessOut, TErrorOut>(
        fnSuccess: (val: never) => TSuccessOut,
        fnError: (err: TError) => TErrorOut
    ): TErrorOut {
        const out = fnError(this._error);
        return out;
    }


    public matchWith<TSuccessOut, TErrorOut>(
        matcherFns: {success: (val: never) => TSuccessOut, error: (err: TError) => TErrorOut}
    ): TErrorOut {
        const out = matcherFns.error(this._error);
        return out;
    }


    public matchWithAsync<TSuccessOut, TErrorOut>(
        matcherFns: {success: (val: never) => Promise<TSuccessOut>, error: (err: TError) => Promise<TErrorOut>}
    ): Promise<TErrorOut> {
        return matcherFns.error(this._error);
    }


    public tap(
        fn: (res: FailedResult<TError>) => unknown
    ): this {
        fn(this);
        return this;
    }


    public async tapAsync(
        fn: (res: FailedResult<TError>) => Promise<unknown>
    ): Promise<this> {
        await fn(this);
        return this;
    }


    public tapError(
        fn: (err: TError) => unknown
    ): this {
        fn(this._error);
        return this;
    }


    public async tapErrorAsync(
        fn: (err: TError) => Promise<unknown>
    ): Promise<this> {
        await fn(this._error);
        return this;
    }


    public tapSuccess(
        fn: (val: never) => unknown
    ): this {
        return this;
    }


    public tapSuccessAsync(
        fn: (val: never) => Promise<unknown>
    ): Promise<this> {
        return Promise.resolve(this);
    }


    public throwIfFailed(): never {
        const errMsg = typeof this._error === "string" ?
            this._error :
            inspect(this._error);
        throw new Error(errMsg);
    }


    public throwIfFailedWith(
        errorMsg: string
    ): never;
    public throwIfFailedWith(
        errorMapFn: (error: TError) => string
    ): never;
    public throwIfFailedWith(
        errorMsgOrFn: string | ((error: TError) => string)
    ): never;
    public throwIfFailedWith(
        errorMsgOrFn: string | ((error: TError) => string)
    ): never {
        const errMsg = typeof errorMsgOrFn === "string" ?
            errorMsgOrFn :
            errorMsgOrFn(this._error);
        throw new Error(errMsg);
    }


    public throwIfSucceeded(): TError {
        return this._error;
    }


    public throwIfSucceededWith(successMsg: string): TError;
    public throwIfSucceededWith(successMapFn: (val: never) => string): TError;
    public throwIfSucceededWith(successMsgOrFn: string | ((val: never) => string)): TError;
    public throwIfSucceededWith(successMsgOrFn: string | ((val: never) => string)): TError {
        return this._error;
    }


    public toNullable<TNullish extends undefined | null>(nullishValue: TNullish): TNullish {
        return nullishValue;
    }


    public toOption(): Option<never> {
        return NoneOption.get();
    }

}


/**
 * Represents the successful or failure result of an operation.
 */
export type Result<TSuccess, TError> = SucceededResult<TSuccess> | FailedResult<TError>;



////////////////////////////////////////////////////////////////////////////////
// Result Utility Types


// The following types extract the successful and error types from a Result.
// Since Result is a union, distributivity must be turned off.  See this post:
// https://stackoverflow.com/a/69164888

export type ResultSuccessType<T> = [T] extends [Result<infer X, infer __Y>] ? X : never;
export type ResultErrorType<T> = [T] extends [Result<infer __X, infer Y>] ? Y : never;


/**
 * When given an object with type {[k: string]: Result<S, E>}, the following
 * type will give you an object type where the keys are taken from T and the
 * values have the associated Result success types.
 *
 * For example:
 *     const operations = {
 *         op1: new SucceededResult("hello"),
 *         op2: new SucceededResult(5)
 *     };
 *
 *     type S1 = AllSuccessTypes<typeof operations>;
 *     // type S1 = {
 *     //     op1: string;
 *     //     op2: number;
 *     // };
 */
export type AllSuccessTypes<T extends Record<string, Result<unknown, unknown>>> = {
    [P in keyof T]: ResultSuccessType<T[P]>
};

/**
 * When given an object with type {[k: string]: Result<S, E>}, the following
 * type will give you an object type where the keys are taken from T and the
 * values have the associated Result error types.
 */
export type AllErrorTypes<T extends Record<string, Result<unknown, unknown>>> = {
    [P in keyof T]: ResultErrorType<T[P]>
};


/**
 * When given an object with type {[k: string]: Result<S, E>}, the following
 * type will give you a union of all possible Result error types.
 *
 * For example:
 *
 *     function op1(): Result<number, boolean> { return new SucceededResult(3); }
 *     function op2(): Result<number, string> { return new FailedResult("error1"); }
 *
 *     const operations = {
 *         op1: op1(),
 *         op2: op2(),
 *     };
 *
 *     type Error1 = PossibleErrors<typeof operations>;
 *     // type Error1 = string | boolean
 *
 * @param param - Description
 * @returns Description
 */
export type PossibleErrors<T extends Record<string, Result<unknown, unknown>>> = AllErrorTypes<T>[keyof AllErrorTypes<T>];




/**
 * A namespace that will be merged with the Result type.  Serves as a useful
 * place to create functions that operate on Result objects.
 */
export namespace Result {

    /**
     * Tests if all object values are successful Results.  If not, returns the
     * first failure.
     *
     * @param namedResults - An object where the keys are strings and the values are
     * Result objects.
     * @returns If all Results are successful, a successful Result wrapping an
     * object having the same keys and the values are the Result values.
     * Otherwise, the first failure Result is returned.
     */
    export function allObj<T extends Record<string, Result<unknown, unknown>>>(
        namedResults: T
    ): Result<AllSuccessTypes<T>, PossibleErrors<T>> {
        const results = Object.values(namedResults);
        const firstFailureIdx = results.findIndex((res) => res.failed);
        if (firstFailureIdx === -1) {
            // All were successful.  Return an object of the success result values.
            const successObj: Record<string, unknown> = {};
            for (const [name, res] of Object.entries(namedResults)) {
                successObj[name] = res.value;
            }
            return new SucceededResult(successObj as AllSuccessTypes<T>);
        }
        else {
            // A failure was found.  Return it.
            const failedResult = results[firstFailureIdx] as FailedResult<PossibleErrors<T>>;
            return failedResult;
        }
    }

    ////////////////////////////////////////////////////////////////////////////////
    // allM()
    ////////////////////////////////////////////////////////////////////////////////

    /**
     * Tests if all Results are successful.  If not, returns the first failure.
     *
     * @param a - Result
     * @returns If all Results are successful, a successful Result wrapping a
     * tuple of the values.  Otherwise, the first failure Result is returned.
     */
    export function allM<TSA, TFA>(
        a: Result<TSA, TFA>
    ): Result<[TSA], TFA>;

    /**
     * Tests if all Results are successful.  If not, returns the first failure.
     *
     * @param a - Result
     * @param b - Result
     * @returns If all Results are successful, a successful Result wrapping a
     * tuple of the values.  Otherwise, the first failure Result is returned.
     */
    export function allM<TSA, TFA, TSB, TFB>(
        a: Result<TSA, TFA>,
        b: Result<TSB, TFB>
    ): Result<[TSA, TSB], TFA | TFB>;

    /**
     * Tests if all Results are successful.  If not, returns the first failure.
     *
     * @param a - Result
     * @param b - Result
     * @param c - Result
     * @returns If all Results are successful, a successful Result wrapping a
     * tuple of the values.  Otherwise, the first failure Result is returned.
     */
    export function allM<TSA, TFA, TSB, TFB, TSC, TFC>(
        a: Result<TSA, TFA>,
        b: Result<TSB, TFB>,
        c: Result<TSC, TFC>
    ): Result<[TSA, TSB, TSC], TFA | TFB | TFC>;

    /**
     * Tests if all Results are successful.  If not, returns the first failure.
     *
     * @param a - Result
     * @param b - Result
     * @param c - Result
     * @param d - Result
     * @returns If all Results are successful, a successful Result wrapping a
     * tuple of the values.  Otherwise, the first failure Result is returned.
     */
    export function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD>(
        a: Result<TSA, TFA>,
        b: Result<TSB, TFB>,
        c: Result<TSC, TFC>,
        d: Result<TSD, TFD>
    ): Result<[TSA, TSB, TSC, TSD], TFA | TFB | TFC | TFD>;

    /**
     * Tests if all Results are successful.  If not, returns the first failure.
     *
     * @param a - Result
     * @param b - Result
     * @param c - Result
     * @param d - Result
     * @param e - Result
     * @returns If all Results are successful, a successful Result wrapping a
     * tuple of the values.  Otherwise, the first failure Result is returned.
     */
    export function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE>(
        a: Result<TSA, TFA>,
        b: Result<TSB, TFB>,
        c: Result<TSC, TFC>,
        d: Result<TSD, TFD>,
        e: Result<TSE, TFE>
    ): Result<[TSA, TSB, TSC, TSD, TSE], TFA | TFB | TFC | TFD | TFE>;

    /**
     * Tests if all Results are successful.  If not, returns the first failure.
     *
     * @param a - Result
     * @param b - Result
     * @param c - Result
     * @param d - Result
     * @param e - Result
     * @param f - Result
     * @returns If all Results are successful, a successful Result wrapping a
     * tuple of the values.  Otherwise, the first failure Result is returned.
     */
    export function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE, TSF, TFF>(
        a: Result<TSA, TFA>,
        b: Result<TSB, TFB>,
        c: Result<TSC, TFC>,
        d: Result<TSD, TFD>,
        e: Result<TSE, TFE>,
        f: Result<TSF, TFF>
    ): Result<[TSA, TSB, TSC, TSD, TSE, TSF], TFA | TFB | TFC | TFD | TFE | TFF>;

    /**
     * Tests if all Results are successful.  If not, returns the first failure.
     *
     * @param a - Result
     * @param b - Result
     * @param c - Result
     * @param d - Result
     * @param e - Result
     * @param f - Result
     * @param g - Result
     * @returns If all Results are successful, a successful Result wrapping a
     * tuple of the values.  Otherwise, the first failure Result is returned.
     */
    export function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE, TSF, TFF, TSG, TFG>(
        a: Result<TSA, TFA>,
        b: Result<TSB, TFB>,
        c: Result<TSC, TFC>,
        d: Result<TSD, TFD>,
        e: Result<TSE, TFE>,
        f: Result<TSF, TFF>,
        g: Result<TSG, TFG>
    ): Result<[TSA, TSB, TSC, TSD, TSE, TSF, TSG], TFA | TFB | TFC | TFD | TFE | TFF | TFG>;

    /**
     * Tests if all Results are successful.  If not, returns the first failure.
     *
     * @param a - Result
     * @param b - Result
     * @param c - Result
     * @param d - Result
     * @param e - Result
     * @param f - Result
     * @param g - Result
     * @param h - Result
     * @returns If all Results are successful, a successful Result wrapping a
     * tuple of the values.  Otherwise, the first failure Result is returned.
     */
    export function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE, TSF, TFF, TSG, TFG, TSH, TFH>(
        a: Result<TSA, TFA>,
        b: Result<TSB, TFB>,
        c: Result<TSC, TFC>,
        d: Result<TSD, TFD>,
        e: Result<TSE, TFE>,
        f: Result<TSF, TFF>,
        g: Result<TSG, TFG>,
        h: Result<TSH, TFH>
    ): Result<[TSA, TSB, TSC, TSD, TSE, TSF, TSG, TSH], TFA | TFB | TFC | TFD | TFE | TFF | TFG | TFH>;

    /**
     * Tests if all Results are successful.  If not, returns the first failure.
     *
     * @param a - Result
     * @param b - Result
     * @param c - Result
     * @param d - Result
     * @param e - Result
     * @param f - Result
     * @param g - Result
     * @param h - Result
     * @param i - Result
     * @returns If all Results are successful, a successful Result wrapping a
     * tuple of the values.  Otherwise, the first failure Result is returned.
     */
    export function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE, TSF, TFF, TSG, TFG, TSH, TFH, TSI, TFI>(
        a: Result<TSA, TFA>,
        b: Result<TSB, TFB>,
        c: Result<TSC, TFC>,
        d: Result<TSD, TFD>,
        e: Result<TSE, TFE>,
        f: Result<TSF, TFF>,
        g: Result<TSG, TFG>,
        h: Result<TSH, TFH>,
        i: Result<TSI, TFI>
    ): Result<[TSA, TSB, TSC, TSD, TSE, TSF, TSG, TSH, TSI], TFA | TFB | TFC | TFD | TFE | TFF | TFG | TFH | TFI>;

    /**
     * Tests if all Results are successful.  If not, returns the first failure.
     *
     * @param a - Result
     * @param b - Result
     * @param c - Result
     * @param d - Result
     * @param e - Result
     * @param f - Result
     * @param g - Result
     * @param h - Result
     * @param i - Result
     * @param j - Result
     * @returns If all Results are successful, a successful Result wrapping a
     * tuple of the values.  Otherwise, the first failure Result is returned.
     */
    export function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE, TSF, TFF, TSG, TFG, TSH, TFH, TSI, TFI, TSJ, TFJ>(
        a: Result<TSA, TFA>,
        b: Result<TSB, TFB>,
        c: Result<TSC, TFC>,
        d: Result<TSD, TFD>,
        e: Result<TSE, TFE>,
        f: Result<TSF, TFF>,
        g: Result<TSG, TFG>,
        h: Result<TSH, TFH>,
        i: Result<TSI, TFI>,
        j: Result<TSJ, TFJ>
    ): Result<[TSA, TSB, TSC, TSD, TSE, TSF, TSG, TSH, TSI, TSJ], TFA | TFB | TFC | TFD | TFE | TFF | TFG | TFH | TFI | TFJ>;

    /**
     * Tests if all Results are successful.  If not, returns the first failure.
     *
     * @param a - Result
     * @param b - Result
     * @param c - Result
     * @param d - Result
     * @param e - Result
     * @param f - Result
     * @param g - Result
     * @param h - Result
     * @param i - Result
     * @param j - Result
     * @param k - Result
     * @returns If all Results are successful, a successful Result wrapping a
     * tuple of the values.  Otherwise, the first failure Result is returned.
     */
    export function allM<TSA, TFA, TSB, TFB, TSC, TFC, TSD, TFD, TSE, TFE, TSF, TFF, TSG, TFG, TSH, TFH, TSI, TFI, TSJ, TFJ, TSK, TFK>(
        a: Result<TSA, TFA>,
        b: Result<TSB, TFB>,
        c: Result<TSC, TFC>,
        d: Result<TSD, TFD>,
        e: Result<TSE, TFE>,
        f: Result<TSF, TFF>,
        g: Result<TSG, TFG>,
        h: Result<TSH, TFH>,
        i: Result<TSI, TFI>,
        j: Result<TSJ, TFJ>,
        k: Result<TSK, TFK>
    ): Result<[TSA, TSB, TSC, TSD, TSE, TSF, TSG, TSH, TSI, TSJ, TSK], TFA | TFB | TFC | TFD | TFE | TFF | TFG | TFH | TFI | TFJ | TFK>;

    export function allM(
        ...results: Array<Result<unknown, unknown>>
    ): Result<Array<unknown>, unknown> {
        const firstFailureIdx = results.findIndex((res) => res.failed);
        if (firstFailureIdx === -1) {
            const successVals = results.map((res) => res.value);
            return new SucceededResult(successVals);
        }
        else {
            const failedResult = results[firstFailureIdx] as FailedResult<unknown>;
            return failedResult;
        }
    }


    /**
     * Tests if all Results are successful.  If not, all errors are returned.
     *
     * @param resultsCollection - The input collection
     * @returns If all inputs are successful, a successful Result containing
     * their values.  If the input contains some failures, a failure Result
     * containing an array of the errors.
     */
    export function allArrayA<TSuccess, TError>(
        resultsCollection: Array<Result<TSuccess, TError>>
    ): Result<Array<TSuccess>, Array<TError>> {
        const failureResults = resultsCollection.filter((res) => res.failed);
        if (failureResults.length > 0) {
            return new FailedResult(failureResults.map((res) => res.error));
        }
        else {
            return new SucceededResult(resultsCollection.map((res) => res.value!));
        }
    }


    /**
     * Tests if all Results are successful.  If not, the first error is
     * returned.
     *
     * @param resultsCollection - The input collection
     * @returns If all inputs are successful, a successful Result containing
     * their values.  If the input contains some failures, a failure Result
     * containing the first error.
     */
    export function allArrayM<TSuccess, TError>(
        resultsCollection: Array<Result<TSuccess, TError>>
    ): Result<Array<TSuccess>, TError> {
        const firstFailure = resultsCollection.find(
            (curResult): curResult is FailedResult<TError> => curResult instanceof FailedResult
        );

        const retVal = firstFailure ?? new SucceededResult(resultsCollection.map((curResult): TSuccess => curResult.value!));
        return retVal;
    }


    /**
     * If the input Result is successful, invokes _fn_ with the value.  If a
     * successful Result is returned, the original input value is augmented with
     * the value.  Augment is a lot like bind(), except it automatically
     * includes all of the input's properties.  It can also serve as a gate when
     * augmenting no additional properties, which is the same as Result.gate().
     *
     * @param fn - Function that will be invoked if the input Result is
     * successful.  Returns a Result.  If successful, the properties will be
     * added to _input_ and returned as a successful Result.
     * @param input - The input Result
     * @returns An error if the input is an error or _fn_ returns an error.
     * Otherwise, a successful Result containing all properties of the original
     * input and the value returned by _fn_.
     */
    // Eager form.
    export function augment<TInS extends object, TInE, TOutS, TOutE>(
        fn: (input: TInS) => Result<TOutS, TOutE>,
        input: Result<TInS, TInE>
    ): Result<TInS & TOutS, TInE | TOutE>;

    // Curried (point-free) form.
    export function augment<TInS extends object, TInE, TOutS, TOutE>(
        fn: (input: TInS) => Result<TOutS, TOutE>
    ): (input: Result<TInS, TInE>) => Result<TInS & TOutS, TInE | TOutE>;

    export function augment(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (input: object) => Result<unknown, unknown>, input: Result<object, unknown>) => {
                // Narrow input to SucceededResult so TypeScript can verify the `this`
                // constraint on augment(), which requires TSuccess to extend object.
                if (input.failed) {
                    return input;
                }
                return input.augment(fn);
            }
        );
    }


    /**
     * If the input Result is successful, invokes _fn_ with the value. If a
     * successful Result is returned, the original input value is augmented
     * with the value.
     *
     * @param fn - Async augment function invoked for successful input
     * @param input - The input Result
     * @returns A Promise for the augmented Result
     */
    // Eager form.
    export function augmentAsync<TInS extends object, TInE, TOutS, TOutE>(
        fn: (input: TInS) => Promise<Result<TOutS, TOutE>>,
        input: Result<TInS, TInE>
    ): Promise<Result<TInS & TOutS, TInE | TOutE>>;

    // Curried (point-free) form.
    export function augmentAsync<TInS extends object, TInE, TOutS, TOutE>(
        fn: (input: TInS) => Promise<Result<TOutS, TOutE>>
    ): (input: Result<TInS, TInE>) => Promise<Result<TInS & TOutS, TInE | TOutE>>;

    export function augmentAsync(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (input: object) => Promise<Result<unknown, unknown>>, input: Result<object, unknown>) => {
                // Narrow input to SucceededResult so TypeScript can verify the `this`
                // constraint on augmentAsync(), which requires TSuccess to extend object.
                if (input.failed) {
                    return Promise.resolve(input);
                }
                return input.augmentAsync(fn);
            }
        );
    }


    /**
     * If _input_ is successful, unwraps the value and passes it into _fn_,
     * returning its returned Result.  If _input_ is not successful, returns it.
     *
     * @param fn - The function to invoke on _input.value_ when _input_ is
     * successful.
     * @param input - The input Result.
     * @returns Either the passed-through failure Result or the Result returned from
     * _fn_.
     */
    // Eager form.
    export function bind<TInS, TInE, TOutS, TOutE>(
        fn: (x: TInS) => Result<TOutS, TOutE>,
        input: Result<TInS, TInE>
    ): Result<TOutS, TInE | TOutE>;

    // Curried (point-free) form.
    export function bind<TInS, TInE, TOutS, TOutE>(
        fn: (x: TInS) => Result<TOutS, TOutE>
    ): (input: Result<TInS, TInE>) => Result<TOutS, TInE | TOutE>;

    export function bind(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (x: unknown) => Result<unknown, unknown>, input: Result<unknown, unknown>) => input.bind(fn)
        );
    }


    /**
     * If _input_ is successful, unwraps the value and passes it into _fn_,
     * returning its returned Result. If _input_ is not successful, returns it.
     *
     * @param fn - Async bind function invoked for successful input
     * @param input - The input Result
     * @returns A Promise for the bound Result
     */
    // Eager form.
    export function bindAsync<TInS, TInE, TOutS, TOutE>(
        fn: (x: TInS) => Promise<Result<TOutS, TOutE>>,
        input: Result<TInS, TInE>
    ): Promise<Result<TOutS, TInE | TOutE>>;

    // Curried (point-free) form.
    export function bindAsync<TInS, TInE, TOutS, TOutE>(
        fn: (x: TInS) => Promise<Result<TOutS, TOutE>>
    ): (input: Result<TInS, TInE>) => Promise<Result<TOutS, TInE | TOutE>>;

    export function bindAsync(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (x: unknown) => Promise<Result<unknown, unknown>>, input: Result<unknown, unknown>) => input.bindAsync(fn)
        );
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
     * @returns Either the passed-through successful Result or the Result
     * returned from _fn_.
     */
    // Eager form.
    export function bindError<TInS, TInE, TOutS, TOutE>(
        fn: (err: TInE) => Result<TOutS, TOutE>,
        input: Result<TInS, TInE>
    ): Result<TInS | TOutS, TOutE>;

    // Curried (point-free) form.
    export function bindError<TInS, TInE, TOutS, TOutE>(
        fn: (err: TInE) => Result<TOutS, TOutE>
    ): (input: Result<TInS, TInE>) => Result<TInS | TOutS, TOutE>;

    export function bindError(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (err: unknown) => Result<unknown, unknown>, input: Result<unknown, unknown>) => input.bindError(fn)
        );
    }


    /**
     * If _input_ is an error, unwraps the error and passes it into _fn_,
     * returning its returned Result. If _input_ is successful, returns it.
     *
     * @param fn - Async function invoked for failed input
     * @param input - The input Result
     * @returns A Promise for the bound Result
     */
    // Eager form.
    export function bindErrorAsync<TInS, TInE, TOutS, TOutE>(
        fn: (err: TInE) => Promise<Result<TOutS, TOutE>>,
        input: Result<TInS, TInE>
    ): Promise<Result<TInS | TOutS, TOutE>>;

    // Curried (point-free) form.
    export function bindErrorAsync<TInS, TInE, TOutS, TOutE>(
        fn: (err: TInE) => Promise<Result<TOutS, TOutE>>
    ): (input: Result<TInS, TInE>) => Promise<Result<TInS | TOutS, TOutE>>;

    export function bindErrorAsync(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (err: unknown) => Promise<Result<unknown, unknown>>, input: Result<unknown, unknown>) => input.bindErrorAsync(fn)
        );
    }


    /**
     * If the input is a successful value, returns the wrapped value, else
     * returns the default value (which may be a different type).
     *
     * @param defaultValue - The default value to use if input is an error
     * Result
     * @param input - The input Result
     * @returns The contained value if input is successful, else the default
     * value.
     */
    // Eager form.
    export function defaultValue<TInS, TE, TDefault>(
        defaultValue: TDefault,
        input: Result<TInS, TE>
    ): TInS | TDefault;

    // Curried (point-free) form.
    export function defaultValue<TInS, TE, TDefault>(
        defaultValue: TDefault
    ): (input: Result<TInS, TE>) => TInS | TDefault;

    export function defaultValue(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (defaultValue: unknown, input: Result<unknown, unknown>) => input.defaultValue(defaultValue)
        );
    }

    /**
     * If the input is a successful value, returns the wrapped value, else
     * returns _fn()_ (which may be a different type).  This function is useful
     * when getting the default value is expensive.
     *
     * @param fn - A function that can be invoked to get the default value.  Not
     * executed unless input is an error.
     * @param input - The input Result
     * @returns The contained value if input is successful, else the value
     * returned by _fn_.
     */
    // Eager form.
    export function defaultWith<TInS, TE, TDefault>(
        fn: (err: TE) => TDefault,
        input: Result<TInS, TE>
    ): TInS | TDefault;

    // Curried (point-free) form.
    export function defaultWith<TInS, TE, TDefault>(
        fn: (err: TE) => TDefault
    ): (input: Result<TInS, TE>) => TInS | TDefault;

    export function defaultWith(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (err: unknown) => unknown, input: Result<unknown, unknown>) => input.defaultWith(fn)
        );
    }


    /**
     * If the input is a successful value, returns the wrapped value, else
     * returns _fn()_.
     *
     * @param fn - Async fallback function invoked for failed input
     * @param input - The input Result
     * @returns A Promise for either the success value or fallback value
     */
    // Eager form.
    export function defaultWithAsync<TInS, TE, TDefault>(
        fn: (err: TE) => Promise<TDefault>,
        input: Result<TInS, TE>
    ): Promise<TInS | TDefault>;

    // Curried (point-free) form.
    export function defaultWithAsync<TInS, TE, TDefault>(
        fn: (err: TE) => Promise<TDefault>
    ): (input: Result<TInS, TE>) => Promise<TInS | TDefault>;

    export function defaultWithAsync(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (err: unknown) => Promise<unknown>, input: Result<unknown, unknown>) => input.defaultWithAsync(fn)
        );
    }


    // #region executeWhileSuccessful()


    // Decoder for type parameter names:
    // T - Because all type parameters must begin with "T"
    // [A-Z] - Ordinal
    // [SE] - Success/Error
    //
    // Examples:
    // TAS - The type fnA returns when successful
    // TBE - The type fnB returns when failed

    export function executeWhileSuccessful<TAS, TAE>(
        fnA: () => Result<TAS, TAE>
    ): Result<[TAS], TAE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>
    ): Result<[TAS, TBS], TAE | TBE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE, TCS, TCE>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>,
        fnC: () => Result<TCS, TCE>
    ): Result<[TAS, TBS, TCS], TAE | TBE | TCE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE, TCS, TCE, TDS, TDE>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>,
        fnC: () => Result<TCS, TCE>,
        fnD: () => Result<TDS, TDE>
    ): Result<[TAS, TBS, TCS, TDS], TAE | TBE | TCE | TDE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE, TCS, TCE, TDS, TDE, TES, TEE>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>,
        fnC: () => Result<TCS, TCE>,
        fnD: () => Result<TDS, TDE>,
        fnE: () => Result<TES, TEE>
    ): Result<[TAS, TBS, TCS, TDS, TES], TAE | TBE | TCE | TDE | TEE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE, TCS, TCE, TDS, TDE, TES, TEE, TFS, TFE>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>,
        fnC: () => Result<TCS, TCE>,
        fnD: () => Result<TDS, TDE>,
        fnE: () => Result<TES, TEE>,
        fnF: () => Result<TFS, TFE>
    ): Result<[TAS, TBS, TCS, TDS, TES, TFS], TAE | TBE | TCE | TDE | TEE | TFE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE, TCS, TCE, TDS, TDE, TES, TEE, TFS, TFE, TGS, TGE>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>,
        fnC: () => Result<TCS, TCE>,
        fnD: () => Result<TDS, TDE>,
        fnE: () => Result<TES, TEE>,
        fnF: () => Result<TFS, TFE>,
        fnG: () => Result<TGS, TGE>
    ): Result<[TAS, TBS, TCS, TDS, TES, TFS, TGS], TAE | TBE | TCE | TDE | TEE | TFE | TGE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE, TCS, TCE, TDS, TDE, TES, TEE, TFS, TFE, TGS, TGE, THS, THE>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>,
        fnC: () => Result<TCS, TCE>,
        fnD: () => Result<TDS, TDE>,
        fnE: () => Result<TES, TEE>,
        fnF: () => Result<TFS, TFE>,
        fnG: () => Result<TGS, TGE>,
        fnH: () => Result<THS, THE>
    ): Result<[TAS, TBS, TCS, TDS, TES, TFS, TGS, THS], TAE | TBE | TCE | TDE | TEE | TFE | TGE | THE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE, TCS, TCE, TDS, TDE, TES, TEE, TFS, TFE, TGS, TGE, THS, THE, TIS, TIE>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>,
        fnC: () => Result<TCS, TCE>,
        fnD: () => Result<TDS, TDE>,
        fnE: () => Result<TES, TEE>,
        fnF: () => Result<TFS, TFE>,
        fnG: () => Result<TGS, TGE>,
        fnH: () => Result<THS, THE>,
        fnI: () => Result<TIS, TIE>
    ): Result<[TAS, TBS, TCS, TDS, TES, TFS, TGS, THS, TIS], TAE | TBE | TCE | TDE | TEE | TFE | TGE | THE | TIE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE, TCS, TCE, TDS, TDE, TES, TEE, TFS, TFE, TGS, TGE, THS, THE, TIS, TIE, TJS, TJE>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>,
        fnC: () => Result<TCS, TCE>,
        fnD: () => Result<TDS, TDE>,
        fnE: () => Result<TES, TEE>,
        fnF: () => Result<TFS, TFE>,
        fnG: () => Result<TGS, TGE>,
        fnH: () => Result<THS, THE>,
        fnI: () => Result<TIS, TIE>,
        fnJ: () => Result<TJS, TJE>
    ): Result<[TAS, TBS, TCS, TDS, TES, TFS, TGS, THS, TIS, TJS], TAE | TBE | TCE | TDE | TEE | TFE | TGE | THE | TIE | TJE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE, TCS, TCE, TDS, TDE, TES, TEE, TFS, TFE, TGS, TGE, THS, THE, TIS, TIE, TJS, TJE, TKS, TKE>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>,
        fnC: () => Result<TCS, TCE>,
        fnD: () => Result<TDS, TDE>,
        fnE: () => Result<TES, TEE>,
        fnF: () => Result<TFS, TFE>,
        fnG: () => Result<TGS, TGE>,
        fnH: () => Result<THS, THE>,
        fnI: () => Result<TIS, TIE>,
        fnJ: () => Result<TJS, TJE>,
        fnK: () => Result<TKS, TKE>
    ): Result<[TAS, TBS, TCS, TDS, TES, TFS, TGS, THS, TIS, TJS, TKS], TAE | TBE | TCE | TDE | TEE | TFE | TGE | THE | TIE | TJE | TKE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE, TCS, TCE, TDS, TDE, TES, TEE, TFS, TFE, TGS, TGE, THS, THE, TIS, TIE, TJS, TJE, TKS, TKE, TLS, TLE>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>,
        fnC: () => Result<TCS, TCE>,
        fnD: () => Result<TDS, TDE>,
        fnE: () => Result<TES, TEE>,
        fnF: () => Result<TFS, TFE>,
        fnG: () => Result<TGS, TGE>,
        fnH: () => Result<THS, THE>,
        fnI: () => Result<TIS, TIE>,
        fnJ: () => Result<TJS, TJE>,
        fnK: () => Result<TKS, TKE>,
        fnL: () => Result<TLS, TLE>
    ): Result<[TAS, TBS, TCS, TDS, TES, TFS, TGS, THS, TIS, TJS, TKS, TLS], TAE | TBE | TCE | TDE | TEE | TFE | TGE | THE | TIE | TJE | TKE | TLE>;

    export function executeWhileSuccessful<TAS, TAE, TBS, TBE, TCS, TCE, TDS, TDE, TES, TEE, TFS, TFE, TGS, TGE, THS, THE, TIS, TIE, TJS, TJE, TKS, TKE, TLS, TLE, TMS, TME>(
        fnA: () => Result<TAS, TAE>,
        fnB: () => Result<TBS, TBE>,
        fnC: () => Result<TCS, TCE>,
        fnD: () => Result<TDS, TDE>,
        fnE: () => Result<TES, TEE>,
        fnF: () => Result<TFS, TFE>,
        fnG: () => Result<TGS, TGE>,
        fnH: () => Result<THS, THE>,
        fnI: () => Result<TIS, TIE>,
        fnJ: () => Result<TJS, TJE>,
        fnK: () => Result<TKS, TKE>,
        fnL: () => Result<TLS, TLE>,
        fnM: () => Result<TMS, TME>
    ): Result<[TAS, TBS, TCS, TDS, TES, TFS, TGS, THS, TIS, TJS, TKS, TLS, TMS], TAE | TBE | TCE | TDE | TEE | TFE | TGE | THE | TIE | TJE | TKE | TLE | TME>;

    export function executeWhileSuccessful(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        ...funcs: Array<Function>
    ): Result<Array<unknown>, unknown> {
        return funcs.reduce<Result<Array<unknown>, unknown>>(
            (acc, curFn) => {
                // If we have already failed, just return the error.
                if (acc.failed) {
                    return acc;
                }

                // We have not failed yet, so execute the current function.
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                const res = curFn() as Result<unknown, unknown>;
                if (res.succeeded) {
                    // Note:  Do not use array.concat() here, because if the current
                    // result's value is an array, it will be flattened.
                    acc.value.push(res.value);
                    return acc;
                }
                else {
                    return res;
                }
            },
            new SucceededResult([])
        );
    }

    // #endregion


    /**
     * Filters an array of Results, taking only the failure ones and then
     * unwraps them.
     *
     * @param results - The input Results
     * @returns An array containing the unwrapped values of the failure
     * Results.
     */
    export function filterErrors<TSuccess, TError>(
        results: Array<Result<TSuccess, TError>>
    ): Array<TError> {
        return results
        .filter((curRes): curRes is FailedResult<TError> => curRes.failed)
        .map((curRes) => curRes.error);
    }


    /**
     * Filters an array of Results, taking only the successful ones and then
     * unwraps them.
     *
     * @param results - The input Results
     * @returns An array containing the unwrapped values of the successful
     * Results.
     */
    export function filterSuccesses<TSuccess, TError>(
        results: Array<Result<TSuccess, TError>>
    ): Array<TSuccess> {
        return results
        .filter((curRes): curRes is SucceededResult<TSuccess> => curRes.succeeded)
        .map((curRes) => curRes.value);
    }


    /**
     * Converts a boolean value into a successful or failure Result.
     *
     * @param condition - The condition.
     * @param trueSuccessVal - Value to be wrapped in a successful Result when
     * _condition_ is truthy.
     * @param falseErrorVal - Value to be wrapped in a failure Result when
     * _condition_ is falsy.
     * @returns A Result wrapping either of the specified values, determined by
     * _condition_.
     */
    export function fromBool<TSuccess, TError>(
        condition: unknown,
        trueSuccessVal: TSuccess,
        falseErrorVal: TError
    ): Result<TSuccess, TError> {
        return condition ?
            new SucceededResult(trueSuccessVal) :
            new FailedResult(falseErrorVal);
    }


    /**
     * Converts a value that may be undefined or null into a Result for that
     * value.
     *
     * @param err - Error value to be used if _nullable_ is undefined or null
     * @param nullable - A value that may be undefined or null
     * @returns A successful Result containing _nullable_ if it was neither
     * undefined or null.  Otherwise, a failure Result containing _err_.
     */
    // Eager form.
    export function fromNullable<T, TE>(
        err: TE,
        nullable: T | undefined | null
    ): Result<T, TE>;

    // Curried (point-free) form.
    export function fromNullable<T, TE>(
        err: TE
    ): (nullable: T | undefined | null) => Result<T, TE>;

    export function fromNullable(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (err: unknown, nullable: unknown) => {
                return (nullable === undefined) || (nullable === null) ?
                    new FailedResult(err) :
                    new SucceededResult(nullable);
            }
        );
    }


    /**
     * Converts an Option to a Result.
     *
     * @param err - The error value to use when _opt_ is None
     * @param opt - The Option to be converted
     * @returns The converted Result
     */
    // Eager form.
    export function fromOption<TInS, TE>(
        err: TE,
        opt: Option<TInS>
    ): Result<TInS, TE>;

    // Curried (point-free) form.
    export function fromOption<TInS, TE>(
        err: TE
    ): (opt: Option<TInS>) => Result<TInS, TE>;

    export function fromOption(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (err: unknown, opt: Option<unknown>) => {
                if (opt.isSome) {
                    return new SucceededResult(opt.value);
                }

                // The input is a None.  We must return a failed Result.
                return new FailedResult(err);
            }
        );
    }


    /**
     * Converts an Option to a Result.
     *
     * @param errFn - A function that will be invoked if _opt_ is None.  This
     * function must return the failed error value.
     * @param opt - The Option to be converted
     * @returns The converted Result
     */
    // Eager form.
    export function fromOptionWith<TInS, TE>(
        errFn: () => TE,
        opt: Option<TInS>
    ): Result<TInS, TE>;

    // Curried (point-free) form.
    export function fromOptionWith<TInS, TE>(
        errFn: () => TE
    ): (opt: Option<TInS>) => Result<TInS, TE>;

    export function fromOptionWith(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (errFn: () => unknown, opt: Option<unknown>) => {
                if (opt.isSome) {
                    return new SucceededResult(opt.value);
                }

                // The input is a None.  We must return a failed Result.
                const err = errFn();
                return new FailedResult(err);
            }
        );
    }


    /**
     * If _input_ is successful, invokes _fn_ with the value.  If a successful
     * Result is returned, _input_ is returned.
     *
     * @param fn - Function that is invoked to determine whether the original
     *  successful input is returned.  If this function returns a failure, that
     *  failed Result is returned.
     * @param input - The input Result
     * @returns _input_ is returned if it is a failed Result.  Otherwise, if _fn_
     * is successful, _input_ is returned.  If _fn_ is a failure, that failed
     * result is returned.
     */
    // Eager form.
    export function gate<TInS, TInE, TOutS, TOutE>(
        fn: (successVal: TInS) => Result<TOutS, TOutE>,
        input: Result<TInS, TInE>
    ): Result<TInS, TInE | TOutE>;

    // Curried (point-free) form.
    export function gate<TInS, TInE, TOutS, TOutE>(
        fn: (successVal: TInS) => Result<TOutS, TOutE>
    ): (input: Result<TInS, TInE>) => Result<TInS, TInE | TOutE>;

    export function gate(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (successVal: unknown) => Result<unknown, unknown>, input: Result<unknown, unknown>) => input.gate(fn)
        );
    }


    /**
     * If _input_ is successful, invokes _fn_ with the value. If a successful
     * Result is returned, _input_ is returned.  If a failed Result is returned,
     * that failed Result is returned.  If _input_ is a failed Result, it is
     * returned.
     *
     * @param fn - Async gate function invoked for successful input
     * @param input - The input Result
     * @returns A Promise for either original success or gate failure
     */
    // Eager form.
    export function gateAsync<TInS, TInE, TOutS, TOutE>(
        fn: (successVal: TInS) => Promise<Result<TOutS, TOutE>>,
        input: Result<TInS, TInE>
    ): Promise<Result<TInS, TInE | TOutE>>;

    // Curried (point-free) form.
    export function gateAsync<TInS, TInE, TOutS, TOutE>(
        fn: (successVal: TInS) => Promise<Result<TOutS, TOutE>>
    ): (input: Result<TInS, TInE>) => Promise<Result<TInS, TInE | TOutE>>;

    export function gateAsync(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (successVal: unknown) => Promise<Result<unknown, unknown>>, input: Result<unknown, unknown>) => input.gateAsync(fn)
        );
    }


    /**
     * When _input_ is a failure, maps the wrapped error using _fn_.
     *
     * @param fn - Function that maps the wrapped error value to another value.
     * @param input - The input Result.
     * @returns Either the passed-through successful Result or the mapped error
     * Result.
     */
    // Eager form.
    export function mapError<TInS, TInE, TOutE>(
        fn: (input: TInE) => TOutE,
        input: Result<TInS, TInE>
    ): Result<TInS, TOutE>;

    // Curried (point-free) form.
    export function mapError<TInS, TInE, TOutE>(
        fn: (input: TInE) => TOutE
    ): (input: Result<TInS, TInE>) => Result<TInS, TOutE>;

    export function mapError(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (input: unknown) => unknown, input: Result<unknown, unknown>) => input.mapError(fn)
        );
    }


    /**
     * When _input_ is a failure, maps the wrapped error using _fn_.
     *
     * @param fn - Async error mapping function
     * @param input - The input Result
     * @returns A Promise for the mapped Result
     */
    // Eager form.
    export function mapErrorAsync<TInS, TInE, TOutE>(
        fn: (input: TInE) => Promise<TOutE>,
        input: Result<TInS, TInE>
    ): Promise<Result<TInS, TOutE>>;

    // Curried (point-free) form.
    export function mapErrorAsync<TInS, TInE, TOutE>(
        fn: (input: TInE) => Promise<TOutE>
    ): (input: Result<TInS, TInE>) => Promise<Result<TInS, TOutE>>;

    export function mapErrorAsync(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (input: unknown) => Promise<unknown>, input: Result<unknown, unknown>) => input.mapErrorAsync(fn)
        );
    }


    /**
     * When _input_ is successful, maps the wrapped value using _fn_.
     *
     * @param fn - Function that maps the wrapped success value to another value.
     * @param input - The input Result.
     * @returns Either the mapped successful Result or the passed-through failure
     * Result.
     */
    // Eager form.
    export function mapSuccess<TInS, TOutS, TE>(
        fn: (input: TInS) => TOutS,
        input: Result<TInS, TE>
    ): Result<TOutS, TE>;

    // Curried (point-free) form.
    export function mapSuccess<TInS, TOutS, TE>(
        fn: (input: TInS) => TOutS
    ): (input: Result<TInS, TE>) => Result<TOutS, TE>;

    export function mapSuccess(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (input: unknown) => unknown, input: Result<unknown, unknown>) => input.mapSuccess(fn)
        );
    }


    /**
     * When _input_ is successful, maps the wrapped value using _fn_.
     *
     * @param fn - Async success mapping function
     * @param input - The input Result
     * @returns A Promise for the mapped Result
     */
    // Eager form.
    export function mapSuccessAsync<TInS, TOutS, TE>(
        fn: (input: TInS) => Promise<TOutS>,
        input: Result<TInS, TE>
    ): Promise<Result<TOutS, TE>>;

    // Curried (point-free) form.
    export function mapSuccessAsync<TInS, TOutS, TE>(
        fn: (input: TInS) => Promise<TOutS>
    ): (input: Result<TInS, TE>) => Promise<Result<TOutS, TE>>;

    export function mapSuccessAsync(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (input: unknown) => Promise<unknown>, input: Result<unknown, unknown>) => input.mapSuccessAsync(fn)
        );
    }


    /**
     * Maps values from a source collection until a failed mapping occurs.  If a
     * failure occurs, the mapping stops immediately.
     *
     * @param mappingFunc - The mapping function. Each element from _srcCollection_
     * is run through this function and it must return a successful result wrapping
     * the mapped value or a failure result wrapping the error.
     * @param collection - The source collection
     * @returns A successful result wrapping an array of the mapped values or a
     * failure result wrapping the first failure encountered.
     */
    // Eager form.
    export function mapWhileSuccessful<TIn, TOut, TE>(
        mappingFunc: (curItem: TIn) => Result<TOut, TE>,
        collection: Array<TIn>
    ): Result<Array<TOut>, TE>;

    // Curried (point-free) form.
    export function mapWhileSuccessful<TIn, TOut, TE>(
        mappingFunc: (curItem: TIn) => Result<TOut, TE>
    ): (collection: Array<TIn>) => Result<Array<TOut>, TE>;

    export function mapWhileSuccessful(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (mappingFunc: (curItem: unknown) => Result<unknown, unknown>, collection: Array<unknown>) => {
                return collection.reduce<Result<Array<unknown>, unknown>>(
                    (acc, curItem) => {
                        // If we have already failed, just return the error.
                        if (acc.failed) {
                            return acc;
                        }

                        // We have not yet failed, so process the current item.
                        const res = mappingFunc(curItem);
                        if (res.succeeded) {
                            // Note:  Do not use array.concat() here, because if the current
                            // result's value is an array, it will be flattened.
                            acc.value.push(res.value);
                            return acc;
                        }
                        else {
                            return res;
                        }
                    },
                    new SucceededResult([])
                );
            }
        );
    }


    /**
     * When _input_ is successful invokes _fnSuccess_ and returns the result.
     * When _input_ is an error invokes _fnError_ and returns the result.
     *
     * @param fnSuccess - Function that will be invoked when _input_ is a
     * successful Result
     * @param fnError - Function that will be invoked when _input_ is an error
     * Result
    * @param input - The input Result
    * @returns The value returned by either _fnSuccess_ or _fnError_
     */
    // Eager form.
    export function match<TInS, TInE, TOutS, TOutE>(
        fnSuccess: (val: TInS) => TOutS,
        fnError: (err: TInE) => TOutE,
        input: Result<TInS, TInE>
    ): TOutS | TOutE;

    // Curried (point-free) form.
    export function match<TInS, TInE, TOutS, TOutE>(
        fnSuccess: (val: TInS) => TOutS,
        fnError: (err: TInE) => TOutE
    ): (input: Result<TInS, TInE>) => TOutS | TOutE;

    export function match(...args: Array<unknown>): unknown {
        return dispatchLast(
            3,
            args,
            (
                fnSuccess: (val: unknown) => unknown,
                fnError: (err: unknown) => unknown,
                input: Result<unknown, unknown>
            ) => input.match(fnSuccess, fnError)
        );
    }


    /**
     * When _input_ is successful, invokes the specified success function and
     * returns the result.
     * When _input_ is an error, invokes the specified error function and
     * returns the result.
     * This function is exactly like match(), except it specifies the success
     * and error functions in an object. Because the functions are labeled with
     * the 'success' and 'error' property names, this can help make the calling
     * code easier to understand.
     *
     * @param matcherFns - An object that specifies the success and error
     * functions
    * @param input - The input Result
     * @returns The value returned by the invoked handler function
     */
    // Eager form.
    export function matchWith<TInS, TInE, TOutS, TOutE>(
        matcherFns: {success: (val: TInS) => TOutS, error: (err: TInE) => TOutE},
        input: Result<TInS, TInE>
    ): TOutS | TOutE;

    // Curried (point-free) form.
    export function matchWith<TInS, TInE, TOutS, TOutE>(
        matcherFns: {success: (val: TInS) => TOutS, error: (err: TInE) => TOutE}
    ): (input: Result<TInS, TInE>) => TOutS | TOutE;

    export function matchWith(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (
                matcherFns: {success: (val: unknown) => unknown, error: (err: unknown) => unknown},
                input: Result<unknown, unknown>
            ) => {
                const out = input.match(matcherFns.success, matcherFns.error);
                return out;
            }
        );
    }


    /**
     * When _input_ is successful, invokes the specified success function and
     * returns the result. When _input_ is an error, invokes the specified
     * error function and returns the result.
     *
     * @param matcherFns - Async success and error handlers
     * @param input - The input Result
     * @returns A Promise for the matched output
     */
    // Eager form.
    export function matchWithAsync<TInS, TInE, TOutS, TOutE>(
        matcherFns: {success: (val: TInS) => Promise<TOutS>, error: (err: TInE) => Promise<TOutE>},
        input: Result<TInS, TInE>
    ): Promise<TOutS | TOutE>;

    // Curried (point-free) form.
    export function matchWithAsync<TInS, TInE, TOutS, TOutE>(
        matcherFns: {success: (val: TInS) => Promise<TOutS>, error: (err: TInE) => Promise<TOutE>}
    ): (input: Result<TInS, TInE>) => Promise<TOutS | TOutE>;

    export function matchWithAsync(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (
                matcherFns: {success: (val: unknown) => Promise<unknown>, error: (err: unknown) => Promise<unknown>},
                input: Result<unknown, unknown>
            ) => input.matchWithAsync(matcherFns)
        );
    }


    /**
     * Separates the specified results into an arrays of those that succeeded
     * and those that failed.
     *
     * @param results - The results to be partitioned
     * @returns An object with a succeeded property containing the succeeded
     * results and a failed property containing the failed results
     */
    export function partition<TSuccess, TError>(
        results: Array<Result<TSuccess, TError>>
    ): { succeeded: Array<TSuccess>, failed: Array<TError>; } {

        const [succeeded, failed] = _.partition(results, (res) => res.succeeded);
        return {
            succeeded: succeeded.map((res) => res.value),
            failed:    failed.map((res) => res.error)
        };
    }


    /**
     * Converts a boolean value to a Result where falsy values become a
     * successful Result containing _val_ and truthy values become a failed
     * Result containing the specified error message.
     *
     * @param trueErrVal - Error value use if the input is truthy
     * @param val - The input value
     * @returns A successful Result if the input is falsy; a failure Result
     * otherwise.
     */
    // Eager form.
    export function requireFalsy<TE, TVal>(
        trueErrVal: TE,
        val: TVal
    ): Result<TVal, TE>;

    // Curried (point-free) form.
    export function requireFalsy<TE, TVal>(
        trueErrVal: TE
    ): (val: TVal) => Result<TVal, TE>;

    export function requireFalsy(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (trueErrVal: unknown, val: unknown) => val ? new FailedResult(trueErrVal) : new SucceededResult(val)
        );
    }


    /**
     * Converts an object containing an _ok_ property (such as a fetch response)
     * to a Result.
     *
     * @param errVal - Error value to use if the ok property is false
     * @param val - The input object that has an ok property
     * @returns If _ok_ is truthy, a successful Result wrapping _val_.
     * Otherwise, a failed Result containing the error message.
     */
    // Eager form.
    export function requireOk<TE, TVal extends {ok: boolean}>(
        errVal: TE,
        val: TVal
    ): Result<TVal, TE>;

    // Curried (point-free) form.
    export function requireOk<TE, TVal extends {ok: boolean}>(
        errVal: TE
    ): (val: TVal) => Result<TVal, TE>;

    export function requireOk(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (errVal: unknown, val: {ok: boolean}) => val.ok ? new SucceededResult(val) : new FailedResult(errVal)
        );
    }


    /**
     * Converts a boolean value to a Result where truthy values become a successful
     * Result containing true and falsy values become a failed Result containing
     * the specified error message.
     *
     * @param errVal - Error value used if the input is falsy
     * @param val - The input value
     * @returns A successful Result if the input is truthy; a failure Result
     * otherwise.
     */
    // Eager form.
    export function requireTruthy<TE, TVal>(
        errVal: TE,
        val: TVal | undefined | null
    ): Result<TVal, TE>;

    // Curried (point-free) form.
    export function requireTruthy<TE, TVal>(
        errVal: TE
    ): (val: TVal | undefined | null) => Result<TVal, TE>;

    export function requireTruthy(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (errVal: unknown, val: unknown) => val ? new SucceededResult(val) : new FailedResult(errVal)
        );
    }


    /**
     * Converts a possibly empty array to a Result for the array.
     *
     * @param errVal - The error value returned if _arr_ is empty
     * @param arr - The possibly empty array
    * @returns If _arr_ is empty, a failure result containing _errVal_.
     * Otherwise, a successful Result containing _arr_.
     */
    // Eager form.
    export function requireNonEmptyArray<TElem, TE>(
        errVal: TE,
        arr: Array<TElem>
    ): Result<Array<TElem>, TE>;

    // Curried (point-free) form.
    export function requireNonEmptyArray<TElem, TE>(
        errVal: TE
    ): (arr: Array<TElem>) => Result<Array<TElem>, TE>;

    export function requireNonEmptyArray(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (errVal: unknown, arr: Array<unknown>) => {
                return arr.length === 0 ?
                    new FailedResult(errVal) :
                    new SucceededResult(arr);
            }
        );
    }


    /**
     * Converts an array to a Result for the array.
     *
     * @param errVal - The error value returned if _arr_ does not have exactly
     * one element
     * @param arr - The input array
     * @returns If _arr_ has one element, a successful Result containing the one
     * element of _arr_. Otherwise, a failure Result containing _errVal_.
     */
    // Eager form.
    export function requireOneElementArray<TElem, TE>(
        errVal: TE,
        arr: Array<TElem>
    ): Result<TElem, TE>;

    // Curried (point-free) form.
    export function requireOneElementArray<TElem, TE>(
        errVal: TE
    ): (arr: Array<TElem>) => Result<TElem, TE>;

    export function requireOneElementArray(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (errVal: unknown, arr: Array<unknown>) => {
                return arr.length === 1 ?
                    new SucceededResult(arr[0]!) :
                    new FailedResult(errVal);
            }
        );
    }


    /**
     * Performs side-effects for the given Result
     *
     * @param fn - The function to invoke, passing the Result
     * @param input - The input Result
     * @returns The original input Result
     */
    // Eager form.
    export function tap<TInS, TE>(
        fn: (res: Result<TInS, TE>) => unknown,
        input: Result<TInS, TE>
    ): Result<TInS, TE>;

    // Curried (point-free) form.
    export function tap<TInS, TE>(
        fn: (res: Result<TInS, TE>) => unknown
    ): (input: Result<TInS, TE>) => Result<TInS, TE>;

    export function tap(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (res: Result<unknown, unknown>) => unknown, input: Result<unknown, unknown>) => input.tap(fn)
        );
    }


    /**
     * Performs side-effects for the given Result.
     *
     * @param fn - Async side-effect callback receiving the input Result
     * @param input - The input Result
     * @returns The original input Result
     */
    // Eager form.
    export function tapAsync<TInS, TE>(
        fn: (res: Result<TInS, TE>) => Promise<unknown>,
        input: Result<TInS, TE>
    ): Promise<Result<TInS, TE>>;

    // Curried (point-free) form.
    export function tapAsync<TInS, TE>(
        fn: (res: Result<TInS, TE>) => Promise<unknown>
    ): (input: Result<TInS, TE>) => Promise<Result<TInS, TE>>;

    export function tapAsync(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (res: Result<unknown, unknown>) => Promise<unknown>, input: Result<unknown, unknown>) => input.tapAsync(fn)
        );
    }


    /**
     * Performs side-effects when the specified Result is a failure
     *
     * @param fn - The function to invoke, passing the failed Result's error
     * @param input - The input Result
     * @returns The original input Result
     */
    // Eager form.
    export function tapError<TInS, TE>(
        fn: (val: TE) => unknown,
        input: Result<TInS, TE>
    ): Result<TInS, TE>;

    // Curried (point-free) form.
    export function tapError<TInS, TE>(
        fn: (val: TE) => unknown
    ): (input: Result<TInS, TE>) => Result<TInS, TE>;

    export function tapError(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (val: unknown) => unknown, input: Result<unknown, unknown>) => input.tapError(fn)
        );
    }


    /**
     * Performs side-effects when the specified Result is a failure.
     *
     * @param fn - Async side-effect callback receiving the error value
     * @param input - The input Result
     * @returns The original input Result
     */
    // Eager form.
    export function tapErrorAsync<TInS, TE>(
        fn: (val: TE) => Promise<unknown>,
        input: Result<TInS, TE>
    ): Promise<Result<TInS, TE>>;

    // Curried (point-free) form.
    export function tapErrorAsync<TInS, TE>(
        fn: (val: TE) => Promise<unknown>
    ): (input: Result<TInS, TE>) => Promise<Result<TInS, TE>>;

    export function tapErrorAsync(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (val: unknown) => Promise<unknown>, input: Result<unknown, unknown>) => input.tapErrorAsync(fn)
        );
    }


    /**
     * Performs side-effects when the specified Result is successful
     *
     * @param fn - The function to invoke, passing the successful Result's value
     * @param input - The input Result
     * @returns The original input Result
     */
    // Eager form.
    export function tapSuccess<TInS, TE>(
        fn: (val: TInS) => unknown,
        input: Result<TInS, TE>
    ): Result<TInS, TE>;

    // Curried (point-free) form.
    export function tapSuccess<TInS, TE>(
        fn: (val: TInS) => unknown
    ): (input: Result<TInS, TE>) => Result<TInS, TE>;

    export function tapSuccess(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (val: unknown) => unknown, input: Result<unknown, unknown>) => input.tapSuccess(fn)
        );
    }


    /**
     * Performs side-effects when the specified Result is successful.
     *
     * @param fn - Async side-effect callback receiving the success value
     * @param input - The input Result
     * @returns The original input Result
     */
    // Eager form.
    export function tapSuccessAsync<TInS, TE>(
        fn: (val: TInS) => Promise<unknown>,
        input: Result<TInS, TE>
    ): Promise<Result<TInS, TE>>;

    // Curried (point-free) form.
    export function tapSuccessAsync<TInS, TE>(
        fn: (val: TInS) => Promise<unknown>
    ): (input: Result<TInS, TE>) => Promise<Result<TInS, TE>>;

    export function tapSuccessAsync(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (fn: (val: unknown) => Promise<unknown>, input: Result<unknown, unknown>) => input.tapSuccessAsync(fn)
        );
    }


    /**
     * Unwraps a successful Result, throwing if it is a failure.
     *
     * @param result - The Result to be unwrapped
     * @returns The unwrapped successful Result value
     */
    export function throwIfFailed<TSuccess, TError>(
        result: Result<TSuccess, TError>
    ): TSuccess {
        return result.throwIfFailed();
    }


    /**
     * Unwraps a successful Result, throwing if it is a failure.
     *
     * @param errorMsg - The error message to use when throwing in the event the
     * Result is a failure
     * @param result - The input Result
     * @returns The unwrapped successful Result value
     */
    // Eager form (string).
    export function throwIfFailedWith<TInS, TE>(
        errorMsg: string,
        result: Result<TInS, TE>
    ): TInS;

    /**
     * Unwraps a successful Result, throwing if it is a failure.
     *
     * @param errorMapFn - A function that converts the error to an error
     * message.  The returned string will be the thrown Error object's message.
     * @param result - The input Result
     * @returns The unwrapped successful Result value
     */
    // Eager form (function).
    export function throwIfFailedWith<TInS, TE>(
        errorMapFn: (err: TE) => string,
        result: Result<TInS, TE>
    ): TInS;

    // Curried (point-free) form (string).
    export function throwIfFailedWith<TInS, TE>(
        errorMsg: string
    ): (result: Result<TInS, TE>) => TInS;

    // Curried (point-free) form (function).
    export function throwIfFailedWith<TInS, TE>(
        errorMapFn: (err: TE) => string
    ): (result: Result<TInS, TE>) => TInS;

    export function throwIfFailedWith(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (errorMsgOrFn: string | ((err: unknown) => string), result: Result<unknown, unknown>) => result.throwIfFailedWith(errorMsgOrFn)
        );
    }


    /**
     * Unwraps a failed Result, throwing if it is successful.
     *
     * @param result - The Result to be unwrapped
     * @returns The unwrapped failed Result error
     */
    export function throwIfSucceeded<TSuccess, TError>(
        result: Result<TSuccess, TError>
    ): TError {
        return result.throwIfSucceeded();
    }


    /**
     * Unwraps a failed Result, throwing if it is a success.
     *
     * @param errorMsg - The error message to use when throwing in the event the
     * Result is a success.
     * @param result - The input Result
     * @returns The unwrapped failed Result error.
     */
    // Eager form (string).
    export function throwIfSucceededWith<TInS, TE>(
        errorMsg: string,
        result: Result<TInS, TE>
    ): TE;

    /**
     * Unwraps a failed Result, throwing if it is a success.
     *
     * @param errorMapFn - A function that converts a successful Result to an
     * error message.  The returned string will be the throw Error object's
     * message.
     * @param result - The input Result
     * @returns The unwrapped failed Result error.
     */
    // Eager form (function).
    export function throwIfSucceededWith<TInS, TE>(
        errorMapFn: (val: TInS) => string,
        result: Result<TInS, TE>
    ): TE;

    // Curried (point-free) form (string).
    export function throwIfSucceededWith<TInS, TE>(
        errorMsg: string
    ): (result: Result<TInS, TE>) => TE;

    // Curried (point-free) form (function).
    export function throwIfSucceededWith<TInS, TE>(
        errorMapFn: (val: TInS) => string
    ): (result: Result<TInS, TE>) => TE;

    export function throwIfSucceededWith(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (errorMsgOrFn: string | ((val: unknown) => string), result: Result<unknown, unknown>) => result.throwIfSucceededWith(errorMsgOrFn)
        );
    }


    /**
     * Converts a Result to a nullable value.  If the Result is successful, the
     * value is returned.  If the Result is a failure, the provided nullable
     * value is returned.
     *
     * @param nullishValue - The value to return if the Result is a failure
     * @param result - The input Result
     * @returns The resulting nullable value
     */
    // Eager form.
    export function toNullable<TInS, TE, TNullish extends undefined | null>(
        nullishValue: TNullish,
        result: Result<TInS, TE>
    ): TInS | TNullish;

    // Curried (point-free) form.
    export function toNullable<TInS, TE, TNullish extends undefined | null>(
        nullishValue: TNullish
    ): (result: Result<TInS, TE>) => TInS | TNullish;

    export function toNullable(...args: Array<unknown>): unknown {
        return dispatchLast(
            2,
            args,
            (nullishValue: undefined | null, result: Result<unknown, unknown>) => result.toNullable(nullishValue)
        );
    }


    /**
     * Converts a Result to an Option.
     *
     * @param result - The Result to be converted
     * @returns If the input Result is successful, an Option containing the
     * value.  If the input Result is a failure, NoneOption.
     */
    export function toOption<TSuccess, TError>(
        result: Result<TSuccess, TError>
    ): Option<TSuccess> {
        const opt = result.toOption();
        return opt;
    }

}
