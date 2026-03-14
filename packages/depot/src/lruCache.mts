import { List, Iterator } from "./list.mjs";
import { VoMap } from "./voMap.mjs";
import { type HashFn } from "./hash.mjs";
import type { MaybePromise } from "./typeUtils.mjs";
import { Option, NoneOption, SomeOption } from "./option.mjs";


interface ILruListItem<TKey, TValue> {
    key:   TKey;
    value: TValue;
}


/**
 * A simple implementation of a Least Recently Used (LRU) cache. This cache will
 * store a fixed number of items and will evict the least recently used item
 * when the cache exceeds its capacity.  Characteristics of a LRU cache
 *   - bounded capacity (resizable via resize())
 *   - both get and put operations count as a "use"
 *   - both get and put run in O(1) time complexity
 *
 * See https://www.instagram.com/reels/DVwA4uljN4O/
 */
export class LruCache<TKey, TValue> {

    /**
     * This lookup map provides O(1) lookup and node location.
     */
    private readonly _lookupMap: VoMap<TKey, Iterator<ILruListItem<TKey, TValue>>>;

    /**
     * This doubly linked list provides O(1) reordering of items, which is
     * essential for maintaining the order of usage. The most recently used item
     * will be at the head of the list, while the least recently used item will
     * be at the tail. When an item is accessed or added, it will be moved to
     * the head of the list. When the cache exceeds its capacity, the item at
     * the tail of the list will be evicted.
     */
    private readonly _frequencyList = new List<ILruListItem<TKey, TValue>>();

    /**
     * The maximum number of elements that will be stored in this LruCache.
     */
    private _capacity: number;


    /**
     * Creates a new LruCache with the specified capacity.
     *
     * @param capacity - The maximum number of items this cache can hold
     * @param keyHashFn - Hash function used to compare keys in the lookup map
     */
    constructor(capacity: number, keyHashFn: HashFn<TKey>) {
        if (capacity <= 0) {
            throw new Error("Capacity must be greater than 0");
        }
        this._capacity = capacity;
        // Create an empty map that will use the given hashing function for key equality.
        this._lookupMap = new VoMap<TKey, Iterator<ILruListItem<TKey, TValue>>>(keyHashFn);
    }


    /**
     * Gets the maximum number of items this cache can hold.
     *
     * @returns The configured cache capacity
     */
    public get capacity(): number {
        return this._capacity;
    }

    /**
     * Gets the current number of items stored in this cache.
     *
     * @returns The current item count
     */
    public get size(): number {
        return this._lookupMap.size;
    }


    /**
     * Determines whether an item with the specified key exists in this cache.
     *
     * This method does not count as a use operation, so recency ordering is
     * not updated.
     *
     * @param key - The key to check for membership
     * @returns true if the key exists in this cache; otherwise false
     */
    public has(key: TKey): boolean {
        return this._lookupMap.has(key);
    }


    /**
     * Removes the item with the specified key from this cache.
     *
     * @param key - The key to remove
     * @returns true if the key existed and was removed; otherwise false
     */
    public delete(key: TKey): boolean {
        const it = this._lookupMap.get(key);
        if (it === undefined) {
            return false;
        }

        this._frequencyList.splice(it, 1);
        this._lookupMap.delete(key);
        return true;
    }


    /**
     * Removes all items from this cache.
     */
    public clear(): void {
        this._lookupMap.clear();
        this._frequencyList.splice(this._frequencyList.begin(), this._frequencyList.length);
    }


    /**
     * Adjusts this cache's capacity and evicts least recently used items if
     * needed.
     *
     * If the new capacity is smaller than the current size, items are evicted
     * from least recently used to most recently used until size <= new
     * capacity.
     *
     * @param newCapacity - The new maximum number of items this cache can hold
     */
    public resize(newCapacity: number): void {
        if (newCapacity <= 0) {
            throw new Error("Capacity must be greater than 0");
        }

        this._capacity = newCapacity;

        while (this._lookupMap.size > this._capacity) {
            // Evict tail item (least recently used) until within capacity.
            const it = this._frequencyList.end();
            it.prev();
            this._lookupMap.delete(it.value.key);
            this._frequencyList.splice(it, 1);
        }
    }


