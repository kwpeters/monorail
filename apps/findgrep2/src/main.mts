import * as os from "node:os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult, FailedResult } from "@repo/depot/result";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { pipe } from "@repo/depot/pipe2";
import { isBlank, splitIntoLines } from "@repo/depot/stringHelpers";
import { fsPathToFsItem } from "@repo/depot-node/fsItem";
import { readableStreamToText } from "@repo/depot-node/streamHelpers";
import { FsPath } from "@repo/depot-node/fsPath";
import { File } from "@repo/depot-node/file";
import { strToRegExp } from "@repo/depot/regexpHelpers";


interface IConfig {
    files:     Array<File>;
    textRegex: RegExp;
}


/**
 * Entry point for the findgrep2 application. Runs the main implementation and
 * handles success/failure cases.
 *
 * @return 0 on success, -1 on failure
 */
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


/**
 * Main implementation of the findgrep2 application. Gets configuration and
 * performs the text search operation.
 *
 * @return Success with exit code 0, or failure with error message
 */
async function mainImpl(): Promise<Result<number, string>> {

    //
    // Get the configuration.
    //
    const resConfig = await getConfiguration();
    if (resConfig.failed) {
        return resConfig;
    }

    const config = resConfig.value;
    printConfig(config);

    return new SucceededResult(0);
}



/**
 * Parses command line arguments and stdin to create the application
 * configuration.
 *
 * @return Success with config object, or failure with error message
 */
async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Finds text within files.",
            "",
            "Specifying items by piping input into this app:",
            "splat **/node_modules/ | findgrep2 <textRegex>",
        ].join(os.EOL)
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    //
    // Get the names of the input files from stdin.
    //
    const inputIsPiped = !process.stdin.isTTY;
    if (!inputIsPiped) {
        return new FailedResult("No input provided via stdin.");
    }
    const resFsItems = await pipedInputToFsItems();
    if (resFsItems.failed) {
        return resFsItems;
    }

    //
    // Get the regex to search for within the files from the positional command
    // line argument.
    //
    const resTextRegexp = pipe(
        argv._,
        // Make sure there is only one positional argument.
        (positionals) => positionals.length === 1 ?
            new SucceededResult(positionals[0]) :
            new FailedResult("A single positional argument specifying the text regex to search for is required."),
        // Make sure the one positional is a string.
        (res) => res.bind((positional) => typeof positional === "string" ?
            new SucceededResult(positional) :
            new FailedResult("The positional argument specifying the text regex to search for must be a string.")),
        (res) => res.bind((str) => strToRegExp(str))
    );
    if (resTextRegexp.failed) {
        return resTextRegexp;
    }

    return new SucceededResult({
        files:     resFsItems.value,
        textRegex: resTextRegexp.value
    });


    /**
     * Reads lines from stdin and converts them to File objects.
     *
     * @return Success with array of File objects, or failure with error message
     */
    async function pipedInputToFsItems(): Promise<Result<Array<File>, string>> {
        return pipeAsync(
            // Get the text from the input stream.
            readableStreamToText(process.stdin),
            // Split the input into lines.
            (text) => splitIntoLines(text, false).filter((curLine) => !isBlank(curLine)),
            // Convert each line into a FsPath.
            (lines) => lines.map((curLine) => new FsPath(curLine)),
            // Check that the path exists and map to FsItem objects.
            (paths) => Promise.all(paths.map((curPath) => fsPathToFsItem(curPath))),
            // Convert array of Results to a Result for an array.
            (results) => Result.allArrayM(results),
            (res) => res.mapSuccess((fsItems) => fsItems.filter((fsItem): fsItem is File => fsItem instanceof File))
        );
    }
}



/**
 * Prints the configuration details to the console in a readable format.
 *
 * @param config - The configuration object to print
 */
function printConfig(config: IConfig): void {
    console.log("Configuration:");
    console.log("  Files:");
    for (const curFile of config.files) {
        console.log(`    ${curFile.toString()}`);
    }
    console.log(`  Text regex: ${config.textRegex.toString()}`);
    console.log();
}
