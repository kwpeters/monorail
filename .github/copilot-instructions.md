# Custom instructions for GitHub Copilot

## Coding Style

All TypeScript files within this project follow the following formatting rules.

- Indent with 4 spaces only
- The imports at the beginning of each TypeScript source file should be followed
  by two blank lines.
- Variable names will be camelCase.
- All types will be PascalCase.
- All code file names will be either camelCase or kebab-case
- Two blank lines will be inserted between methods and properties within a
  class.
- When an if statement has an else clause, the `else` keyword will appear at the
  beginning of a new line.  It should not appear on the same line as the `}` of
  the preceding `if` block.
- When formatting a try/catch block, the `catch` keyword will appear at the
  beginning of a new line.  It should not appear on the same line and as the `}`
  of the preceding `try` block.
- JSDoc style documentation comments should be created for all methods and
  functions.
  - An example JSDoc comment:

    ```typescript
    /**
     * Creates a string where each line of _src_ is indented.
     * @param src - The string to be indented
     * @param numSpacesOrPad - The number of spaces to indent each line
     * @param skipFirstLine - If truthy, the first line will not be indented
     * @return A new string where each line is indented
     */
    ```

  - Things to note about this style:

    - All parameters must be documented using `@param`.
    - Only include periods at the end if the text is a complete sentence.
      Usually parameter descriptions are not complete sentences and do not
      require a period at the end.
    - If the return type of the function is not `void` and the method is not a
      constructor, the return value must be documented using `@return`.
    - Parameter names and their descriptions are separated by ` - `.
    - Types are not included.  This is redundant with the TypeScript code, and
      causes unnecessary maintenance.

  - All classes should be described using a JSDoc comment.

### Unit Test Coding Style

The following rules apply to unit test files (which must include include the
substring `.test.` in their file name).

- Two blank lines should always separate two adjacent `describe()` calls.
- Two blank lines should always separate two adjacent `it()` calls.
- The first `it()` call within a `describe()` should be preceded by one blank
  line.
- The last `it()` call within a `describe()` should be followed by one blank
  line().
