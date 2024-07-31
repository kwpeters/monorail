import * as os from "os";
import * as url from "url";
import yargs from "yargs/yargs";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { pipeAsync } from "../../../packages/depot/src/pipeAsync2.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { datestampStrategyFilePath } from "./datestampStrategy.js";
import { ConfidenceLevel } from "./datestampDeduction.js";

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
    const configRes = await getConfiguration();
    if (configRes.failed) {
        return configRes;
    }

    const deductions = await pipeAsync(
        configRes.value.importDir.contents(true),
        (dirContents) => dirContents.files,
        (files) => Promise.all(files.map((curFile) => datestampStrategyFilePath(curFile, configRes.value.photoLibDir)))
    );

    const lowConfidenceDeductions = deductions.filter((deduction) => deduction.confidence === ConfidenceLevel.NoClue ||
                                                                    deduction.confidence === ConfidenceLevel.Low);
    if (lowConfidenceDeductions.length > 0) {

        const lines = [
            "Low or no confidence determining the datestamp for one or more files:",
            ...lowConfidenceDeductions.map((deduction) => "    " + deduction.explanation)
        ];
        return new FailedResult(lines.join(os.EOL));
    }

    // Left off here.

    return new SucceededResult(0);
}


interface IConfig {
    importDir: Directory;
    photoLibDir: Directory;
}


/**
 * Gets the configuration for this script from the command line arguments.
 *
 * @return A Promise that always resolves with a Result.  If successful, the
 * Result contains the app configuration.  Otherwise the Result contains an
 * error message.
 */
async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv =
        await yargs(process.argv.slice(2))
        .usage(
            [
                "Moves photos and videos into my preferred photo directory structure.",
                "",
                "importPhotos <importDir> <photoLibDir>"
            ].join(os.EOL)
        )
        .help()
        .wrap(80)
        .argv;

    const args = await pipeAsync(
        argv._,
        // Silently disregard any number arguments.
        (args) => args.filter((arg): arg is string => typeof arg === "string"),
        (strArgs) => strArgs.map((strArg) => new Directory(strArg))
    );

    if (args.length !== 2) {
        return new FailedResult(`Expecting 2 arguments but got ${args.length}.`);
    }

    const importDir = new Directory(args[0]);
    if (!importDir.existsSync()) {
        return new FailedResult(`Import directory "${importDir.toString()}" does not exist.`);
    }
    const photoLibDir = new Directory(args[1]);
    if (!photoLibDir.existsSync()) {
        return new FailedResult(`Photo library directory "${photoLibDir.toString()}" does not exist.`);
    }

    return new SucceededResult({ importDir, photoLibDir });
}
