/**
 * The identity function.
 *
 * @param arg - The item that will be returned.
 * @return The value that was passed in
 */
export function id<T>(arg: T): T {
    return arg;
}


////////////////////////////////////////////////////////////////////////////////
// Self Mappers
////////////////////////////////////////////////////////////////////////////////

/**
 * A function that takes a value of type T as input and returns a value of the
 * same type T, but potentially transformed.
 */
export type SelfMapper<T> = (arg: T) => T;


/**
 * A function that takes a value of type T as input and returns a Promise that
 * resolves to a value of the same type T, but potentially transformed.
 */
export type SelfMapperAsync<T> = (arg: T) => Promise<T>;


/**
 * Applies a sequence of self-mapping functions to each element in the input
 * array.
 *
 * @param inputs - The array of input values to transform.
 * @param mappers - The array of functions to apply sequentially to each input.
 * @return An array containing the final transformed value for each input.
 */
export function applyMappers<T>(inputs: T[], mappers: SelfMapper<T>[]): T[] {
    return inputs.map(
        (input) => mappers.reduce((acc, mapper) => mapper(acc), input)
    );
}


/**
 * Applies a sequence of asynchronous self-mapping functions to each element in
 * the input array.
 *
 * @param inputs - The array of input values to transform.
 * @param mappers - The array of asynchronous functions to apply sequentially to
 * each input.
 * @return A promise that resolves to an array containing the final transformed
 * value for each input.
 */
export async function applyMappersAsync<T>(
    inputs: T[],
    mappers: SelfMapperAsync<T>[]
): Promise<T[]> {
    return Promise.all(
        inputs.map(async (input) => {
            let result = input;
            for (const mapper of mappers) {
                result = await mapper(result);
            }
            return result;
        })
    );
}
