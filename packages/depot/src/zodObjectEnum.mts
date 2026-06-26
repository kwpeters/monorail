import * as z from "zod";


/**
 * The shape of a const object that can back an enumeration:  a mapping of
 * string keys to string or number values.
 */
export type ObjectEnumSource = Record<string, string | number>;


/**
 * A bundle of derived types, schemas and helpers built from a single const
 * object by {@link defineObjectEnum}.  It exposes everything needed to use the
 * object as a full-featured enumeration:
 * - the original source object,
 * - the enumeration's keys and values (iterable),
 * - Zod schemas for both the values and the string keys (composable into
 *   larger schemas), and
 * - a reverse lookup from a value to its string key (useful for emitting
 *   human-readable JSON).
 */
export interface ObjectEnumDef<TObj extends ObjectEnumSource> {
    /**
     * The original source object mapping keys to values.
     */
    readonly obj: TObj;

    /**
     * All of the enumeration's string keys.
     */
    readonly keys: ReadonlyArray<keyof TObj & string>;

    /**
     * All of the enumeration's values.
     */
    readonly values: ReadonlyArray<TObj[keyof TObj]>;

    /**
     * A Zod schema that validates the enumeration's values.  Composable into
     * larger schemas.
     */
    readonly schemaValue: z.ZodType<TObj[keyof TObj]>;

    /**
     * A Zod schema that validates the enumeration's string keys.  Composable
     * into larger schemas.
     */
    readonly schemaKey: z.ZodType<keyof TObj & string>;

    /**
     * Tests whether the provided input is a valid enumeration value.
     *
     * @param other - The value to test
     * @returns True if the input is a value in this enumeration
     */
    isValue(other: unknown): other is TObj[keyof TObj];

    /**
     * Asserts that the provided input is a valid enumeration value.
     *
     * @param other - The value to assert
     * @throws Error if {@link other} is not a valid enumeration value
     */
    assertValue(other: unknown): asserts other is TObj[keyof TObj];

    /**
     * Tests whether the provided input is a valid enumeration key.
     *
     * @param other - The key to test
     * @returns True if the input is a key in this enumeration
     */
    isKey(other: unknown): other is keyof TObj & string;

    /**
     * Asserts that the provided input is a valid enumeration key.
     *
     * @param other - The key to assert
     * @throws Error if {@link other} is not a valid enumeration key
     */
    assertKey(other: unknown): asserts other is keyof TObj & string;

    /**
     * Gets the string key associated with the specified value.
     *
     * If multiple keys share the same value, the last key encountered in
     * object iteration order wins and is the key that will be returned.
     *
     * @param value - The enumeration value to look up
     * @returns The string key associated with the value
     */
    keyForValue<TValue extends TObj[keyof TObj]>(value: TValue): ObjectEnumKeyForValue<TObj, TValue>;
}


/**
 * The union of value types produced by an {@link ObjectEnumDef}.
 */
export type ObjectEnumValue<T> = T extends ObjectEnumDef<infer TObj> ? TObj[keyof TObj] : never;


/**
 * The union of string key types produced by an {@link ObjectEnumDef}.
 */
export type ObjectEnumKey<T> = T extends ObjectEnumDef<infer TObj> ? keyof TObj & string : never;

/**
 * Key union corresponding to a specific value in an enum source object.
 */
export type ObjectEnumKeyForValue<
    TObj extends ObjectEnumSource,
    TValue extends TObj[keyof TObj],
> = {
    [TKey in keyof TObj & string]: TObj[TKey] extends TValue ? TKey : never
}[keyof TObj & string];


/**
 * Builds a full-featured enumeration from a single const object.  This removes
 * the boilerplate of hand-writing value/key types, value/key schemas and a
 * reverse lookup for every enumeration.
 *
 * @param obj - A const object mapping string keys to string or number values.
 *     Pass an object literal (ideally declared `as const` or inline) so the
 *     literal key and value types are preserved.
 * @returns An {@link ObjectEnumDef} exposing the source object, its keys and
 *     values, Zod schemas for the values and keys, and a value-to-key reverse
 *     lookup.
 * @throws Error if {@link obj} is empty
 */
export function defineObjectEnum<const TObj extends ObjectEnumSource>(obj: TObj): ObjectEnumDef<TObj> {
    type Key = keyof TObj & string;
    type Value = TObj[keyof TObj];

    const keys = Object.keys(obj) as Key[];
    const values = keys.map((key) => obj[key]) as Value[];

    if (keys.length === 0) {
        throw new Error("defineObjectEnum() requires at least one key/value pair.");
    }

    const schemaValue = z.enum(obj) as unknown as z.ZodType<Value>;
    const schemaKey = z.enum(keys as [Key, ...Key[]]) as unknown as z.ZodType<Key>;

    const valueToKey = new Map<Value, Key>();
    const valueSet = new Set<Value>();
    const keySet = new Set<Key>(keys);
    for (const key of keys) {
        const value = obj[key];
        valueToKey.set(value, key);
        valueSet.add(value);
    }

    return {
        obj,
        keys,
        values,
        schemaValue,
        schemaKey,
        isValue(other: unknown): other is Value {
            return valueSet.has(other as Value);
        },
        assertValue(other: unknown): asserts other is Value {
            if (!valueSet.has(other as Value)) {
                throw new Error(`Failed assertion. "${String(other)}" is not a valid enum value.`);
            }
        },
        isKey(other: unknown): other is Key {
            return typeof other === "string" && keySet.has(other);
        },
        assertKey(other: unknown): asserts other is Key {
            if (!(typeof other === "string" && keySet.has(other))) {
                throw new Error(`Failed assertion. "${String(other)}" is not a valid enum key.`);
            }
        },
        keyForValue<TValue extends Value>(value: TValue): ObjectEnumKeyForValue<TObj, TValue> {
            return valueToKey.get(value)! as ObjectEnumKeyForValue<TObj, TValue>;
        }
    };
}
