import { repeat, splitIntoLines, isBlank } from "@repo/depot/stringHelpers";
import { readableStreamToText } from "./streamHelpers.mjs";


/**
 * Returns the number of columns in the terminal window, or a default value if
 * the number of columns cannot be determined.
 *
 * @param defaultNumCols - The number of columns to use if the width of the
 *      terminal window cannot be determined
 * @return The number of columns
 */
export function getStdoutColumns(defaultNumCols: number = 80): number {
    return process.stdout.columns ?? defaultNumCols;
}


/**
 * Returns a horizontal rule that is as wide as the terminal window.
 *
 * @param str - The horizontal rule will be composed of repeated instances of
 *      this string
 * @return The resulting horizontal rule string
 */
export function hr(str: string): string {
    const cols = getStdoutColumns(80);
    const hr = repeat(str, cols);
    return hr;
}


/**
 * Gets lines of text that are piped into this app's stdin, if any.
 *
 * @return Lines of text that are being piped into this process, if any.
 */
export async function getStdinPipedLines(): Promise<Array<string>> {
    const inputIsPiped = !process.stdin.isTTY;

    if (!inputIsPiped) {
        return [];
    }

    const text = await readableStreamToText(process.stdin);
    const lines = splitIntoLines(text, false).filter((curLine) => !isBlank(curLine));
    return lines;
}
