/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */


import { inspect } from "./inspect.mjs";


/**
 * Represents an optional value that is set.
 */
export class SomeOption<T> {
    private readonly _value: T;

    public constructor(value: T) {
        this._value = value;
    }

    public readonly isSome = true;

    public readonly isNone = false;

    public get value(): T {
        return this._value;
    }

    public toString(): string {
        const str = `SomeOption ${inspect(this._value)}`;
        return str;
    }

    public augment<TAugment>(
        fn: (val: T) => Option<TAugment>
    ): Option<T & TAugment> {
        const fnOpt = fn(this._value);
        if (fnOpt.isNone) {
            return fnOpt;
        }

        const augmented = { ...this._value, ...fnOpt._value};
        return new SomeOption(augmented);
    }


    public async augmentAsync<TAugment>(
        fn: (val: T) => Promise<Option<TAugment>>
    ): Promise<Option<T & TAugment>> {
        const fnOpt = await fn(this._value);
        if (fnOpt.isNone) {
            return fnOpt;
        }

        const augmented = { ...this._value, ...fnOpt._value};
        return new SomeOption(augmented);
    }


    public bind<TOut>(
        fn: (val: T) => Option<TOut>
    ): Option<TOut> {
        const opt = fn(this._value);
        return opt;
    }


    public bindAsync<TOut>(
        fn: (val: T) => Promise<Option<TOut>>
    ): Promise<Option<TOut>> {
        const opt = fn(this._value);
        return opt;
    }


    public bindNone<TOut>(
        fn: () => Option<TOut>
    ): this {
        return this;
    }


    public bindNoneAsync<TOut>(
        fn: () => Promise<Option<TOut>>
    ): Promise<this> {
        return Promise.resolve(this);
    }


    public defaultValue<TDefault>(
        defaultValue: TDefault
    ): T {
        return this._value;
    }


    public defaultWith<TDefault>(
        fn: () => TDefault
    ): T {
        return this._value;
    }


    public defaultWithAsync<TDefault>(
        fn: () => Promise<TDefault>
    ): Promise<T> {
        return Promise.resolve(this._value);
    }


    public mapSome<TOut>(
        fn: (val: T) => TOut
    ): Option<TOut> {
        const newVal = fn(this._value);
        return new SomeOption(newVal);
    }


    public async mapSomeAsync<TOut>(
        fn: (val: T) => Promise<TOut>
    ): Promise<Option<TOut>> {
        const newVal = await fn(this._value);
        return new SomeOption(newVal);
    }

    public match<TSomeOut, TNoneOut>(
        fnSome: (val: T) => TSomeOut,
        fnNone: () => TNoneOut
    ): TSomeOut {
        const out = fnSome(this._value);
        return out;
    }


    public matchAsync<TSomeOut, TNoneOut>(
        fnSome: (val: T) => Promise<TSomeOut>,
        fnNone: () => Promise<TNoneOut>
    ): Promise<TSomeOut> {
        return fnSome(this._value);
    }


    public matchWith<TSomeOut, TNoneOut>(
        matcherFns: {some: (val: T) => TSomeOut, none: () => TNoneOut}
    ): TSomeOut {
        const out = matcherFns.some(this._value);
        return out;
    }


    public matchWithAsync<TSomeOut, TNoneOut>(
        matcherFns: {some: (val: T) => Promise<TSomeOut>, none: () => Promise<TNoneOut>}
    ): Promise<TSomeOut> {
        return matcherFns.some(this._value);
    }


    public throwIfNone(): T {
        return this._value;
    }


    public throwIfNoneWith(
        fn: () => string
    ): T {
        return this._value;
    }


    public throwIfNoneWithAsync(
        fn: () => Promise<string>
    ): Promise<T> {
        return Promise.resolve(this._value);
    }


    public throwIfSome(): void {
        const errMsg = `Expected no value but got "${inspect(this._value)}"`;
        throw new Error(errMsg);
    }


    public throwIfSomeWith(
        fn: (val: T) => string
    ): void {
        const errorMsg = fn(this._value);
        throw new Error(errorMsg);
    }


    public async throwIfSomeWithAsync(
        fn: (val: T) => Promise<string>
    ): Promise<void> {
        const errorMsg = await fn(this._value);
        throw new Error(errorMsg);
    }


    public toNullable<TNullish extends undefined | null>(
        nullishValue: TNullish
    ): T {
        return this._value;
    }

}