    /**
     * Returns an iterator over the cache keys in recency order.
     *
     * Items are yielded from most recently used to least recently used.
     *
     * @returns An iterator of keys in recency order
     */
    public *keys(): IterableIterator<TKey> {
        for (const item of this._frequencyList) {
            yield item.key;
        }
    }


    /**
     * Returns an iterator over the cache values in recency order.
     *
     * Items are yielded from most recently used to least recently used.
     *
     * @returns An iterator of values in recency order
     */
    public *values(): IterableIterator<TValue> {
        for (const item of this._frequencyList) {
            yield item.value;
        }
    }


    /**
     * Returns an iterator over the cache entries in recency order.
     *
     * Items are yielded from most recently used to least recently used.
     *
     * @returns An iterator of [key, value] pairs in recency order
     */
    public *entries(): IterableIterator<[TKey, TValue]> {
        for (const item of this._frequencyList) {
            yield [item.key, item.value];
        }
    }


    /**
     * Gets the value associated with the specified key without updating
     * recency.
     *
     * This method does not count as a use operation, so recency ordering is
     * not updated.
     *
     * @param key - The key to look up
     * @returns SomeOption containing the value if found; otherwise NoneOption
     */
    public peek(key: TKey): Option<TValue> {
        const it = this._lookupMap.get(key);
        return it === undefined ? NoneOption.get() : new SomeOption(it.value.value);
    }


    /**
     * Gets the value associated with the specified key and marks that item as
     * most recently used.
     *
     * @param key - The key to look up
     * @returns SomeOption containing the value if found; otherwise NoneOption
     */
    public get(key: TKey): Option<TValue> {
        const it = this._lookupMap.get(key);
        if (it === undefined) {
            return NoneOption.get();
        }

        // Move the accessed item to the head of the list to mark it as most recently used.
        const listItem = it.value;
        this._frequencyList.splice(it, 1);
        this._frequencyList.splice(this._frequencyList.begin(), 0, listItem);
        this._lookupMap.set(key, this._frequencyList.begin());
        return new SomeOption(listItem.value);
    }


    /**
     * Gets the value associated with the specified key. If the key is not
     * present, computes a value using the provided factory, stores it, and
     * returns it.
     *
     * When the key is already present, the item is marked as most recently
     * used (same recency semantics as get()).
     *
     * @param key - The key to look up or create
     * @param factory - Function used to compute the value when key is missing
     * @returns The extant or newly-computed value
     */
    public async getOrSet(key: TKey, factory: () => MaybePromise<TValue>): Promise<TValue> {
        const existing = this.get(key);
        if (existing.isSome) {
            return existing.value;
        }

        const value = await factory();
        this.set(key, value);
        return value;
    }


    /**
     * Adds or updates an item in this cache and marks it as most recently
     * used.
     *
     * @param key - The key to add or update
     * @param value - The value to store for the specified key
     */
    public set(key: TKey, value: TValue): void {

        const newItem = { key, value} satisfies ILruListItem<TKey, TValue>;
        const itOldItem = this._lookupMap.get(key);

        // If the key is not currently in this collection, it will be growing.
        const collectionWillGrow = itOldItem === undefined;

        // If this collection will be growing and the new size will exceed the
        // capacity, evict the least recently used item.
        if (collectionWillGrow && this._lookupMap.size + 1 > this._capacity) {
            // Get an iterator pointing at the last item in the list (the least recently used).
            const it = this._frequencyList.end();
            it.prev();

            // Evict it.
            this._lookupMap.delete(it.value.key);
            this._frequencyList.splice(it, 1);
        }

        if (itOldItem !== undefined) {
            // There is already an item in this collection with the same key.
            // Remove it from this frequency list.
            this._frequencyList.splice(itOldItem, 1);
        }

        // Insert the new item at the head of the list.
        this._frequencyList.splice(this._frequencyList.begin(), 0, newItem);

        // Update the map to point to the new item.
        this._lookupMap.set(key, this._frequencyList.begin());
    }

}
