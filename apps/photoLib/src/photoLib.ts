import * as os from "os";
import * as url from "url";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import {def as defImport} from "./importCommand.js";
import {def as defFix} from "./fixCommand.js";


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
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]).href;
    return runningThisScript;
}


async function main(): Promise<Result<number, string>> {

    let retVal: Result<number, string> = new SucceededResult(0);

    const __argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Provides several commands related to maintaining a photo library."
        ].join(os.EOL)
    )
    .command(
        defImport.command,
        defImport.description,
        defImport.builder,
        async (argv) => {
            retVal = await defImport.handler(argv);
        }
    )
    .command(
        defFix.command,
        defFix.description,
        defFix.builder,
        async (argv) => {
            retVal = await defFix.handler(argv);
        }
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    return retVal;
}
