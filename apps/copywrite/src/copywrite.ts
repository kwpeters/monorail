/* eslint-disable @typescript-eslint/no-unused-expressions */

import * as url from "url";
import yargs from "yargs/yargs";
import { Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import * as commandUpdate from "./commandUpdate.js";
import * as commandFull from "./commandFull.js";
import * as commandDiff from "./commandDiff.js";


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

    await yargs(process.argv.slice(2))
    // .usage("Usage: copywrite <command>")
    .command(commandUpdate)
    .command(commandFull)
    .command(commandDiff)
    .help()
    .wrap(80)
    .argv;

    return new SucceededResult(0);
}
