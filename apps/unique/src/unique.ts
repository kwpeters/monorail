////////////////////////////////////////////////////////////////////////////////
//
// A script that reads standard input and removes duplicates.
// Usage: cat ~/tmp/input.txt | node .\dist\src\unique.js
//
////////////////////////////////////////////////////////////////////////////////

import * as url from "url";
import { EOL} from "os";
import * as _ from "lodash-es";
import { Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { readableStreamToText } from "../../../packages/depot-node/src/streamHelpers.js";
import { splitLinesOsIndependent } from "../../../packages/depot/src/stringHelpers.js";


if (runningThisScript()) {

    const res = await PromiseResult.forceResult(main());
    if (res.failed) {
        console.error(res.error);
        process.exit(-1);
    }
    else if (res.value !== 0) {
        console.error(`Script exited with code ${res.value}.`);
        process.exit(-1);
    }
}


function runningThisScript(): boolean {
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]).href;
    return runningThisScript;
}


async function main(): Promise<Result<number, string>> {

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
