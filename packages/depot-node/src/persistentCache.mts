import { hashStringFastSync, type HashFn } from "@repo/depot/hash";
import { LruCache } from "@repo/depot/lruCache";
import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import type { MaybePromise } from "@repo/depot/typeUtils";
import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";
import { getOs, OperatingSystem } from "./os.mjs";


export interface IPersistentCacheOptions {
    /**
     * The directory where the cache will be persisted.  Default is process.cwd().
     */
    dir: string;

    /**
     * Maximum number of entries in the in-memory cache.
     *
     * Leave undefined for an unbounded in-memory cache.
     *
     * Set this to a positive integer to bound memory usage, which is
     * recommended for long-running processes that could otherwise accumulate a
     * large number of cached entries.
     */
    memoryCapacity?: number;

    /**
     * Hash function used for in-memory keys when memoryCapacity is specified.
     *
     * If omitted, hashStringFastSync is used.
     */
    keyHashFn?: HashFn<string>;
}

const defaultCacheOptions = {
    dir: process.cwd()
} satisfies IPersistentCacheOptions;


interface IMemoryCache<T> {
    has(key: string): boolean;
    get(key: string): T | undefined;
    set(key: string, value: T): void;
    delete(key: string): boolean;
    clear(): void;
}


/**
 * @classdesc A key-value data structure that persists all data to the
 * filesystem. Inspired by:
 * https://github.com/LionC/persistent-cache/blob/master/index.js
 */
export class PersistentCache<T> {
    /**
     * Creates a new PersistentCache instance.
     * @param name - The name of the cache
     * @param options - configuration options.  See IPersistentCacheOptions.
     * @return A promise that resolves with the new cache instance or rejects
     * if there were any errors.
     */
    public static async create<T>(
        name: string,
        options?: Partial<IPersistentCacheOptions>
    ): Promise<PersistentCache<T>> {
        if (!isValidFilesystemName(name)) {
            throw new Error("Illegal cache name");
        }

        const resolvedOptions = {...defaultCacheOptions, ...options};

        const rootDir = new Directory(resolvedOptions.dir);

        if (!rootDir.existsSync()) {
            throw new Error(`Directory "${resolvedOptions.dir}" does not exist.`);
        }

        validateMemoryCapacityOption(resolvedOptions.memoryCapacity);

        // Create the directory for the cache being created.
        const cacheDir = new Directory(rootDir, name);
        await cacheDir.ensureExists();
        return new PersistentCache<T>(
            cacheDir,
            resolvedOptions.memoryCapacity,
            resolvedOptions.keyHashFn
        );
    }


    /**
     * Synchronously creates a new PersistentCache instance.
     * @param name - The name of the cache
     * @param options - Configuration options.  See IPersistentCacheOptions.
     * @return The new cache instance
     */
    public static createSync<T>(name: string, options?: Partial<IPersistentCacheOptions>): PersistentCache<T> {
        if (!isValidFilesystemName(name)) {
            throw new Error("Illegal cache name");
        }

        const resolvedOptions = {...defaultCacheOptions, ...options};

        const rootDir = new Directory(resolvedOptions.dir);

        if (!rootDir.existsSync()) {
            throw new Error(`Directory "${resolvedOptions.dir}" does not exist.`);
        }

        validateMemoryCapacityOption(resolvedOptions.memoryCapacity);

        // Create the directory for the cache being created.
        const cacheDir = new Directory(rootDir, name);
        cacheDir.ensureExistsSync();
        return new PersistentCache<T>(
            cacheDir,
            resolvedOptions.memoryCapacity,
            resolvedOptions.keyHashFn
        );
    }


    // region Instance Data Members
    private readonly _cacheDir: Directory;
    private readonly _memCache: IMemoryCache<CacheEntry<T>>;
    // endregion


    /**
     * Creates a new PersistentCache instance.  Private because instances should
     * be created with the static `create()` method.
     * @param cacheDir - The directory for this cache.  This directory is
     * created in create() because it is async.
     * @param memoryCapacity - In-memory cache capacity. If undefined, in-memory
     * cache is unbounded.
     * @param keyHashFn - Hash function used when memoryCapacity is specified.
     */
    private constructor(
        cacheDir: Directory,
        memoryCapacity?: number,
        keyHashFn?: HashFn<string>
    ) {
        this._cacheDir = cacheDir;
        this._memCache = createMemoryCache<CacheEntry<T>>(memoryCapacity, keyHashFn);
    }


