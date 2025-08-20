
/**
 * Type describing an object that contains a disposable resource.
 */
export type Disposable<T> =
    T &
    {
        [Symbol.dispose](): void;
    };


/**
 * Creates a disposable object by combining the provided object with a dispose
 * function.
 *
 * @example
 *
 * @param obj - The object to make disposable
 * @param disposeFn - The function to call when disposing of the object
 * @return A disposable version of the provided object.
 */
export function makeDisposable<T>(obj: T, disposeFn: (obj: T) => void): Disposable<T> {
    const disposable = {
        ...obj,
        [Symbol.dispose]: () => {
            disposeFn(obj);
        }
    };
    return disposable;
}


/**
 * Type describing an object that contains an asynchronously disposable resource.
 */
export type AsyncDisposable<T> =
    T &
    {
        [Symbol.asyncDispose](): Promise<void>;
    };


/**
 * Creates an asynchronously disposable object by combining the provided object
 * with an asynchronous dispose function.
 *
 * @example
 *
 * @param obj - The object to make asynchronously disposable
 * @param asyncDisposeFn - The function to call when disposing of the object
 * @return An asynchronously disposable version of the provided object.
 */
export function makeAsyncDisposable<T>(obj: T, asyncDisposeFn: (x: T) => Promise<void>): AsyncDisposable<T> {
    const asyncDisposable = {
        ...obj,
        [Symbol.asyncDispose]: async () => {
            await asyncDisposeFn(obj);
        }
    };
    return asyncDisposable;
}