/**
 * Represents an optional value that is not set.
 */
export class NoneOption {

    private static readonly _instance: NoneOption = new NoneOption();

    /**
     * Gets the one-and-only instance.  Implemented as a single (1) to reduce
     * memory consumption and (2) to allow JS's === operator (which uses
     * reference equality) to work as expected.
     *
     * @returns The singleton instance
     */
    public static get(): NoneOption {
        return NoneOption._instance;
    }

    /**
     * Private constructor.  Use static get() method to get the one-and-only
     * instance.
     */
    private constructor() {
        // Intentionally empty
    }

    public readonly isSome = false;

    public readonly isNone = true;

    public get value(): undefined {
        return undefined;
    }

    public toString(): string {
        return "NoneOption";
    }

    public augment<TAugment>(
        fn: (val: never) => Option<TAugment>
    ): this {
        return this;
    }


    public augmentAsync<TAugment>(
        fn: (val: never) => Promise<Option<TAugment>>
    ): Promise<this> {
        return Promise.resolve(this);
    }

    public bind<TOut>(
        fn: (val: never) => Option<TOut>
    ): this {
        return this;
    }


    public bindAsync<TOut>(
        fn: (val: never) => Promise<Option<TOut>>
    ): Promise<this> {
        return Promise.resolve(this);
    }

    public bindNone<TOut>(
        fn: () => Option<TOut>
    ): Option<TOut> {
        const bound = fn();
        return bound;
    }


    public bindNoneAsync<TOut>(
        fn: () => Promise<Option<TOut>>
    ): Promise<Option<TOut>> {
        const bound = fn();
        return bound;
    }

    public defaultValue<TDefault>(
        defaultValue: TDefault
    ): TDefault {
        return defaultValue;
    }

    public defaultWith<TDefault>(
        fn: () => TDefault
    ): TDefault {
        const val = fn();
        return val;
    }


    public async defaultWithAsync<TDefault>(
        fn: () => Promise<TDefault>
    ): Promise<TDefault> {
        const val = await fn();
        return val;
    }

    public mapSome<TOut>(
        fn: (val: never) => TOut
    ): this {
        return this;
    }


    public mapSomeAsync<TOut>(
        fn: (val: never) => Promise<TOut>
    ): Promise<this> {
        return Promise.resolve(this);
    }

    public match<TSomeOut, TNoneOut>(
        fnSome: (val: never) => TSomeOut,
        fnNone: () => TNoneOut
    ): TNoneOut {
        const out = fnNone();
        return out;
    }


    public matchAsync<TSomeOut, TNoneOut>(
        fnSome: (val: never) => Promise<TSomeOut>,
        fnNone: () => Promise<TNoneOut>
    ): Promise<TNoneOut> {
        return fnNone();
    }

    public matchWith<TSomeOut, TNoneOut>(
        matcherFns: {some: (val: never) => TSomeOut, none: () => TNoneOut}
    ): TNoneOut {
        const out = matcherFns.none();
        return out;
    }


    public matchWithAsync<TSomeOut, TNoneOut>(
        matcherFns: {some: (val: never) => Promise<TSomeOut>, none: () => Promise<TNoneOut>}
    ): Promise<TNoneOut> {
        return matcherFns.none();
    }

    public throwIfNone(): never {
        const errMsg = "throwIfNone() called on a NoneOption.";
        throw new Error(errMsg);
    }


    public throwIfNoneWith(
        fn: () => string
    ): never {
        const errorMsg = fn();
        throw new Error(errorMsg);
    }


    public async throwIfNoneWithAsync(
        fn: () => Promise<string>
    ): Promise<never> {
        const errorMsg = await fn();
        throw new Error(errorMsg);
    }


    public throwIfSome(): void {
        // Intentionally empty.
    }

    public throwIfSomeWith(
        fn: (val: never) => string
    ): void {
        // Intentionally empty.
    }


    public throwIfSomeWithAsync(
        fn: (val: never) => Promise<string>
    ): Promise<void> {
        return Promise.resolve();
    }


    public toNullable<TNullish extends undefined | null>(
        nullishValue: TNullish
    ): TNullish  {
        return nullishValue;
    }

}


/**
 * Represents an object that may or may not contain a value.
 */
export type Option<T> = SomeOption<T> | NoneOption;


////////////////////////////////////////////////////////////////////////////////
// Option Utility Types

