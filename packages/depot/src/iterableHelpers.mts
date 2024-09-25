/**
 * Builds a Map of the specified items.  Each value's key in the map is gotten
 * by calling keyFn.
 *
 * @param items - The items that will become the values in the map
 * @param keyFn - The function that returns each item's key
 * @return The resulting Map
 */
export function buildIndex<T>(
    items: Iterable<T>,
    keyFn: (curItem: T) => string
): Map<string, T> {
    const index = new Map<string, T>();

    for (const curItem of items) {
        const key = keyFn(curItem);
        index.set(key, curItem);
    }

    return index;
}
