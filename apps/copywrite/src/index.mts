/* eslint-disable @typescript-eslint/no-unused-expressions */

import * as url from "node:url";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import * as commandUpdate from "./commandUpdate.mjs";
import * as commandFull from "./commandFull.mjs";
import * as commandDiff from "./commandDiff.mjs";
import * as commandTo from "./commandTo.mjs";


if (runningThisScript()) {

    const res = await PromiseResult.forceResult(main());
    if (res.failed) {
        console.error(res.error);
        process.exit(-1);
    }
    else if (res.value !== 0) {
        console.error(`Script exited with code ${res.value}.`);
        process.exit(res.value);
    }
}


function runningThisScript(): boolean {
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]!).href;
    return runningThisScript;
}


async function main(): Promise<Result<number, string>> {

    await yargs(hideBin(process.argv))
    .command(commandUpdate)
    .command(commandFull)
    .command(commandDiff)
    .command(commandTo)
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    return new SucceededResult(0);
}