// The following types extract the some type from an Option<T>.
// Since Option is a union, distributivity must be turned off.  See this post:
// https://stackoverflow.com/a/69164888

export type OptionSomeType<T> = [T] extends [Option<infer X>] ? X : never;

/**
 * When given an object with type {[k: string]: Option<S>}, the following
 * type will give you an object type where the keys are taken from T and the
 * values have the associated Option some types.
 *
 * For example:
 *     const options = {
 *         opt1: new SomeOption("hello"),
 *         opt2: NoneOption.get() as Option<number>
 *     };
 *
 *     type S1 = AllSomeTypes<typeof options>;
 *     // type S1 = {
 *     //     opt1: string;
 *     //     opt2: number;
 *     // };
 */
export type AllSomeTypes<T extends Record<string, Option<unknown>>> = {
    [P in keyof T]: OptionSomeType<T[P]>
};


/**
 * A namespace that will be merged with the Option type.  Serves as a useful
 * place to create functions that operate on Option objects.
 */
export namespace Option {

    /**
     * When all input Options are "some", returns a "some" Option containing an
     * array of the values.  If the input contains one (or more) "none" options,
     * the first "none" Option is returned.
     *
     * @param collection - The input collection
     * @returns
     */
    export function all<T>(
        collection: Array<Option<T>>
    ): Option<Array<T>> {
        const firstNone = collection.find((curOpt): curOpt is NoneOption => curOpt instanceof NoneOption);
        return firstNone ?? new SomeOption(collection.map((curOpt) => (curOpt as SomeOption<T>).value));
    }


    /**
     * Tests if all object values are some options.
     *
     * @param namedOptions - An object where the keys are strings and the values are
     * Option objects.
     * @return If all Options are some, a some Option wrapping an
     * object having the same keys and the values are the Option values.
     * Otherwise, a none Option is returned.
     */
    export function allObj<T extends Record<string, Option<unknown>>>(
        namedOptions: T
    ): Option<AllSomeTypes<T>> {
        const options = Object.values(namedOptions);
        const firstNoneIdx = options.findIndex((opt) => opt.isNone);
        if (firstNoneIdx === -1) {
            // All were Some.  Return an object of the some values.
            const someValuesObj: Record<string, unknown> = {};
            for (const [name, opt] of Object.entries(namedOptions)) {
                someValuesObj[name] = (opt as SomeOption<unknown>).value;
            }
            return new SomeOption(someValuesObj as AllSomeTypes<T>);
        }
        else {
            // A none was found.  Return it.
            return NoneOption.get();
        }
    }


    /**
     * If the input Option is Some, invokes _fn_ with the value.  If a Some
     * Option is returned, the original input value is augmented with the value.
     * Augment is a lot like bind(), except it automatically includes all of the
     * input's properties.  It can also serve as a reality check or gate when
     * augmenting no additional properties.
     *
     * @param fn - Function that will be invoked if the input is a Some Option.
     * Returns an Option.  If Some, the  properties will be added to _input_ and
     * returned as a Some Option.
     * @param input - The input Option
     * @returns An None Option if the input is None or _fn_ returns None.
     * Otherwise, a successful Option containing all properties of the original
     * input and the value returned by _fn_.
     */
    export function augment<TInput, TAugment>(
        fn: (input: TInput) => Option<TAugment>,
        input: Option<TInput>
    ): Option<TInput & TAugment> {
        return input.augment(fn);
    }


    /**
     * If the input Option is Some, invokes _fn_ with the value. If a Some
     * Option is returned, the original input value is augmented with the value.
     * If _input_ or the Option returned by _fn_ is None, None is returned.
     *
     * @param fn - Async augment function invoked for Some input
     * @param input - The input Option
     * @return A Promise for the augmented Option
     */
    export function augmentAsync<TInput, TAugment>(
        fn: (input: TInput) => Promise<Option<TAugment>>,
        input: Option<TInput>
    ): Promise<Option<TInput & TAugment>> {
        return input.augmentAsync(fn);
    }


    /**
     * If _input_ is "some", unwraps the value and passes it into _fn_,
     * returning its returned Option.  If _input_ is not "some" returns it.
     *
     * @param fn - The function to invoke on _input.value_ when _input_ is
     * "some"
     * @param - The input Option
     * @returns Either the passed-through NoneOption or the Option returned from
     * _fn_.
     */
    export function bind<TIn, TOut>(
        fn: (x: TIn) => Option<TOut>,
        input: Option<TIn>
    ): Option<TOut> {
        return input.bind(fn);
    }


