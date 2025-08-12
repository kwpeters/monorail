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
