import * as os from "node:os";
import * as _ from "lodash-es";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { glob } from "glob";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";


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
