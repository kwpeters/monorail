# Custom instructions for GitHub Copilot

## Copilot Demeanor

- Be concise and accurate.
- Use real, working examples and online documentation.
- Correct incorrect assumptions instead of agreeing with them.
- Ask for clarification when a request is ambiguous or has broad impact.
- When creating plans, always provide a way to track implementation progress.  This is most often done using an unchecked checkbox for an incomplete task and a checked checkbox for a completed task:

  - [x] Step 1 (completed)
  - [ ] Step 2 (not completed)

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
  - Wrap comments to 80 columns.
  - Align successive type annotations and `extends` clauses when practical.
  - Break long signatures and chained expressions over 100 columns onto multiple lines.
  - Start wrapped chains with `.` and do not indent that operator.
- Prefer Zod-based enums, for example `HttpSuccess` in `packages\depot\src\httpStatusCodes.mts`.  Zod enums provide validation, enumeration and convenient type mapping.
- Prefer functional patterns and the `depot` helpers `Result`, `Option`, `pipe`, `pipeAsync`, and `resolutionPipeline`.
- Naming:
  - Use camelCase or kebab-case for source file names.
  - Use PascalCase for type names.
  - Start type parameter names with `T`.
- Add JSDoc to externally accessible types and functions. Document every parameter with `@param` and non-`void` returns with `@return`.

### Preferred Libraries and Frameworks

Some npm packages are used widely throughout this monorepo.
For consistency, when multiple projects use an npm package, they should use the same version.

- Zod - schema validation and parsing
- yargs - command line parsing
- Ink - terminal user interfaces (TUIs)
- lodash-es - utility functions, although use of native JavaScript/TypeScript constructs is preferred.

## Unit Tests

- Name test files `baseName.test.mts`.
- Leave two blank lines between adjacent `describe()` blocks.
- Leave two blank lines between adjacent `it()` or `test()` blocks.
- Leave one blank line before the first `it()` or `test()` in a `describe()` block.
- Leave one blank line after the last `it()` or `test()` in a `describe()` block.
