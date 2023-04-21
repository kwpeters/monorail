import { FailedResult, Result, SucceededResult } from "./result.js";


const byteRegexStr = "\\s*(?<byteval>[0-9a-fA-F]{1,2})\\s*";


/**
 * A function to get a the regex that matches a single byte.  Getting this regex
 * is wrapped by this function, because the returned RegExp object has state.
 *
 * @return The regex used to match a hexadecimal byte in string form.
 */
function getByteRegex(): RegExp {
    return new RegExp(byteRegexStr, "gd");
}


export class ByteString {

    public static create(str: string): Result<ByteString, string> {

        const byteRegex = getByteRegex();

        const bytes: Array<number> = [];
        let curIndex = 0;

        while (curIndex < str.length) {
            const match = byteRegex.exec(str);

            if (match && match.index === curIndex) {
                // There is a match and it starts at our current position.  Use
                // the match to get the next byte.
                const byteValStr = match.groups!.byteval;
                const byteVal = parseInt(byteValStr, 16);
                bytes.push(byteVal);
                curIndex += match[0].length;
            }
            else {
                // One of the following happened:
                //   - There was no match and we are not at the end of the
                //     string yet.
                //   - There was a match, but it does not start at the current
                //     position, meaning there are some illegal characters at
                //     the current position.
                // Either way, it's bad.
                const msg = `Failed to parse byte string "${str}" at position ${curIndex}.`;
                return new FailedResult(msg);
            }
        }

        return new SucceededResult(new ByteString(str, bytes));
    }


    private readonly _origStr: string;
    private readonly _bytes: Array<number> = [];


    private constructor(origStr: string, bytes: Array<number>) {
        this._origStr = origStr;
        this._bytes = bytes;
    }


    public get length(): number {
        return this._bytes.length;
    }


    public toString(): string {
        return this._origStr;
    }


    public toNormalizedString(): string {
        const normalized = this._bytes.map((byte) => byte.toString(16)).join(" ");
        return normalized;
    }

}
