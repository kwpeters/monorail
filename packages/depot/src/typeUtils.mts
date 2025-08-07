/**
 * A type describing an empty object.
 */
export type EmptyObject = Record<string, never>;


/**
 * For a type T, adds null and undefined to the type of each property.
 */
export type MakePropsNullable<T> = {
    [P in keyof T]: T[P] | null | undefined
};


/**
 * For a type T adds optionality for each property name in TRequiredKeys.
 * TRequiredKeys can be a single property name or a union of property names.
 */
export type MakePropsOptional<T, TOptionalKeys extends keyof T> =
    // Pick all keys not in TOptionalKeys so they are left as-is.
    Pick<T, Exclude<keyof T, TOptionalKeys>> &
    {
        // All keys in TOptionalKeys, will become optional.
        [P in TOptionalKeys]?: T[P]
    };


/**
 * For a type T removes the optionality for each property name in TRequiredKeys.
 * TRequiredKeys can be a single property name or a union of property names.
 */
export type MakePropsRequired<T, TRequiredKeys extends keyof T> =
    // Pick all keys not in TRequiredKeys so they are left as-is.
    Pick<T, Exclude<keyof T, TRequiredKeys>> &
    {
        // All keys in TRequiredKeys, will become required (i.e. lose their optionality).
        [P in TRequiredKeys]-?: T[P]
    };


/**
 * For a type T removes null and undefined from the type for each property name
 * in TNonNullableKeys. TNonNullableKeys can be a single property name or a
 * union of property names.
 */
export type MakePropsNonNullable<T, TNonNullableKeys extends keyof T> =
    // Pick all keys not in TNonNullableKeys so they are left as-is.
    Pick<T, Exclude<keyof T, TNonNullableKeys>> &
    {
        // All keys in TNonNullableKeys, will become non-nullable.
        [P in TNonNullableKeys]: NonNullable<T[P]>
    };


/**
 * For a type T, makes each of the specified properties required and
 * non-nullable. TNonNullableRequiredKeys can be a single property name or a
 * union of property names.
 */
export type MakePropsNonNullableAndRequired<T, TNonNullableRequiredKeys extends keyof T> =
    MakePropsNonNullable<
        MakePropsRequired<T, TNonNullableRequiredKeys>,
        TNonNullableRequiredKeys
    >;


/**
 * For a type T, makes all properties optional (recursively).  This includes all
 * fields, properties and methods.
 */
export type RecursivePartial<T> = {
    [P in keyof T]?: RecursivePartial<T[P]>
};


/**
 * Convenience function that casts a partial object to the full type.  This
 * function should not be used in production code, because use of the returned
 * value as a T is unsafe.  It may, however, be useful when creating stubs
 * within unit tests.
 *
 * @param partial - The partial object containing some properties of T.
 * @returns The partial object casted as T
 */
export function createStub<T>(partial: RecursivePartial<T>): T {
    return partial as T;
}


/**
 * Declares that the type being passed is a class.  Useful in the mixin pattern.
 * See:  https://www.typescriptlang.org/docs/handbook/mixins.html
 */
export type Constructor = new (...args: unknown[]) => object;


////////////////////////////////////////////////////////////////////////////////
// Immutable
// https://stackoverflow.com/questions/41879327/deepreadonly-object-typescript

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type ImmutablePrimitive = undefined | null | boolean | string | number | Function;

export type ImmutableArray<T> = ReadonlyArray<Immutable<T>>;
export type ImmutableMap<TKey, TValue> = ReadonlyMap<Immutable<TKey>, Immutable<TValue>>;
export type ImmutableSet<T> = ReadonlySet<Immutable<T>>;
export type ImmutableObject<T> = { readonly [K in keyof T]: Immutable<T[K]> };

export type Immutable<T> =
    T extends ImmutablePrimitive ? T :
    T extends Array<infer U> ? ImmutableArray<U> :
    T extends Map<infer K, infer V> ? ImmutableMap<K, V> :
    T extends Set<infer M> ? ImmutableSet<M> :
    ImmutableObject<T>;


/**
 * Represents the type of elements in an array T.
 */
export type ElementType<T> = T extends unknown[] ? T[number] : never;


/**
 * Ensures that all properties in the template object are present in the target object,
 * filling in any missing properties with the provided default value.
 *
 * @param targetObj - The target object to ensure properties on.
 * @param templateObj - The template object to use as a reference.
 * @param defaultValue - The default value to use for missing properties.
 * @return The updated target object with all properties from the template.
 */
export function ensureAllProperties<TTemplate extends Record<PropertyKey, unknown>, TValue>(
    targetObj: Partial<Record<keyof TTemplate, TValue>>,
    templateObj: TTemplate,
    defaultValue: TValue
): Record<keyof TTemplate, TValue> {
    return Object.keys(templateObj).reduce(
        (acc, key) => {
            const typedKey = key as keyof TTemplate;
            acc[typedKey] = targetObj[typedKey] ?? defaultValue;
            return acc;
        },
        { ...targetObj } as Record<keyof TTemplate, TValue>
    );
}


/**
 * Forces TypeScript to expand and display the full structure of a type in
 * tooltips and error messages, making complex or composed types more readable.
 * This is especially useful when working with mapped types, intersections, or
 * utility types that would otherwise be shown as aliases or references.
 *
 * @template T - The type to be expanded and prettified for improved
 * readability.
 *
 * @remarks
 * The mapped type creates a new type by iterating over all keys in T and
 * copying their types. This "unwraps" complex type aliases, intersections, or
 * mapped types, forcing TypeScript to display the full expanded structure
 * rather than just the alias name. The intersection with {} is a trick that
 * prompts TypeScript to treat the mapped type as a fresh object type, not just
 * a reference to the original type. This further encourages TypeScript to show
 * the expanded, readable form in tooltips and error messages.
 */
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};
