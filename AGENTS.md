# Custom instructions for Agents

## Agent Demeanor

- Be concise and accurate.
- Use real, working examples and online documentation.
- Correct incorrect assumptions instead of agreeing with them.
- Ask for clarification when a request is ambiguous or has broad impact.

## Monorepo Organization and Tasks

- This repository uses npm workspaces and Turborepo.
- Reusable packages are in `/packages`; applications are in `/apps`.
- Each project has its own `package.json` file that enumerates the project's dependencies.
- The root directory contains a `package.json` file that defines shared dev dependencies and workspace-level scripts.
- Use these root commands:
  - `npm run build`: Compile production TypeScript only (no unit tests).
  - `npm run lint`: Run ESLint.
  - `npm run test`: Run unit tests.
  - `npm run createBin`: Create launch scripts in `bin`.  The resulting directory can be placed in a user's PATH environment variable to allow easy running of all applications.
  - `npm run depcheck`: Check for missing and unused dependencies.
  - `npm run all`: Run `build`, `lint`, `test`, `createBin`, and `depcheck`.
  - `npm run type-check`: Compile production and test code without emitting files.  Provides a quick litmus test to ensure all production and test code can be compiled.
- Preferred full verification command:

```powershell
npm run all && npm run type-check
```

## Coding Style

- Follow `.editorconfig` and `packages\eslint-config\src\eslintHelpers.mts`.
- For TypeScript:
  - Leave two blank lines after imports.
  - Leave two blank lines between class members.
  - For overloaded functions, leave one blank line between each overload signature and between the last overload and the implementation signature (do not bunch them together).
  - Wrap comments to 80 columns.
  - Align successive type annotations and `extends` clauses when practical.
  - Break long signatures and chained expressions over 100 columns onto multiple lines.
  - When method calls are chained, Start new lines with `.` and do not indent that operator.
  - Ternary formatting: For non-nested multi-line ternaries, place `?` and `:` at the end of the line; for nested ternaries, keep the condition, `?` and true expression on a single line.
- Prefer Zod-based enums, for example `HttpSuccess` in `packages\depot\src\httpStatusCodes.mts`.  Zod enums provide validation, enumeration and convenient type mapping.
- Prefer functional patterns and the `depot` helpers `Result`, `Option`, `pipe`, `pipeAsync`, and `resolutionPipeline`.
- Naming:
  - Use camelCase or kebab-case for source file names.
  - Use PascalCase for type names.
  - Start type parameter names with `T`.
- Add JSDoc to externally accessible types and functions. Document every parameter with `@param` and non-`void` returns with `@returns`.

### Preferred Libraries and Frameworks

Some npm packages are used widely throughout this monorepo.
For consistency, when multiple projects use an npm package, they should use the same version.

- Zod - schema validation and parsing
- yargs - command line parsing
- Ink - terminal user interfaces (TUIs)
- lodash-es - utility functions, although use of native JavaScript/TypeScript constructs is preferred.

## Unit Tests

- Name test files `baseName.test.mts`.
- Leave two blank lines between any two adjacent lifecycle blocks within a `describe()`.  This rule applies uniformly to `describe`, `beforeAll`, `afterAll`, `beforeEach`, `afterEach`, `it`, and `test` blocks.
- Leave one blank line immediately after the opening of a `describe()` callback, and one blank line immediately before its closing brace.
- Unit test organization:
  - Name test files `<base_name>.test.mts`.
  - All unit tests for a class should be in a single `describe()` block named for the class.
  - Within the class's `describe()` there should be a `describe("static")` block for static members and a `describe("instance")` block for instance members.
  - Each property and method should have its own `describe()` block nested within the appropriate static or instance `describe()`. Within that `describe()` should be the individual unit test cases with clear names describing the expected behavior.

## Markdown Guidelines

### Markdown: semantic line breaks

Write Markdown prose with [semantic line breaks](https://sembr.org).
Line breaks follow the structure of the sentence,
not a column width.

- Start every sentence on a new line.
- Break a long sentence at its clause boundaries:
  after a comma, semicolon, colon, or dash that ends a clause,
  and before a conjunction or relative clause that starts a new idea.
- Keep each line a complete unit of thought;
  short clauses can share a line with the clause they belong to.
- Keep inline code spans, links, and emphasized phrases whole on one line.
- In list items, indent continuation lines to align with the item's text.
- When you edit a paragraph, reflow the whole paragraph to semantic line breaks.

These breaks leave the rendered output unchanged,
because Markdown renders a single newline inside a paragraph as a space.
They keep diffs small, since changing one clause changes one line.

Example:

```markdown
The cache is shared by every worker process,
so a stale entry written by one worker is visible to all of them.
If the entry has expired,
the next read misses the cache
and the value is loaded from the database.
```

### Markdown: aligned tables

Use a table only for short, enumerable data such as names, types, and flags.
If any row would exceed about 120 characters
(prose sentences, long URLs),
use a list or one heading per row instead.

Pad table cells with spaces so the columns line up when the file is viewed as plain text.
Every `|` in a column sits at the same character position on every row,
including the header and the delimiter row.

- When you add, remove, or edit a cell, re-pad the whole table to the new widest cell in each column.
- A table row stays on one line.
  Semantic line breaks apply to prose, not to table rows.

Example:

```markdown
| Name   | Role                  |
| ------ | --------------------- |
| Parser | Reads the input file  |
| Cache  | Stores recent results |
```
