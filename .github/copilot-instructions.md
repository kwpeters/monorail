# Custom instructions for GitHub Copilot

This project uses TypeScript with the following rules:

- Indent with 4 spaces only
- Variable names will be camelCase
- All types will be PascalCase
- All code files will be either camelCase or kebab-case
- Two blank lines will be inserted between methods within a class
- When an if statement has an else clause, the `else` keyword will appear at the
  beginning of a new line.  It should not appear on the same line and follow the
  `}` of the preceding `if` block.
- When formatting a try/catch block, the `catch` keyword will appear at the
  beginning of a new line.  It should not appear on the same line and follow the
  `}` of the preceding `try` block.
- JSDoc style documentation comments should be created for all methods and functions.
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
    - If the return type of the function is not `void`, the return value must
      be documented using `@return`.
    - Parameter names and descriptions are separated by ` - `.
    - Types are not included.  This is redundant with the TypeScript code, and
      causes unnecessary maintenance.
