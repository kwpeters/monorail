/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */

/**
 * Combinators that let a function be called either eagerly (with all arguments)
 * or curried (with all-but-one argument, returning a function that awaits the
 * remaining argument).  The dispatch logic lives here, once, so individual
 * namespace functions (Result.*, Option.*) stay one-liners.
 *
 * Dispatch is purely by argument count: an eager form that places its "value"
 * argument last (data-last) runs eagerly when called with `arity` arguments and
 * returns the curried continuation when called with fewer.
 *
 * Currently only `dispatchLast` is used in the Result/Option namespaces (they
 * are uniformly data-last).  `dispatchFirst`, `dual`, and `dualFlip` are kept as
 * general-purpose utilities for future use:
 *   - `dispatchFirst` / `dualFlip` handle the value-first (data-first) shape.
 *   - `dual` / `dualFlip` wrap the dispatch helpers into a ready-to-export
 *     function, for the compact `const f = dual(2, impl)` authoring style.
 *
 * Authoring styles:
 *
 *   // Style A — `const` + call-signature type + `dual` (most compact):
 *   export const mapSuccess: { (fn, input): R; (fn): (input) => R; } =
 *       dual(2, (fn, input) => input.mapSuccess(fn));
 *
 *   // Style B — `function` overloads + `dispatchLast` (keeps per-overload JSDoc):
 *   export function bind(fn, input): R;
 *   export function bind(fn): (input) => R;
 *   export function bind(...args: Array<unknown>): unknown {
 *       return dispatchLast(2, args, (fn, input) => input.bind(fn));
 *   }
 */


/**
 * Performs data-last dispatch for an already-collected argument list.  If
 * `args` contains at least `arity` items the implementation runs eagerly;
 * otherwise a continuation awaiting the final argument is returned.
 *
 * @param arity - The number of arguments the eager form accepts.
 * @param args - The arguments the caller actually supplied.
 * @param impl - The data-last implementation `(...config, value) => result`.
 * @return Either the eager result or a `(value) => result` continuation.
 */
export function dispatchLast(
    arity: number,
    args: ReadonlyArray<unknown>,
    impl: (...args: Array<any>) => unknown
): unknown {
    return args.length >= arity ?
        impl(...args) :
        (last: unknown) => impl(...args, last);
}


/**
 * Performs value-first dispatch for an already-collected argument list (for
 * functions whose eager form places the value first, e.g.
 * `fromNullable(value, errVal)`).  The curried form takes the config arguments
 * and returns `(value) => result`.
 *
 * @param arity - The number of arguments the eager form accepts.
 * @param args - The arguments the caller actually supplied.
 * @param impl - The implementation, written value-first: `(value, ...config)`.
 * @return Either the eager result or a `(value) => result` continuation.
 */
export function dispatchFirst(
    arity: number,
    args: ReadonlyArray<unknown>,
    impl: (...args: Array<any>) => unknown
): unknown {
    return args.length >= arity ?
        impl(...args) :
        (value: unknown) => impl(value, ...args);
}


/**
 * Wraps a data-last implementation so it can be called eagerly or curried.  The
 * eager form is `(...config, value)`; the curried form is `(...config)`, which
 * returns `(value) => result`.
 *
 * @param arity - The number of arguments the eager form accepts.
 * @param impl - The data-last implementation.
 * @return A function supporting both calling conventions.  The precise public
 * type is supplied by the call-signature annotation on the exported member.
 */
export function dual<TFn>(
    arity: number,
    impl: (...args: Array<any>) => unknown
): TFn {
    const fn = (...args: Array<unknown>): unknown => dispatchLast(arity, args, impl);
    return fn as unknown as TFn;
}


/**
 * Like {@link dual}, but for functions whose eager form places the value first.
 * The curried form takes the remaining (config) arguments and returns
 * `(value) => result`.
 *
 * @param arity - The number of arguments the eager form accepts.
 * @param impl - The implementation, written value-first: `(value, ...config)`.
 * @return A function supporting both the eager (value-first) and curried
 * (config-first) calling conventions.
 */
export function dualFlip<TFn>(
    arity: number,
    impl: (...args: Array<any>) => unknown
): TFn {
    const fn = (...args: Array<unknown>): unknown => dispatchFirst(arity, args, impl);
    return fn as unknown as TFn;
}


/**
 * Partially applies `fn` by binding its leading arguments.  Returns a new
 * function that accepts the remaining (trailing) arguments and invokes `fn` with
 * the preset arguments followed by the remaining ones.
 *
 * @example
 * const add = (a: number, b: number, c: number) => a + b + c;
 * const add5 = partial(add, 5);      // (b, c) => 5 + b + c
 * add5(10, 20);                       // 35
 *
 * @param fn - The function to partially apply.
 * @param presetArgs - The leading arguments to bind now.
 * @return A function that takes the remaining arguments and calls `fn` with the
 * preset arguments prepended.
 */
export function partial<TTrailingArgs extends any[], TPresetArgs extends any[], TReturn>(
    fn: (...args: [...TPresetArgs, ...TTrailingArgs]) => TReturn,
    ...presetArgs: TPresetArgs
): (...remainingArgs: TTrailingArgs) => TReturn {
    return (...remainingArgs: TTrailingArgs) => fn(...presetArgs, ...remainingArgs);
}
