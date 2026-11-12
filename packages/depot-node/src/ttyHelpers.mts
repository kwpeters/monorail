import * as fs from "node:fs";
import * as tty from "node:tty";
import { repeat, splitIntoLines, isBlank } from "@repo/depot/stringHelpers";
import { readableStreamToText } from "./streamHelpers.mjs";


/**
 * Returns the number of columns in the terminal window, or a default value if
 * the number of columns cannot be determined.
 *
 * @param defaultNumCols - The number of columns to use if the width of the
 *      terminal window cannot be determined
 * @returns The number of columns
 */
export function getStdoutColumns(defaultNumCols: number = 80): number {
    return process.stdout.columns || defaultNumCols;
}


/**
 * Returns a horizontal rule that is as wide as the terminal window.
 *
 * @param str - The horizontal rule will be composed of repeated instances of
 *      this string
 * @returns The resulting horizontal rule string
 */
export function hr(str: string): string {
    const cols = getStdoutColumns(80);
    const hr = repeat(str, cols);
    return hr;
}


/**
 * Opens the controlling terminal for reading keystrokes.  This is useful when
 * stdin has been redirected (e.g. data is piped in) but the program still
 * needs to interact with the user.
 *
 * When stdin is already a terminal, `process.stdin` itself is returned and
 * must not be destroyed (use `pause()` instead).  Otherwise a new stream is
 * opened and the caller owns it and should `destroy()` it when done.
 *
 * @example
 * ```typescript
 * const term = openControllingTerminal();
 * if (term === undefined) {
 *     throw new Error("No terminal available.");
 * }
 *
 * term.setRawMode(true);
 * term.resume();
 * term.once("data", () => {
 *     term.setRawMode(false);
 *     if (term === process.stdin) {
 *         term.pause();
 *     }
 *     else {
 *         term.destroy();
 *     }
 * });
 * ```
 *
 * @returns The terminal input stream, or `undefined` if there is no
 *      controlling terminal.
 */
export function openControllingTerminal(): tty.ReadStream | undefined {
    if (process.stdin.isTTY) {
        return process.stdin;
    }

    try {
        const path = process.platform === "win32" ? "\\\\.\\CONIN$" : "/dev/tty";
        const fd = fs.openSync(path, "r+");
        return new tty.ReadStream(fd);
    }
    catch {
        return undefined;
    }
}


/**
 * Determines whether a terminal can be read for keypresses, even when stdin
 * has been redirected.
 *
 * @returns `true` if a controlling terminal is available.
 */
export function canOpenControllingTerminal(): boolean {
    if (process.stdin.isTTY) {
        return true;
    }
    const term = openControllingTerminal();
    term?.destroy();
    return term !== undefined;
}


/**
 * Gets lines of text that are piped into this app's stdin, if any.
 *
 * @returns Lines of text that are being piped into this process, if any.
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
