import * as url from "node:url";
import * as os from "node:os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";

// Command modules
import { def as cmdDefCjsToSeaApp } from "./commandCjsToSeaApp.mjs";


////////////////////////////////////////////////////////////////////////////////
// Bootstrap
////////////////////////////////////////////////////////////////////////////////

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


////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////

async function main(): Promise<Result<number, string>> {
    let retVal: Result<number, string> = new SucceededResult(0);

    const __argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Provides commands that help build apps within this repo."
        ].join(os.EOL)
    )
    .command(
        cmdDefCjsToSeaApp.command,
        cmdDefCjsToSeaApp.description,
        cmdDefCjsToSeaApp.builder,
        async (argv) => {
            retVal = await cmdDefCjsToSeaApp.handler(argv);
        }
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    return retVal;
}
