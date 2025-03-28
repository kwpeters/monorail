import * as _ from "lodash-es";
import { sprintf } from "sprintf-js";
import {createEolRegex} from "./regexpHelpers.mjs";
import { FailedResult, Result, SucceededResult } from "./result.mjs";
import { compareStrI, CompareResult } from "./compare.mjs";


////////////////////////////////////////////////////////////////////////////////
// Binary Values


export function hexStr(val: number): string {
    return "0x" + val.toString(16);
}


export function decAndHex(val: number): string {
    return `${val} (${hexStr(val) })`;
}


export function hexStr8(val: number): string {
    return sprintf("0x%02x", val);
}


export function hexStr16(val: number): string {
    return sprintf("0x%04x", val);
}


export function hexStr16Array(arr: Array<number>): string {
    if (arr.length === 0) {
        return "none";
    }

    const stringVals = _.map(arr, (curVal) => hexStr16(curVal));
    return _.join(stringVals, " ");
}


export function hexStr32(val: number): string {
    return sprintf("0x%08x", val);
}


////////////////////////////////////////////////////////////////////////////////
// Numeric


/**
 * Converts the specified number into exponential notation as displayed in
 * Studio 5000.
 * @param val - The value
 * @return A string containing the exponential notation form of val
 */
export function toExponential(val: number): string {
    let powerOfTen = 0;

    if (val !== 0) {
        while (Math.abs(val) < 1) {
            val = val * 10;
            --powerOfTen;
        }

        while (Math.abs(val) > 10) {
            val = val / 10;
            ++powerOfTen;
        }
    }

    const powerOfTenSign = powerOfTen < 0 ? "-" : "+";
    const powerOfTenAbs = Math.abs(powerOfTen).toString();

    return `${val.toFixed(8)}e${powerOfTenSign}${_.padStart(powerOfTenAbs, 3, "0")}`;
}


////////////////////////////////////////////////////////////////////////////////
// boolean

/**
 * Converts a string containing the text "true" or "false" (case insensitive) to
 * a boolean value.  Leading and trailing whitespace is ignored.
 *
 * @param str - The string to interpret
 * @return The boolean value represented by the string, or false if the string
 * is not "true" or "false"
 */
export function boolStrToBool(str: string): boolean {
    const trimmed = str.trim();
    return compareStrI(trimmed, "true") === CompareResult.EQUAL;
}


////////////////////////////////////////////////////////////////////////////////


/**
 * Counts the number of times _padStr_ occurs at the beginning of str.
 * @param str - The string to inspect
 * @param padStr - The substring to count occurrences of
 * @return The number of times _padStr_ occurs at the beginning of _str_
 */
export function numInitial(str: string, padStr: string): number {
    if (padStr === "") {
        return 0;
    }

    let curStr = str;
    let numOccurrences = 0;

    while (_.startsWith(curStr, padStr)) {
        ++numOccurrences;
        curStr = curStr.slice(padStr.length);
    }

    return numOccurrences;
}


////////////////////////////////////////////////////////////////////////////////
// Indentation


/**
 * Creates a string where each line of _src_ is indented.
 * @param src - The string to be indented
 * @param numSpacesOrPad - The number of spaces to indent each line
 * @param skipFirstLine - If truthy, the first line will not be indented
 * @return A new string where each line is indented
 */
export function indent(
    src: string,
    numSpacesOrPad: number | string,
    skipFirstLine = false
): string {
    if (numSpacesOrPad === 0) {
        return src;
    }
    else {
        // If the caller specified a string, use that as the pad.  Otherwise,
        // treat the number as the number of spaces.
        const pad: string = typeof numSpacesOrPad === "string" ?
                            numSpacesOrPad :
                            _.repeat(" ", numSpacesOrPad);

        // The only way replace() will replace all instances is to use the "g"
        // flag with replace(). Use the m flag so that ^ and $ match within the
        // string.
        // TODO: Convert the following regex to use named capture groups.
        // eslint-disable-next-line prefer-named-capture-group
        const replaceRegex = /^(.*?)$/gm;
        const replaceFunc = function replaceFunc(
            match: string,
            group1: string,
            offset: number
        ): string {
            // If told to skip the first line and this is the first line, skip it.
            return skipFirstLine && (offset === 0) ?
                   group1 :
                   pad + group1;
        };

        return _.replace(src, replaceRegex, replaceFunc);
    }
}


/**
 * Creates a new string where lines are no longer indented
 * @param str - The indented string
 * @param padStr - The string that has been used to indent lines in str
 * @param greedy - If `true`, as many occurrences of `padStr` will be removed as
 *     possible.  If `false`, only one occurrence will be removed.
 * @return A new version of str without the indentations
 */
