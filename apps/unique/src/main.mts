////////////////////////////////////////////////////////////////////////////////
//
// A script that reads standard input and removes duplicates.
// Usage: cat ~/tmp/input.txt | node .\dist\src\unique.js
//
////////////////////////////////////////////////////////////////////////////////

import { EOL} from "node:os";
import * as _ from "lodash-es";
import { Result, SucceededResult } from "@repo/depot/result";
import { splitLinesOsIndependent } from "@repo/depot/stringHelpers";
import { readableStreamToText } from "@repo/depot-node/streamHelpers";


export async function main(): Promise<number> {
    const res = await mainImpl();
    if (res.succeeded) {
        return res.value;
    }
    else {
        console.error(res.error);
        return -1;
    }
}


async function mainImpl(): Promise<Result<number, string>> {

    const text = await readableStreamToText(process.stdin);
    let lines = splitLinesOsIndependent(text);
    lines = lines.filter((curLine) => curLine.trim().length > 0);
    const numNonEmptyLines = lines.length;
    lines = _.uniq(lines);
    const numUniqueLines = lines.length;

    console.log(`Number of non-empty input lines: ${numNonEmptyLines}`);
    console.log(`Number of unique lines:          ${numUniqueLines}`);
    console.log("Unique lines:");
    console.log(lines.join(EOL));
    return new SucceededResult(0);
}
