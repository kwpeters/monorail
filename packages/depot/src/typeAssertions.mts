 /**
  * Conditional type that yields the type `true` when two types do not overlap
  * (i.e. there is no value that can satisfy both types).  Yields the type
  * `never` when there is one or more values that can satisfy both types.
  * Creating a variable of the returned type and assigning `true` to it will
  * cause a compiler error if the two types overlap.
  *
  * @example
  * const __assertNoOverlap: NoOverlapExists<CipDataTypeName, EdsDataTypeName> = true;
  */
export type NoOverlapExists<TA, TB> = TA & TB extends never ? true : never;