export function outdent(str: string, padStr = " ", greedy = true): string {
    const lines = splitIntoLines(str, true);
    const initOccurrences = _.map(lines, (curLine) => numInitial(curLine, padStr));
    let numToRemove = _.min(initOccurrences);
    if (!greedy) {
        // We should not be greedy, so only remove (at most) 1 occurrence of
        // `padStr`.
        numToRemove = _.min([numToRemove, 1]);
    }

    const numCharsToRemove = padStr.length * numToRemove!;

    const resultLines = _.map(lines, (curLine) => curLine.slice(numCharsToRemove));
    // Join the lines back together again.
    return resultLines.join("");
}


////////////////////////////////////////////////////////////////////////////////
// Whitespace

const blankLineRegex = /^\s*$/;


/**
 * Creates a new version of str without leading and trailing blank lines
 * @param str - The original string
 * @return A version of str without leading and trailing blank lines
 */
export function trimBlankLines(str: string): string {
    const lines = splitIntoLines(str, true);

    while ((lines.length > 0) &&
          blankLineRegex.test(lines[0]!)) {
        lines.shift();
    }

    while ((lines.length > 0) &&
          blankLineRegex.test(_.last(lines)!)) {
        lines.pop();
    }

    // If lines have been removed from the end, we will have a new last line.
    // We need to make sure that new last line does not have an EOL.
    if (lines.length > 0) {
        lines[lines.length - 1] = lines[lines.length - 1]!.replace(createEolRegex(), "");
    }

    return lines.join("");
}


/**
 * Returns a string that is the same as `str`, but with blank lines removed.
 * @param str - The source string
 * @return A new string with blank lines removed
 */
export function removeBlankLines(str: string): string {
    if (str.length === 0) {
        return "";
    }

    let lines = splitIntoLines(str, true);
    lines = _.filter(lines, (curLine) => !isBlank(curLine));

    // If all processed lines were blank, just return an empty string.
    if (lines.length === 0) {
        return "";
    }

    // If lines have been removed from the end, we will have a new last line.
    // We need to make sure that new last line does not have an EOL.
    if (lines.length > 0) {
        lines[lines.length - 1] = lines[lines.length - 1]!.replace(createEolRegex(), "");
    }

    return lines.join("");
}


/**
 * Determines whether `text` consists of nothing but whitespace.
 * @param text - The string to analyze
 * @return true if `text` is nothing but whitespace; false otherwise.
 */
export function isBlank(text: string): boolean {
    return text.length === 0 || blankLineRegex.test(text);
}


/**
 * Determines whether the specified value is a string containing one or more
 * non-whitespace characters.  Suitable for dto or input validation.
 *
 * @param val - The value to test
 * @param errMsg - The error message that will be returned if _val_ is not a
 * string or is blank.
 * @return Whether the value is a string containing one or more non-whitespace
 * characters.
 */
export function isNonBlankString(val: unknown, errMsg: string): Result<string, string> {
    return typeof val === "string" && !isBlank(val) ?
        new SucceededResult(val) :
        new FailedResult(errMsg);
}


const whitespaceRegex = /\s+/g;


/**
 * Creates a new string in which all whitespace has been removed from str.
 * @param str - The original string to remove whitespace from
 * @return A new string in which all whitespace has been removed.
 */
export function removeWhitespace(str: string): string {
    return str.replace(whitespaceRegex, "");
}


/**
 * Creates a new string in which all consecutive whitespace is replaced
 * with the specified string.
 * @param str - The original string to remove whitespace from
 * @param replacement - the string that will replace all occurrences of
 *     one or more whitespace characters
 * @return A new string in which all whitespace has been collapsed.
 */
export function collapseWhitespace(str: string, replacement: string = " "): string {
    const collapsed = str.replace(whitespaceRegex, replacement);
    return collapsed;
}


/**
 * Splits a string into its individual lines.
 * @param text - The text to be split into individual lines
 * @param retainLineEndings - Whether each line should include the original line endings
 * @return An array containing the individual lines from `text`.
 */
export function splitIntoLines(text: string, retainLineEndings = false): Array<string> {
    if (text.length === 0) {
        return [];
    }

    const lines: Array<string> = [];
    const eolRegex = createEolRegex("g");
    let done = false;

    while (!done) {

        const startIndex = eolRegex.lastIndex;

        const match = eolRegex.exec(text);
        if (match) {

            let line: string = text.slice(startIndex, match.index);
            if (retainLineEndings) {
                line += match[0];
            }
            lines.push(line);

        }
        else {
            const line = text.slice(startIndex);
            lines.push(line);
            done = true;
        }
    }

    return lines;
}


