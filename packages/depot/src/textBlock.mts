import { lastIndex } from "./arrayHelpers.mjs";
import type { IHasToString } from "./primitives.mjs";
import { splitIntoLines } from "./stringHelpers.mjs";


export interface ITextBlockPrefix {
    first:  string;
    middle: string;
    last:   string;
}


export class TextBlock implements IHasToString {

    /**
     * Creates a new TextBlock from an array of lines. Each line in the array
     * is split into individual lines if it contains newline characters.
     *
     * @param lines - An array of strings representing the lines of the TextBlock.
     * @return A new instance of TextBlock containing the processed lines.
     */
    public static fromLines(lines: Array<string>): TextBlock {
        const updatedLines = [] as Array<string>;
        for (const curLine of lines) {
            updatedLines.push(...splitIntoLines(curLine));
        }
        return new TextBlock(updatedLines);
    }


    /**
     * Creates a new TextBlock from a string. The string is split into lines
     * using newline characters.
     *
     * @param text - A string representing the text to be converted into a TextBlock.
     * @return A new instance of TextBlock containing the processed lines.
     */
    public static fromString(text: string): TextBlock {
        const lines = splitIntoLines(text);
        return TextBlock.fromLines(lines);
    }


    private readonly _lines: Array<string>;


    private constructor(lines: Array<string>) {
        this._lines = lines;
    }


    /**
     * Returns the number of columns in this TextBlock, which is the length of the
     * longest line.
     */
    public get numColumns(): number {
        return this._lines.reduce((max, line) => Math.max(max, line.length), 0);
    }


    /**
     * Returns the number of lines in this TextBlock.
     */
    public get numLines(): number {
        return this._lines.length;
    }


    /**
     * Returns a copy of the lines in this TextBlock.
     */
    public get lines(): Array<string> {
        return this._lines.slice(0);
    }


    /**
     * Returns a string representation of this TextBlock. Each line is joined
     * by newline characters.
     *
     * @return A string representation of this TextBlock.
     */
    public toString(): string {
        return this._lines.join("\n");
    }


    /**
     * Returns a new TextBlock with the specified number of lines. Additional
     * blank lines are added at the top.
     *
     * @param numLines - The total number of lines the new TextBlock should have.
     *     If this number is less than or equal to the current number of lines,
     *     the current TextBlock is returned unchanged.
     * @return A new TextBlock instance with the updated lines of text
     */
    public bottomJustify(numLines: number, padLine = ""): TextBlock {
        let linesToAdd = numLines - this.numLines;
        const newLines = [...this._lines];
        while (linesToAdd > 0) {
            newLines.unshift(padLine)
            linesToAdd--;
        }

        return new TextBlock(newLines);
    }


    /**
     * Returns a new TextBlock with the specified number of lines. Additional
     * blank lines are added at the bottom.
     *
     * @param numLines - The total number of lines the new TextBlock should have.
     *     If this number is less than or equal to the current number of lines,
     *     the current TextBlock is returned unchanged.
     * @return A new TextBlock instance with the updated lines of text
     */
    public topJustify(numLines: number, padLine = ""): TextBlock {
        let linesToAdd = numLines - this.numLines;
        const newLines = [...this._lines];
        while (linesToAdd > 0) {
            newLines.push(padLine)
            linesToAdd--;
        }

        return new TextBlock(newLines);
    }


    public prefixLines(prefix: ITextBlockPrefix): TextBlock {
        const newLines = [] as Array<string>;
        const lastIdx = lastIndex(this._lines);
        if (lastIdx === undefined) {
            return this;
        }

        for (let lineIdx = 0; lineIdx < this._lines.length; lineIdx++) {
            if (lineIdx === 0) {
                newLines.push(prefix.first + this._lines[0]);
            }
            else if (lineIdx === lastIdx) {
                newLines.push(prefix.last + this._lines[lineIdx]);
            }
            else {
                newLines.push(prefix.middle + this._lines[lineIdx]);
            }
        }

        return TextBlock.fromLines(newLines);
    }


    /**
     * Returns a new TextBlock with the specified number of columns. Additional
     * spaces are added to the right of each line.
     *
     * @param numColumns - The total number of columns the new TextBlock should have.
     *     If this number is less than or equal to the current number of columns,
     *     the current TextBlock is returned unchanged.
     * @return A new TextBlock instance with the updated lines of text
     */
    public padLines(numColumns: number): TextBlock {
        const newLines = this._lines.map((line) => line.padEnd(numColumns, " "));
        return TextBlock.fromLines(newLines);
    }

}


/**
 * Calculates the maximum number of lines present in _textBlocks_.
 *
 * @param textBlocks - The text blocks to consider
 * @return The maximum number of lines found
 */
export function maxLines(textBlocks: readonly TextBlock[]): number {
    return textBlocks.reduce((acc, tb) => Math.max(acc, tb.numLines), 0);
}
