import * as os from "os";
import * as url from "url";
import yargs from "yargs/yargs";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";


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
    const argv =
        await yargs(process.argv.slice(2))
        .usage(
            [
                "Finds filesystem items matching glob patterns.",
                "",
                "splat <glob_patterns>"
            ].join(os.EOL)
        )
        .help()
        .wrap(80)
        .argv;

    if (argv._.length === 0) {
        return new FailedResult("Please specify at least one glob pattern.");
    }

    const patterns: Array<string> = argv._ as Array<string>;

    console.log(patterns.join(os.EOL));

    return new SucceededResult(0);
}