/**
 * Splits a string into individual lines. The source string may contain
 * posix-style newlines, Windows-style newlines, or a mixture of the two.
 * @param src - The string to be split.
 * @return An array of string segments
 */
export function splitLinesOsIndependent(src: string): Array<string> {
    let lines = _.split(src, "\n");
    lines = _.map(lines, (curLine) => {
        return _.trimEnd(curLine, "\r");
    });
    return lines;
}


export function padLeft(src: string, pad: string, desiredLength: number): string {
    const numPadChars = desiredLength - src.length;
    if (numPadChars <= 0) {
        return src;
    }

    let fullPad = "";
    while (fullPad.length < numPadChars) {
        fullPad = fullPad + pad;
    }

    fullPad = fullPad.slice(0, numPadChars);
    return fullPad + src;
}


export function padRight(src: string, pad: string, desiredLength: number): string {
    const numPadChars = desiredLength - src.length;
    if (numPadChars <= 0) {
        return src;
    }

    let fullPad = "";
    while (fullPad.length < numPadChars) {
        fullPad = fullPad + pad;
    }

    fullPad = fullPad.slice(0, numPadChars);
    return src + fullPad;
}


/**
 * Figures our what EOL string is being used in the specified string.
 * @param text - The string to analyze
 * @return A string representing the EOL characters being used in `text`.  If no
 * end-of-line is found, undefined is returned.
 */
export function getEol(text: string): string | undefined {
    const match = createEolRegex().exec(text);
    if (!match) {
        return undefined;
    }
    else {
        return match[0];
    }
}


/**
 * Repeats _str_ to build a new string containing `numChars` characters.
 * @param str - The string to repeat until the given length is achieved
 * @param numChars - The desired length of the returned string.
 * @return A new string containing _str_ repeated until the specified length is
 * achieved.
 */
export function repeat(str: string, numChars: number): string {
    const repeatCount = Math.ceil(numChars / str.length);
    const tooLong = _.repeat(str, repeatCount);
    const res = tooLong.slice(0, numChars);
    return res;
}


/**
 * Removes and inserts characters at a specified index.
 * @param str - The string to operate on
 * @param index - The index where to delete and insert characters
 * @param numCharsToDelete - The number of chars to delete
 * @param insert - The string to be inserted
 * @returns The resulting string
 */
export function splice(str: string, index: number, numCharsToDelete: number, insert: string): string {
    // We cannot pass negative indexes directly to the 2nd slicing operation.
    if (index < 0) {
        index = str.length + index;
        if (index < 0) {
            index = 0;
        }
    }

    return str.slice(0, index) + (insert || "") + str.slice(index + numCharsToDelete);
}


/**
 * Attempts to parse a decimal string as an integer. This can be useful when the
 * input may be the string representation of a 64-bit integer, which cannot be
 * represented by JavaScript's number type (which only uses 53 bits for the
 * integer portion of the number).  If this function returns an error Result,
 * the client may want to fall back and use _BigInt_ or a library such as "long"
 * to handle the value.
 * @param intStr - The string to be parsed.
 * @returns
 */
export function parseDecInt(intStr: string): Result<number, string> {
    const num = parseInt(intStr, 10);
    const backToStr = num.toString();
    return backToStr === intStr ?
        new SucceededResult(num) :
        new FailedResult(`The string '${intStr}' has a lossy parsing of '${backToStr}'.`);

}


////////////////////////////////////////////////////////////////////////////////
// IP Address validation


/**
 * Regular expression for validating an IP address.
 * Hint:  You might find this string useful when setting the "ng-pattern"
 * attribute on an input element.
 */
export const ipAddrRegexString: string =
                 "^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$";

const ipAddrRegex: RegExp = new RegExp("^" + ipAddrRegexString + "$");

/**
 * Returns whether the specific string represents a valid IP address.
 * @param str - The string to be tested
 * @returns true if the specified string is a valid IP address
 */
export function isValidIpAddress(str: string): boolean {
    return ipAddrRegex.test(str);
}


////////////////////////////////////////////////////////////////////////////////
// Buffer


/**
 * Converts a Buffer to a string of space separated hexadecimal bytes.
 * @param buf - The Buffer to create a string for
 * @returns A string representation of buf
 */
export function getBufferString(buf: Buffer): string {
    if (buf.length === 0) {
        return "";
    }

    const result: string = _.reduce(
        buf,
        (acc: string, curByte: number) => {
            return acc + sprintf("%02x ", curByte);
        },
        ""
    );

    // Remove the last space character.
    return result.slice(0, -1);
}


