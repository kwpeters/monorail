import * as os from "os";
import * as url from "url";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult, FailedResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { pipeAsync } from "../../../packages/depot/src/pipeAsync2.js";
import { isBlank, splitIntoLines } from "../../../packages/depot/src/stringHelpers.js";
import { deleteFsItem, FsItem, fsPathToFsItem } from "../../../packages/depot-node/src/fsItem.js";
import { readableStreamToText } from "../../../packages/depot-node/src/streamHelpers.js";
import { FsPath } from "../../../packages/depot-node/src/fsPath.js";


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


interface IConfig {
    fsItems: Array<FsItem>;
}


async function main(): Promise<Result<number, string>> {

    //
    // Get the configuration.
    //
    const resConfig = await getConfiguration();
    if (resConfig.failed) {
        return resConfig;
    }

    const config = resConfig.value;

    //
    // Perform the deletions.
    //
    const resDeletions = await pipeAsync(
        config.fsItems,
        (fsItems) => PromiseResult.allArrayM(fsItems.map((curFsItem) => deleteFsItem(curFsItem)))
    );
    if (resDeletions.failed) {
        return new FailedResult(resDeletions.error.item);
    }

    console.log(`${resDeletions.value.length} items deleted.`);
    return new SucceededResult(0);
}


async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Deletes the specified directories and files.",
            "",
            "Specifying items to delete via command line arguments:",
            "rmrf <file_or_dir_1> <file_or_dir_2>",
            "",
            "Specifying items to delete by piping input into this app:",
            "splat **/node_modules/ | rmrf",
        ].join(os.EOL)
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    const inputIsPiped = !process.stdin.isTTY;
    const resFsItems = inputIsPiped ? await pipedInputToFsItems() : await argsToFsItems();

    return resFsItems.failed ?
        resFsItems :
        new SucceededResult({ fsItems: resFsItems.value });


    async function pipedInputToFsItems(): Promise<Result<Array<FsItem>, string>> {
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
            (results) => Result.allArrayM(results)
        );
    }

    async function argsToFsItems(): Promise<Result<Array<FsItem>, string>> {
        return pipeAsync(
            argv._,
            // Arguments can be numbers too.  Convert all of them to strings.
            (args) => args.map((curArg) => curArg.toString()),
            // Convert to FsPath objects.
            (strs) => strs.map((curStr) => new FsPath(curStr)),
            // Check that the path exists and map to FsItem objects.
            (paths) => Promise.all(paths.map((curPath) => fsPathToFsItem(curPath))),
            // Convert array of Results to a Result for an array.
            (results) => Result.allArrayM(results)
        );
    }
}
