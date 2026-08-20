---
name: domain-modeling
description: How this monorepo models domain objects using the depot Result/Option/pipe helpers and domain classes with private constructors and static create/decode factory methods. Use when creating or modifying domain models, value objects, aggregates, factory methods, validation logic, or enums. For components that serialize to/from bytes, ALSO use the binary-codec skill.
---

# Domain Modeling - Key points

- Functional helpers
  - Fallible operations should return a `Result<>` (`packages\depot\src\result.mts`) or `PromiseResult<>` (`packages\depot\src\promiseResult.mts`).
  - Things that are optional are modeled using `Option<>` (`packages\depot\src\option.mts`).
  - Sequences of operations are composed using `pipe()` (`packages\depot\src\pipe2.mts`) and `pipeAsync()` (`packages\depot\src\pipeAsync2.mts`).
  - There are many useful `Result` and `Option` functions available to facilitate pipelining operations. Some of the most commonly used are:
    - `augment()` to accumulate fields
    - `gate()` for validation-only steps
    - mapping functions for mapping success, failure and some values.

- Domain classes
  - Domain object instances should always be immutable.  Once created, an instance's observable state must never change.
    - Declare all fields `private readonly` and expose state only through getters (or reader methods); never provide setters.
    - When a field holds a mutable value (for example an array or a buffer), make a defensive copy on the way in (in the factory method/constructor).  On the way out, either expose it as an immutable type (e.g. `ReadonlyArray<>`) or return a defensive copy, so callers cannot mutate the instance's internal state.
  - When validation of input parameters is needed (for example, range validation for a single value or constraint enforcement across multiple properties), make the constructor private and force construction to go through static factory methods.  These factory methods will return either a new instance when successful or a descriptive error message on failure.
  - Validation logic should never be duplicated in multiple factory methods.  When possible, a single factory method should be invoked by the other factory methods, or a shared private method should be used to encapsulate all validation.
  - When Zod validation is used, convert the Zod result into a `Result` by calling `safeParse()` from `@repo/depot/zodHelpers`.
  - There are several common static methods that create instances of a class:
    - `create()` is used to create an instance from the constituent domain objects that it aggregates.  Since the aggregated domain objects have already been successfully created, they do not need to be validated.  Only inter-component constraints need to be validated.
    - `decode()` is used to create an instance from a byte stream.  This factory method typically accepts a `BufReader` as input.

Enums
  - Prefer the depot enum helpers over TS `enum`. Use `defineStringEnum` (`@repo/depot/zodStringEnum`) for string-literal enumerations and `defineObjectEnum` (`@repo/depot/zodObjectEnum`) when keys map to non-string values (e.g. numbers).