    /**
     * If _input_ is "some", unwraps the value and passes it into _fn_,
     * returning its returned Option. If _input_ is not "some", returns it.
     *
     * @param fn - Async bind function invoked for Some input
     * @param input - The input Option
     * @return A Promise for the bound Option
     */
    export function bindAsync<TIn, TOut>(
        fn: (x: TIn) => Promise<Option<TOut>>,
        input: Option<TIn>
    ): Promise<Option<TOut>> {
        return input.bindAsync(fn);
    }


    /**
     * If _input_ is "none", calls _fn_, returning its returned Option.  If
     * _input_ is "some", returns it.
     *
     * This function effectively allows you to "fallback" if a previous
     * operation returned none.
     *
     * @param fn - The function to invoke when _input_ is none.
     * @param input - The input Option
     * @return Either the passed-through "some" Option or the Option returned
     * from _fn_.
     */
    export function bindNone<TIn, TOut>(
        fn: () => Option<TOut>,
        input: Option<TIn>
    ): Option<TIn | TOut> {
        return input.bindNone(fn);
    }


    /**
     * If _input_ is "none", calls _fn_, returning its returned Option. If
     * _input_ is "some", returns it.
     *
     * @param fn - Async fallback function invoked for None input
     * @param input - The input Option
     * @return A Promise for the resulting Option
     */
    export function bindNoneAsync<TIn, TOut>(
        fn: () => Promise<Option<TOut>>,
        input: Option<TIn>
    ): Promise<Option<TIn | TOut>> {
        return input.bindNoneAsync(fn);
    }


    /**
     * Maps each input value through the specified mapping function.  If the
     * mapping function returns a Some result, its value is added to the output
     * array; otherwise nothing is added to the output array.
     *
     * @param fn - The function that will map each input value to either a Some
     * whose value will be included in the output array or a None that will not
     * be included in the output array.
     * @param input - The input sequence
     * @returns  The output array
     */
    export function choose<TIn, TOut>(
        fn: (v: TIn) => Option<TOut>,
        input: Iterable<TIn>
    ): Array<TOut> {
        const inputArr = Array.from(input);
        const output =
            inputArr.reduce<Array<TOut>>(
                (acc, cur) => {
                    const res = fn(cur);
                    if (res.isSome) {
                        acc.push(res.value);
                    }
                    return acc;
                },
                []
            );
        return output;
    }


    /**
     * Maps each input value through the specified async mapping function. If
     * the mapping function resolves to a Some result, its value is added to
     * the output array; otherwise nothing is added to the output array.
     *
     * @param fn - The async function that maps each input value to either a
     * Some whose value will be included in the output array or a None that
     * will not be included in the output array.
     * @param input - The input sequence
     * @returns A Promise for the output array
     */
    export async function chooseAsync<TIn, TOut>(
        fn: (v: TIn) => Promise<Option<TOut>>,
        input: Iterable<TIn>
    ): Promise<Array<TOut>> {
        const output: Array<TOut> = [];
        for (const cur of input) {
            const res = await fn(cur);
            if (res.isSome) {
                output.push(res.value);
            }
        }

        return output;
    }


    /**
     * If the input is Some value, returns the contained value, else returns the
     * specified default value (which may be a different type).
     *
     * @param defaultValue - The default value to use if input is a None Option
     * Otherwise, returns the specified default value.
     * @param input - The input Option
     * @returns The contained value if input is Some, else the default value.
     */
    export function defaultValue<T, TDefault>(
        defaultValue: TDefault,
        input: Option<T>
    ): T | TDefault {
        return input.defaultValue(defaultValue);
    }


    /**
     * If the input is a Some value, returns the contained value, else returns
     * _fn()_ (which may be of a different type).  This function is useful when
     * getting the default value is expensive.
     *
     * @param fn - A function that can be invoked to get the default value.  Not
     * executed unless input is None.
     * @param input - The input Result
     * @returns The contained value if input is Some, else the value returned by
     * _fn_.
     */
    export function defaultWith<T, TDefault>(
        fn: () => TDefault,
        input: Option<T>
    ): T | TDefault {
        return input.defaultWith(fn);
    }


