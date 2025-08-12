import { insertIfWith } from "./arrayHelpers.mjs";
import { NoneOption, SomeOption, Option } from "./option.mjs";


/**
 * Returns a source location string based on the provided file path, line
 * number, and column number. The format is "filePath:line:col", but parts are
 * omitted if they are not specified.
 *
 * @param filePath - An Option containing the file path.
 * @param lineNum - An Option containing the line number.
 * @param colNum - An Option containing the column number.
 * @returns An Option containing the formatted source location string or
 * NoneOption if no parts are specified.
 */
export function sourceLocation(
    filePath: Option<string>,
    lineNum: Option<number>,
    colNum: Option<number>
): Option<string> {

    lineNum = lineNum.bind((num) => Number.isNaN(num) ? NoneOption.get() : new SomeOption(num));
    colNum = colNum.bind((num) => Number.isNaN(num) ? NoneOption.get() : new SomeOption(num));

    const parts = [
        ...insertIfWith(filePath.isSome, () => [filePath.value!.toString()]),
        ...insertIfWith(lineNum.isSome, () => [lineNum.value!.toString()]),
        // The column number is only included if the line number is also specified.
        ...insertIfWith(lineNum.isSome && colNum.isSome, () => [colNum.value!.toString()])
    ];
    const str = parts.join(":");
    return str ? new SomeOption(str) : NoneOption.get();
}


/**
 * Converts a character offset to line and column numbers (1-based).
 *
 * @param text - The text content
 * @param offset - The character offset (0-based).
 * @return An object containing the line and column numbers.
 */
export function offsetToLineColumn(text: string, offset: number): { line: number, column: number} {
    let line = 1;
    let column = 1;

    for (let i = 0; i < offset && i < text.length; i++) {
        if (text[i] === "\n") {
            line++;
            column = 1;
        }
        else {
            column++;
        }

    }
    return { line, column };
}
