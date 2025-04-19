import { splitIntoLines } from "./stringHelpers.mjs";


export class TextBlock implements IHasToString {

    public static fromLines(lines: Array<string>): TextBlock {
        const updatedLines = [] as Array<string>;
        for (const curLine of lines) {
            updatedLines.push(...splitIntoLines(curLine));
        }
        return new TextBlock(updatedLines);
    }


    public static fromString(text: string): TextBlock {
        const lines = splitIntoLines(text);
        return TextBlock.fromLines(lines);
    }


    private readonly _lines: Array<string>;


    private constructor(lines: Array<string>) {
        this._lines = lines;
    }

    public get numColumns(): number {
        return this._lines.reduce((max, line) => Math.max(max, line.length), 0);
    }

    public get numLines(): number {
        return this._lines.length;
    }


    public get lines(): Array<string> {
        return this._lines.slice(0);
    }
}