    /**
     * If the input is a Some value, returns the contained value, else returns
     * _fn()_ (which may be of a different type).  This function is useful when
     * getting the default value is expensive.
     *
     * @param fn - Async function that can be invoked to get the default value.
     * Not executed unless input is None.
     * @param input - The input Option
     * @return A Promise for the contained value if input is Some, else the
     * value returned by _fn_
     */
    export function defaultWithAsync<T, TDefault>(
        fn: () => Promise<TDefault>,
        input: Option<T>
    ): Promise<T | TDefault> {
        return input.defaultWithAsync(fn);
    }


    /**
     * Converts a boolean value into an Option wrapping the specified value.
     *
     * @param condition - The condition
     * @param trueVal - Value to be wrapped in a "some" Option when _condition_
     * is truthy
     * @returns The resulting Option
     */
    export function fromBool<T>(
        condition: unknown,
        trueVal: T
    ): Option<T> {
        return condition ?
            new SomeOption(trueVal) :
            NoneOption.get();
    }


    /**
     * Converts a value that may be undefined or null into an Option for
     * that value.
     *
     * @param nullable - A value that may be undefined or null
     * @return The resulting Option
     */
    export function fromNullable<T>(nullable: T | undefined | null): Option<T> {
        return (nullable === undefined) || (nullable === null) ?
            NoneOption.get() :
            new SomeOption(nullable);
    }


    /**
     * Converts a possibly empty array to an Option for the array.
     *
     * @param arr - The possibly empty array
     * @return If _arr_ was empty, NoneOption.  If _arr_ contained some items, a
     * SomeOption containing _arr_.
     */
    export function requireNonEmptyArray<T>(arr: Array<T>): Option<Array<T>> {
        return arr.length === 0 ?
            NoneOption.get() :
            new SomeOption(arr);
    }


    /**
     * Converts an array to an Option for the array.
     *
     * @param arr - The input array
     * @return If _arr_ has one element, a SomeOption containing the one element
     * of _arr_. Otherwise, a NoneOption.
     */
    export function requireOneElementArray<T>(arr: Array<T>): Option<T> {
        return arr.length === 1 ?
            new SomeOption(arr[0]!) :
            NoneOption.get();
    }


    /**
     * When _input_ is "some", maps the wrapped value using _fn_.
     *
     * @param fn - The function that maps the wrapped value to another value.
     * @param input - The input Option
     * @returns Either the mapped "some" option or the passed-through "none"
     * Option.
     */
    export function mapSome<TIn, TOut>(
        fn: (x: TIn) => TOut,
        input: Option<TIn>
    ): Option<TOut> {
        return input.mapSome(fn);
    }


    /**
     * When _input_ is "some", maps the wrapped value using _fn_.
     *
     * @param fn - Async mapping function invoked for Some input
     * @param input - The input Option
     * @return A Promise for the mapped Option
     */
    export function mapSomeAsync<TIn, TOut>(
        fn: (x: TIn) => Promise<TOut>,
        input: Option<TIn>
    ): Promise<Option<TOut>> {
        return input.mapSomeAsync(fn);
    }


    /**
     * When _input_ is "some" invokes _fnSome_ and returns the result.
     * When _input_ is "none" invokes _fnNone_ and returns the result.
     *
     * @param fnSome - Function that will be invoked when _input_ is a SomeOption.
     * @param fnNone - Function that will be invoked when _input_ is a NoneOption.
     * @param input - The input Option
     * @return The value returned by either _fnSome_ or _fnNone_
     */
    export function match<TIn, TSomeOut, TNoneOut>(
        fnSome: (val: TIn) => TSomeOut,
        fnNone: () => TNoneOut,
        input: Option<TIn>
    ): TSomeOut | TNoneOut {
        return input.match(fnSome, fnNone);
    }


    /**
     * When _input_ is "some" invokes _fnSome_ and returns the result.
     * When _input_ is "none" invokes _fnNone_ and returns the result.
     *
     * @param fnSome - Async function invoked when _input_ is a SomeOption
     * @param fnNone - Async function invoked when _input_ is a NoneOption
     * @param input - The input Option
     * @return A Promise for the value returned by either _fnSome_ or _fnNone_
     */
    export function matchAsync<TIn, TSomeOut, TNoneOut>(
        fnSome: (val: TIn) => Promise<TSomeOut>,
        fnNone: () => Promise<TNoneOut>,
        input: Option<TIn>
    ): Promise<TSomeOut | TNoneOut> {
        return input.matchAsync(fnSome, fnNone);
    }


