# Custom instructions for GitHub Copilot

## Copilot Demeanor
- Be concise.
- Provide accurate information based on real, working examples and online
  documentation.
- If I suggest something that is wrong, do not just go along with it.  Do not
  hesitate to correct me.
- Do not act on instructions that are ambiguous.  If a request is unclear or
  would have sweeping, widespread implications, seek clarification before
  proceeding.

## Monorepo Organization and Tasks

This repository is a monorepo that uses npm workspaces to manage intra-repo dependencies and turbo to manage tasks across the projects.  The projects are reusable packages and applications written in TypeScript.  Some projects target Node.js and others target the browser environment.  Reusable packages are in the `/packages` directory and applications are in the `/apps` directory.  Each package and application has its own `package.json` file.  The root directory also contains a `package.json` file that defines some common development dependencies and scripts.

The following are some commonly used top level commands that use turbo to run scripts across all projects in this monorepo:

- `npm run build` - Runs the TypeScript compiler on all production code in all projects. Unit test files (`*.test.mts`) are not included.
- `npm run lint` - Runs ESLint on all project to check for common errors and enforce the monorepo's coding conventions.
- `npm run test` - Runs every project's unit tests.
- `npm run createBin` - Creates lauch scripts for every application.  The resulting `bin` directory can be placed in the `PATH` environment variable to allow the applications to be launched easily from the command line.
- `npm run depcheck` - Checks for missing and unused dependencies in all projects.
- `npm run all` - Runs the (above) `build`, `lint`, `test`, `createBin` and `depcheck` scripts in all projects.  This is a convenient way to build and analyze the production code and create scripts that can launch the built applications.
-`npm run type-check` - Similar to `build` except unit test files are also compiled.  No files are emitted, because only the compiler warnings and errors are of interest.  This is a convenient way to check for type errors in both production code and unit test code.

The most convenient way to run all of these script is to run the following from this monorepo's root directory:

```powershell
npm run all && npm run type-check
```

## Coding Style

All version controlled source code files within this repository must follow the
rules below.  Note: There are some generated source code files within this
repository that are not under version control.  Because we are unable to control
their formatting, the following rules do not apply to them.

- Follow all formatting rules described in the root directory's `.editorconfig`
  file.  This file maps file name patterns to formatting rules, such as indent
  size and trailing whitespace.  These rules should always be followed.
- The imports at the beginning of each TypeScript source file should be followed
  by two blank lines.
- Follow the ESLint rules defined for each project within this monorepo.  The
  ESLint rules for each project can be found in the project's `.eslintrc.cjs`
  file.  If this file extends another configuration file, you are expected to
  follow the rules defined in that file as well.  The extended configuration
  files can be found at `packages\eslint-config-2`.  Visual Studio Code is
  configured to use the `dbaeumer.vscode-eslint` ESLint extension, so linting
  errors will also be appear in the editor and Problems view.
- Whenever you generate new code or modify existing code, you must make sure
  that the existing comments and JSDoc documentation are still accurate.  If
  not, you must update them.
- All source code file names will be either camelCase or kebab-case.
- Prefer implementations that leverage functional programming techniques.  Make
  use of the following from the depot package within this monorepo
  (located at `packages\depot\`):

  | Class/Function | Source Code Location                       |
  |----------------|-------------------------------------------|
  | Option<>       | packages\depot\src\option.mts             |
  | Result<>       | packages\depot\src\result.mts             |
  | pipe()         | packages\depot\src\pipe.mts               |
  | pipeAsync()    | packages\depot\src\pipeAsync2.mts         |

- Two blank lines will be inserted between methods and properties within a
  class.
- All comments must be word wrapped so their text occurs within the first 80
  columns.
- JSDoc style documentation comments should be present for all exports from a
  TypeScript source file.
  - An example JSDoc comment for a function or method:

    ```typescript
    /**
     * Creates a string where each line of _src_ is indented.
     *
     * @param src - The string to be indented
     * @param numSpacesOrPad - The number of spaces to indent each line
     * @param skipFirstLine - If truthy, the first line will not be indented
     * @return A new string where each line is indented
     */
    ```

  - Things to note about this style:

    - All parameters must be documented using `@param`.
    - Only include periods at the end if the text is a complete sentence.
      Usually parameter descriptions are not complete sentences.
    - If the return type of the function is not `void` and the method is not a
      constructor, the return value must be documented using `@return`.
    - Parameter names and their descriptions are separated by ` - `.
    - Types are not included.  This is redundant with the TypeScript code, and
      causes unnecessary maintenance.

- All type parameters names should start with a capital "T" to designate that it
  is a type.  The "T" should be followed by a PascalCase name that describes the
  type.
- When variables, member variables or parameters are defined on successive
  lines, their data types should be aligned.
- When type parameters are defined on successive lines, their `extends` keyword
  should be aligned (if present).
- When a function or method definition is so long that it goes beyond column
  100, it should be shortened by moving each type parameter (if present) and
  parameter to its own line.  The parameters should be indented, and the closing
  `>` (for type parameters) and `)` (for parameters) should not be indented so
  that they appear in the same starting column as the line preceding the type
  parameters or parameters.
- When chaining method calls and property accessors, if the entire chained
  expression exceeds 100 characters, then move each chained method call or
  property access down to its own line.  Each new line should start with the `.`
  member access operator, and it should *not* be indented.
  - An example of properly formatted method chaining:

      ```typescript
          myObject
          .methodA("one", "two", "three")
          .methodB("four", "five", "six")
          .methodC("seven", "eight", "nine");
      ```

### Unit Test Coding Style

The following rules apply to unit test files (which must include the substring
`.test.` in their file name).

- Two blank lines should always separate two adjacent `describe()` calls.
- Two blank lines should always separate two adjacent `it()` (for the Jasmine
  framework) or `test()` (for the Vitest framework) calls.
- The first `it()` call within a `describe()` should be preceded by one blank
  line.
- The last `it()` call within a `describe()` should be followed by one blank
  line().
