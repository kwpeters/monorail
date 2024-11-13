import { sprintf } from "sprintf-js";
import { FailedResult, Result, SucceededResult } from "./result.mjs";
import { isBlank } from "./stringHelpers.mjs";
import { pipe } from "./pipe2.mjs";


const byteRegexStr = "^[0-9a-fA-F]{1,2}$";


/**
 * A function to get a regex that matches a single byte.  Getting this regex
 * is wrapped by this function, because the returned RegExp object has state.
 *
 * @return The regex used to match a hexadecimal byte in string form.
 */
function getByteRegex(): RegExp {
    return new RegExp(byteRegexStr);
}


export class ByteString {

    public static create(str: string): Result<ByteString, string> {
        // Split the string on any chunks of whitespace and remove any that
        // contain only whitespace (this could happen at the beginning and end
        // of the string).
        const tokens = pipe(
            str.split(/\s+/),
            (tokens) => tokens.filter((token) => !isBlank(token))
        );

        const byteRegex = getByteRegex();

        const results = tokens.map((token) => {
            if (byteRegex.test(token)) {
                const byteVal = parseInt(token, 16);
                return new SucceededResult(byteVal);
            }
            else {
                return new FailedResult(`The token "${token}" could not be parsed as a byte value.`);
            }
        });

        const res = Result.allArrayM(results);
        if (res.failed) {
            return res;
        }

        const inst = new ByteString(str, res.value);
        return new SucceededResult(inst);
    }


    private readonly _origStr: string;
    private readonly _bytes: ReadonlyArray<number> = [];


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
        const normalized =
            this._bytes.map((byte) => sprintf("%02x", byte))
            .join(" ");
        return normalized;
    }

}