    /**
     * When _input_ is "some" invokes the specified some function and returns the result.
     * When _input_ is "none" invokes the specified none function and returns the result.
     * This function is exactly like match(), except it specifies the some and
     * none functions in an object.  Because the functions are labeled with the
     * 'some' and 'none' property names, this can help make the calling code
     * easier to understand.
     *
     * @param matcherFns - An object that contains the some and none functions
     * @param input - The input Option
     * @return The value returned by the invoked handler function
     */
    export function matchWith<TIn, TSomeOut, TNoneOut>(
        matcherFns: {some: (val: TIn) => TSomeOut, none: () => TNoneOut},
        input: Option<TIn>
    ): TSomeOut | TNoneOut {
        const out = input.match(matcherFns.some, matcherFns.none);
        return out;
    }


    /**
     * When _input_ is "some" invokes the specified some function and returns
     * the result. When _input_ is "none" invokes the specified none function
     * and returns the result.
     *
     * @param matcherFns - An object that contains the async some and none
     * handler functions
     * @param input - The input Option
     * @return A Promise for the value returned by the invoked handler function
     */
    export function matchWithAsync<TIn, TSomeOut, TNoneOut>(
        matcherFns: {some: (val: TIn) => Promise<TSomeOut>, none: () => Promise<TNoneOut>},
        input: Option<TIn>
    ): Promise<TSomeOut | TNoneOut> {
        return input.matchWithAsync(matcherFns);
    }


    /**
     * Unwraps a SomeOption, throwing if it is a NoneOption.  Uses a generic
     * generated error message.
     *
     * @param opt - The input Option
     * @returns The unwrapped SomeOption value
     */
    export function throwIfNone<T>(
        input: Option<T>
    ): T {
        return input.throwIfNone();
    }


    /**
     * Unwraps a SomeOption.  If the Option is a NoneOption an Error is thrown
     * containing the error message returned by the specified function.
     *
     * @param fn - Function that will be invoked to get the error message when
     * the Option is a NoneOption
     * @param opt - The input Option
     * @returns The unwrapped SomeOption value
     */
    export function throwIfNoneWith<T>(
        fn: () => string,
        opt: Option<T>
    ): T {
        return opt.throwIfNoneWith(fn);
    }


    /**
     * Unwraps a SomeOption.  If the Option is a NoneOption an Error is thrown
     * containing the error message returned by the specified async function.
     *
     * @param fn - Async function that will be invoked to get the error message
     * when the Option is a NoneOption
     * @param opt - The input Option
     * @return A Promise for the unwrapped SomeOption value
     */
    export function throwIfNoneWithAsync<T>(
        fn: () => Promise<string>,
        opt: Option<T>
    ): Promise<T> {
        return opt.throwIfNoneWithAsync(fn);
    }


    /**
     * Throws if the specified Option is a SomeOption.  Uses a generic generated
     * error message.
     *
     * @param opt - The input Option
     * @return Description
     */
    export function throwIfSome<T>(
        opt: Option<T>
    ): void {
        return opt.throwIfSome();
    }


    /**
     * Throws an Error if the specified Option is a SomeOption.  Uses the
     * specified function to generate the error message.
     *
     * @param param - Description
     * @return Description
     */
    export function throwIfSomeWith<T>(
        fn: (val: T) => string,
        opt: Option<T>
    ): void {
        opt.throwIfSomeWith(fn);
    }


    /**
     * Throws an Error if the specified Option is a SomeOption.  Uses the
     * specified async function to generate the error message.
     *
     * @param fn - Async function that generates the error message
     * @param opt - The input Option
     * @return A Promise that resolves when no error is thrown
     */
    export function throwIfSomeWithAsync<T>(
        fn: (val: T) => Promise<string>,
        opt: Option<T>
    ): Promise<void> {
        return opt.throwIfSomeWithAsync(fn);
    }


    /**
     * Converts an Option<T> to a nullable value.  If the Option is a SomeOption, the
     * value is returned.  If the Option is a NoneOption, the provided nullable
     * value is returned.
     *
     * @param nullishValue - The value to return if the Option is a NoneOption
     * @param opt - The input Option
     * @return The resulting nullable value
     */
    export function toNullable<TOption, TNullish extends undefined | null>(
        nullishValue: TNullish,
        opt: Option<TOption>
    ): TOption | TNullish {
        return opt.toNullable(nullishValue);
    }

}
