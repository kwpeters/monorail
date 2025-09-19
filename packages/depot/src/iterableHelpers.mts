import { NoneOption, Option, SomeOption } from "./option.mjs";


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


/**
 * Finds the first duplicate item in the specified iterable, where duplicates
 * are determined by the specified criterion function.
 *
 * @param items - The iterable to search for duplicates
 * @param criterionFn - The function that determines the criterion for
 * identifying duplicates
 * @return An Option containing the first duplicate item and its criterion, or
 * NoneOption if no duplicates are found
 */
export function findFirstDuplicateBy<TElem, TCriterion>(
    items: Iterable<TElem>,
    criterionFn: (curItem: TElem) => TCriterion
): Option<{elem: TElem, criterion: TCriterion}> {

    const seen = new Set<TCriterion>();
    for (const curItem of items) {
        const criterion = criterionFn(curItem);
        if (seen.has(criterion)) {
            return new SomeOption({ elem: curItem, criterion });
        }
        seen.add(criterion);
    }
    return NoneOption.get();
}
