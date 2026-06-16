import * as z from "zod";


/**
 * A readonly list of string literals that can back an enumeration.
 */
export type StringEnumSource = readonly string[];


/**
 * A bundle of derived values and helpers built from a list of string literals
 * by {@link defineStringEnum}.
 */
export interface StringEnumDef<TValues extends StringEnumSource> {
    /**
     * Object whose property names and values are the provided string literals.
     */
    readonly obj: { readonly [TValue in TValues[number]]: TValue };

    /**
     * All values in the enumeration.
     */
    readonly values: ReadonlyArray<TValues[number]>;

    /**
     * A Zod schema that validates the enumeration's values.
     */
    readonly schema: z.ZodType<TValues[number]>;

    /**
     * Tests whether the provided input is a valid enumeration value.
     *
     * @param other - The value to test
     * @return True if the input is a value in this enumeration
     */
    isValue(other: unknown): other is TValues[number];

    /**
     * Asserts that the provided input is a valid enumeration value.
     *
     * @param other - The value to assert
     * @throws Error if {@link other} is not a valid enumeration value
     */
    assertValue(other: unknown): asserts other is TValues[number];
}


/**
 * The union of value types produced by a {@link StringEnumDef}.
 */
export type StringEnumValue<T> = T extends StringEnumDef<infer TValues> ? TValues[number] : never;


/**
 * Builds a string-literal enumeration definition from a list of values.
 *
 * @param values - The string literals that define the enumeration.
 * @return A {@link StringEnumDef} exposing object, values, schema, and value
 *     guards/assertions.
 * @throws Error if {@link values} is empty
 */
export function defineStringEnum<const TValues extends StringEnumSource>(values: TValues): StringEnumDef<TValues> {
    type Value = TValues[number];

    if (values.length === 0) {
        throw new Error("defineStringEnum() requires at least one value.");
    }

    const enumValues = [...values] as Value[];
    const obj = Object.fromEntries(
        enumValues.map((value) => [value, value]),
    ) as { readonly [TValue in Value]: TValue };

    const valueSet = new Set<Value>(enumValues);
    const schema = z.enum(enumValues as [Value, ...Value[]]) as unknown as z.ZodType<Value>;

    return {
        obj,
        values: enumValues,
        schema,
        isValue(other: unknown): other is Value {
            return valueSet.has(other as Value);
        },
        assertValue(other: unknown): asserts other is Value {
            if (!valueSet.has(other as Value)) {
                throw new Error(`Failed assertion. "${String(other)}" is not a valid enum value.`);
            }
        }
    };
}