    /**
     * Adds/overwrites a key in this cache.
     * @param key - The key
     * @param val - The value
     * @return A promise that resolves when the value has been stored.  Rejects
     * if the specified key name is invalid.
     */
    public async set(key: string, val: T): Promise<void> {
        if (!isValidFilesystemName(key)) {
            throw new Error(`Invalid character in key ${key}`);
        }

        // Add the entry to the memory cache.
        const entry = new CacheEntry(val);
        this._memCache.set(key, entry);

        // Add the entry to the persistent store.
        const keyFile = this.keyToKeyFile(key);
        await keyFile.writeJson(entry.serialize());
    }


    /**
     * Checks whether a key exists in this cache without fetching its value.
     * @param key - The key to check
     * @return A promise that resolves with true if the key exists, false
     * otherwise
     */
    public async has(key: string): Promise<boolean> {
        if (this._memCache.has(key)) {
            return true;
        }
        const keyFile = this.keyToKeyFile(key);
        const stat = await keyFile.exists();
        return stat !== undefined;
    }


    /**
     * Reads a value from this cache.
     * @param key - The key to read
     * @return A promise that resolves with a SomeOption containing the value
     * if the key exists, or a NoneOption if the key is not present.
     */
    public async get(key: string): Promise<Option<T>> {
        // If the requested key is in the memory cache, use it.
        const memEntry = this._memCache.get(key);
        if (memEntry !== undefined) {
            return new SomeOption(memEntry.payload);
        }

        // See if the requested key is persisted.
        const keyFile = this.keyToKeyFile(key);
        const exists = await keyFile.exists();

        // If the requested key is not persisted, we do not have it.
        if (!exists) {
            return NoneOption.get();
        }

        // The requested key was persisted.  Load it, put it in the memory
        // cache and return the value to the caller.
        try {
            const data = await keyFile.readJson<unknown>();
            if (!isSerializedCacheEntry(data)) {
                // Self-heal by removing corrupted entries.
                await keyFile.delete();
                return NoneOption.get();
            }

            const entry = CacheEntry.deserialize<T>({payload: data.payload as T});
            this._memCache.set(key, entry);
            return new SomeOption(entry.payload);
        }
        catch {
            // Self-heal by removing corrupted entries.
            await keyFile.delete();
            return NoneOption.get();
        }
    }


    /**
     * Reads a value from this cache or computes and stores it when missing.
     * @param key - The key to read or create
     * @param fallbackFactory - Factory used when key is missing
     * @return The extant or newly-computed value
     */
    public async getOrSet(key: string, fallbackFactory: () => MaybePromise<T>): Promise<T>;


    public async getOrSet(
        key: string,
        fallbackFactory: () => MaybePromise<T>
    ): Promise<T> {
        const optExisting = await this.get(key);
        if (optExisting.isSome) {
            return optExisting.value;
        }

        const value = await fallbackFactory();
        await this.set(key, value);
        return value;
    }


    /**
     * Deletes the specified key from this cache
     * @param key - The key to delete
     * @return A promise that resolves with true if the key existed
     */
    public async delete(key: string): Promise<boolean> {
        // Remove it from the memory cache.
        const removedFromMemory = this._memCache.delete(key);
        // Remove it from the persistent store.
        const keyFile = this.keyToKeyFile(key);
        const removedFromDisk = await keyFile.exists();
        await keyFile.delete();
        return removedFromMemory || (removedFromDisk !== undefined);
    }


    /**
     * Deletes all keys from this cache.
     * @return A promise that resolves when the cache has been cleared
     */
    public async clear(): Promise<void> {
        this._memCache.clear();
        await this._cacheDir.empty();
    }


    /**
     * Enumerates the keys in this cache
     * @return A promise that resolves with the keys present in this cache
     */
    public async keys(): Promise<Array<string>> {
        const directoryContents = await this._cacheDir.contents();
        return directoryContents.files.map((curFile) => this.keyFileToKey(curFile));
    }


    // region Private Helper Methods


    /**
     * Helper function that converts from a key name to its associated file in
     * the filesystem.
     * @param key - The key name to convert
     * @return The corresponding File
     */
    private keyToKeyFile(key: string): File {
        return new File(this._cacheDir, key + ".json");
    }


    /**
     * Helper function that converts from a File to the cache key it represents
     * @param keyFile - The file to convert
     * @return The corresponding key string
     */
    private keyFileToKey(keyFile: File): string {
        return keyFile.baseName;
    }


