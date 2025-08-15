import { insertIfWith } from "./arrayHelpers.mjs";
import { NoneOption, SomeOption, Option } from "./option.mjs";
import { FailedResult, SucceededResult, type Result } from "./result.mjs";


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


interface ILineAndCol {
    line:   Option<number>;
    column: Option<number>;
}


interface ICodeFrame {
    start: {line: number, column: number | undefined},
    end:   {line: number, column: number | undefined} | undefined
}


/**
 * Represents a source location with an optional file path, start location and
 * end location.
 */
export class SourceLocation {

    private readonly _filePath: Option<string>;
    private readonly _start:    ILineAndCol;
    private readonly _optEnd:   Option<ILineAndCol>;


    public constructor(
        optFilePath: Option<string>,
        start:       ILineAndCol,
        optEnd:      Option<ILineAndCol>
    ) {
        this._filePath = optFilePath;
        this._start    = start;
        this._optEnd   = optEnd;
    }


    /**
     * Returns a source location string for the starting location that includes
     * the file path, line number, and column number. The format is
     * "filePath:line:col", but parts are omitted if they are not specified.
     *
     * @return The starting location string
     */
    public startToString(): Result<string, string> {
        return this.toString(this._start);
    }


    /**
     * Attempts to build a string for the ending location that includes
     * the file path, line number, and column number. The format is
     * "filePath:line:col", but parts are omitted if they are not specified.
     *
     * @return The ending location string
     */
    public endToString(): Result<string, string> {
        if (this._optEnd.isNone) {
            return new FailedResult("SourceLocation end is not specified.");
        }

        const resStr = this.toString(this._optEnd.value);
        return resStr;
    }


    /**
     * Converts this object into the format expected by @babel/code-frame.
     *
     * @return The code frame representation
     */
    public get codeFrame(): ICodeFrame {
        return {
            start: {
                line:   this._start.line.defaultValue(1),
                column: this._start.column.defaultValue(undefined)
            },
            end: this._optEnd.isSome ?
                {
                    line:   this._optEnd.value.line.defaultValue(1),
                    column: this._optEnd.value.column.defaultValue(undefined)
                } :
                undefined
        };
    }


    ////////////////////////////////////////////////////////////////////////////
    // Helper Functions
    ////////////////////////////////////////////////////////////////////////////

    private toString(location: ILineAndCol): Result<string, string> {

        const lineNum = location.line
        .bind((num) => Number.isNaN(num) ? NoneOption.get() : new SomeOption(num));

        if (this._filePath.isNone && lineNum.isNone) {
            return new FailedResult(`Cannot form a SourceLocation string when there is no file path and the line number is NaN.`);
        }

        const colNum = location.column.bind((num) => Number.isNaN(num) ? NoneOption.get() : new SomeOption(num));

        const parts = [
            ...insertIfWith(this._filePath.isSome, () => [this._filePath.value]),
            ...insertIfWith(lineNum.isSome, () => [lineNum.value!.toString()]),
            // The column number is only included if the line number is also specified.
            ...insertIfWith(lineNum.isSome && colNum.isSome, () => [colNum.value!.toString()])
        ];

        const str = parts.join(":");
        if (!str) {
            throw new Error("Unexpected error createing source location string.");
        }
        else {
            return new SucceededResult(str);
        }
    }
}
