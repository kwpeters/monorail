import { repeat, splitIntoLines, isBlank } from "@repo/depot/stringHelpers";
import { readableStreamToText } from "./streamHelpers.mjs";


export function hr(str: string): string {
    const cols = process.stdout.columns ?? 80;
    const hr = repeat(str, cols);
    return hr;
}


/**
 * Gets lines of text that are piped into this app's stdin, if any.
 *
 * @return Lines of text that are being piped into this process, if any.
 */
export async function getStdinPipedLines(): Promise<Array<string>> {
    const lines: Array<string> = [];
    const inputIsPiped = !process.stdin.isTTY;
    if (inputIsPiped) {
        const text = await readableStreamToText(process.stdin);
        const lines = splitIntoLines(text, false).filter((curLine) => !isBlank(curLine));
        lines.push(...lines);
    }
    return lines;
}
