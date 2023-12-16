/**
 * Interface to be implemented by a type that is equatable with the type T.
 * Multiple specializations can be implemented if the type is equatable with
 * multiple other types.  Suitable for value objects to implement.
 */
export interface IEquatable<T> {
    equals(other: T): boolean;
}

/**
 * The same as IEquatable, but named in a way to communicate that the type
 * implements structural equality.
 */
export type IValueObject<T> = IEquatable<T>;

/**
 * The same as IEquatable, but named in a way to communicate that the type
 * implements equality based on an identifier.
 */
export type IEntity<T> = IEquatable<T>;