////////////////////////////////////////////////////////////////////////////////
// Bracket Pairing


/**
 * An interface that describes (string) tokens that should be paired with one
 * another.  For example:
 *   - "[" and "]"
 *   - "{" and "}"
 *   - "<h1>" and "</h1>".
 */
export interface IPairing {
    begin: string;
    end:   string;
}


/**
 * Determines whether the specified tokens are properly nested (i.e. do not
 * overlap) and all begin tokens are paired with the corresponding end token.
 * @param pairings - An array of associated begin and end tokens to check
 * @param str - The string to check
 * @return true if all tokens are properly nested and paired; false otherwise.
 */
export function containsNestedPairs(pairings: Array<IPairing>, str: string): boolean {
    // All begin and end tokens combined in a single array.
    const allTokens: Array<string> = _.reduce(
        pairings,
        (acc: Array<string>, curPairing: IPairing) => {
            acc.push(curPairing.begin);
            acc.push(curPairing.end);
            return acc;
        },
        []
    );

    // A stack to track the current pairing state.  As each begin token is
    // encountered, the associated pairing is pushed onto this stack.
    // As we step through str, the only valid ending token is the one currently
    // on the top of this stack.
    const curState: Array<IPairing> = [];

    // Step through str until we have reached the end.
    for (let curIndex = 0; curIndex < str.length; ) {
        // Search starting at curIndex for the next token.
        let foundToken: string = "";
        const nextTokenIndex = _.findIndex(
            str,
            (curChar: string, index: number) => {
                return _.some(allTokens, (curToken) => {
                    const isMatch = str.substr(index, curToken.length) === curToken;
                    if (isMatch) {
                        foundToken = curToken;
                    }
                    return isMatch;
                });
            },
            curIndex
        );

        if (nextTokenIndex < 0) {
            // We did not find any more tokens.  We are done stepping through str.
            curIndex = str.length;
        }
        else {
            // If we found the ending to the current token pair, pop it off the stack.
            if (curState.length > 0 &&
                foundToken === _.last(curState)!.end) {
                curState.pop();
            }
            else {
                // If we have found the beginning of a new pairing, push it onto the stack.
                const newPairing = _.find(pairings, (curPairing) => curPairing.begin === foundToken);
                if (newPairing) {
                    curState.push(newPairing);
                }
                else {
                    // We must have found an (illegal) ending token.  The
                    // pairings are not properly nested.
                    return false;
                }
            }

            curIndex = nextTokenIndex + foundToken.length;
        }

    }

    // If all begin tokens have been properly paired with their corresponding
    // end token, the curState stack should be empty.
    return curState.length === 0;
}


/**
 * Attempts to parse _str_ as an integer in the specified radix.
 *
 * @param str - The string to be parsed
 * @param radix - The radix used in _str_.
 * @return A successful Result containing the parsed integer or a failed Result
 * containing a descriptive error message.
 */
export function tryParseInt(str: string, radix?: number): Result<number, string> {
    const parsed = parseInt(str, radix);
    return Number.isNaN(parsed) ?
        new FailedResult(`The string "${str}" cannot be parsed as an integer.`) :
        new SucceededResult(parsed);
}


/**
 * Searches the specified array for the specified string in a case insensitive
 * way.
 *
 * @param arr - The array to search
 * @param searchStr - The value to search for
 * @return Description
 */
export function includesCaseInsensitive(arr: string[], searchStr: string): boolean {
    const found = arr.find((curStr) => compareStrI(curStr, searchStr) === CompareResult.EQUAL);
    return found !== undefined;
}


export interface ITrimOptions {
    /**
     * If `true`, the specified string will only be trimmed if it starts and ends
     * with the specified string.
     */
    onlyTrimIfStartAndEnd: boolean;
}


/**
 * Trims the specified string from the beginning and end of the specified string.
 *
 * @param str - The string to be trimmed
 * @param toTrim - The string to look for at the beginning and end of _str_.
 * @return The trimmed string
 */
export function trimString(str: string, toTrim: string, opts: ITrimOptions): string {

    if (opts.onlyTrimIfStartAndEnd) {
        if (str.startsWith(toTrim) &&
            str.endsWith(toTrim)   &&
            str.length >= (2 * toTrim.length)) {
            return str.slice(toTrim.length, -toTrim.length);
        }
        else {
            return str;
        }
    }
    else {

        if (str.startsWith(toTrim)) {
            str = str.slice(toTrim.length);
        }
        if (str.endsWith(toTrim)) {
            str = str.slice(0, -toTrim.length);
        }

        return str;
    }
}
