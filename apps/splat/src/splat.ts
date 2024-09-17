import * as os from "os";
import * as url from "url";
import * as _ from "lodash-es";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { glob } from "glob";
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
        process.exit(res.value);
    }
}


function runningThisScript(): boolean {
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]).href;
    return runningThisScript;
}


async function main(): Promise<Result<number, string>> {
    const argv =
        await yargs(hideBin(process.argv))
        .usage(
            [
                "Finds filesystem items matching glob patterns.",
                "",
                "splat <glob_patterns>"
            ].join(os.EOL)
        )
        .option(
            "cwd",
            {
                demandOption: false,
                type:         "string",
                default:      ".",
                describe:     "Current working directory to match in."
            }
        )
        .option(
            "info",
            {
                demandOption: false,
                type:         "boolean",
                default:      false,
                describe:     "Print additional info about matches found."
            }
        )
        .help()
        .wrap(process.stdout.columns ?? 80)
        .argv;

    if (argv._.length === 0) {
        return new FailedResult("Please specify at least one glob pattern.");
    }

    // Treat all globs that start with "!" as ignore globs.
    let [ignoreGlobs, includeGlobs] =
        _.partition(argv._ as Array<string>, (pattern) => pattern.startsWith("!"));

    // For each ignore glob, remove the initial "!".
    ignoreGlobs = ignoreGlobs.map((pattern) => pattern.slice(1));

    // Do the search.
    const paths =
        (await glob(includeGlobs, {ignore: ignoreGlobs, cwd: argv.cwd}))
        .sort();

    // Print the matches found.
    console.log(paths.join(os.EOL));

    // Print additional info, if requested.
    if (argv.info) {
        console.log("");
        console.log(`${paths.length} items found.`);
    }

    return new SucceededResult(0);
}