    // endregion


}


/**
 * Helper function that returns invalid filesystem characters that cannot appear
 * in cache or key names due to the fact they are persisted in filesystem
 * directory names and file names.
 * @return An array of illegal characters.
 */
export function getIllegalChars(): Array<string> {
    return [
        "<",     // illegal in: NTFS, FAT
        ">",     // illegal in: NTFS, FAT
        ":",     // illegal in: NTFS, FAT, OS X
        "\"",    // illegal in: NTFS, FAT
        "/",     // illegal in: NTFS, FAT
        "\\",    // illegal in: NTFS, FAT
        "|",     // illegal in: NTFS, FAT
        "?",     // illegal in: NTFS, FAT
        "*",     // illegal in: NTFS, FAT
        "^"      // illegal in: FAT
    ];
}



/**
 * Determines whether the specified name is allowed (according to underlying
 * filesystem)
 * @param name - The name to be validated
 * @return true if `name` is valid.  false otherwise.
 */
function isValidFilesystemName(name: string): boolean {
    if (name.length === 0 || /^\s+$/u.test(name)) {
        return false;
    }

    // Dot and dot-dot are special directory names.
    if (name === "." || name === "..") {
        return false;
    }

    // FUTURE: Could use the info in the following article to do a better job
    //         validating names.
    //         https://kb.acronis.com/content/39790
    const illegalChars = getIllegalChars();

    for (const curIllegalChar of illegalChars) {
        if (name.includes(curIllegalChar)) {
            return false;
        }
    }

    if (getOs() === OperatingSystem.Windows) {
        // Windows does not allow trailing spaces or periods in names.
        if (name.endsWith(" ") || name.endsWith(".")) {
            return false;
        }

        const nameStem = name.split(".")[0]!.toUpperCase();
        if (windowsReservedDeviceNames.has(nameStem)) {
            return false;
        }
    }

    return true;
}


function isSerializedCacheEntry(data: unknown): data is {payload: unknown} {
    return typeof data === "object" &&
        data !== null &&
        Object.prototype.hasOwnProperty.call(data, "payload");
}


const windowsReservedDeviceNames = new Set([
    "CON",
    "PRN",
    "AUX",
    "NUL",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9"
]);


class CacheEntry<T> {
    /**
     * Creates a CacheEntry instance from its serialized form.  Templated on
     * type "U", which represents the type of user data stored in the payload.
     * Note, static methods cannot use the class template type "T".
     * @param serialized - The serialized CacheEntry
     * @return A CacheEntry instance
     */
    public static deserialize<TPayload>(serialized: {payload: TPayload}): CacheEntry<TPayload> {
        return new CacheEntry<TPayload>(serialized.payload);
    }


    // region Instance Members
    private readonly _payload: T;
    // endregion


    /**
     * Creates a new CacheEntry instance
     * @param payload - The user's data to be stored in this entry
     */
    public constructor(payload: T) {
        this._payload = payload;
    }


    /**
     * Serializes this entry to an object that can be persisted.
     * @return A version of this object that can be persisted and later
     * deserialized
     */
    public serialize(): {payload: T} {
        return {
            payload: this._payload
        };
    }


    /**
     * Retrieves the user data stored in this entry.
     * @return The user data
     */
    public get payload(): T {
        return this._payload;
    }
}


function validateMemoryCapacityOption(memoryCapacity: number | undefined): void {
    if (memoryCapacity === undefined) {
        return;
    }

    if (!Number.isInteger(memoryCapacity) || memoryCapacity <= 0) {
        throw new Error("memoryCapacity must be a positive integer when specified");
    }
}


function createMemoryCache<T>(
    memoryCapacity: number | undefined,
    keyHashFn: HashFn<string> | undefined
): IMemoryCache<T> {
    if (memoryCapacity === undefined) {
        return new Map<string, T>();
    }

    const resolvedHashFn = keyHashFn ?? hashStringFastSync;
    const lru = new LruCache<string, T>(memoryCapacity, resolvedHashFn);
    return {
        has(key: string): boolean {
            return lru.has(key);
        },

        get(key: string): T | undefined {
            const opt = lru.get(key);
            return opt.isSome ? opt.value : undefined;
        },

        set(key: string, value: T): void {
            lru.set(key, value);
        },

        delete(key: string): boolean {
            return lru.delete(key);
        },

        clear(): void {
            lru.clear();
        }
    };
}
