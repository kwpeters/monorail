import * as os from "node:os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult, FailedResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { isBlank, splitIntoLines } from "@repo/depot/stringHelpers";
import { type FsItem, fsPathToFsItem, updateTimes } from "@repo/depot-node/fsItem";
import { readableStreamToText } from "@repo/depot-node/streamHelpers";
import { FsPath } from "@repo/depot-node/fsPath";
import { NoneOption, SomeOption } from "@repo/depot/option";


interface IConfig {
    fsItems: Array<FsItem>;
    updateAccessTime: boolean;
    updateModifiedTime: boolean;
}


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

    //
    // Get the configuration.
    //
    const resConfig = await getConfiguration();
    if (resConfig.failed) {
        return resConfig;
    }

    const config = resConfig.value;
    const now = new Date();
    const optAccessTime = config.updateAccessTime ? new SomeOption(now) : NoneOption.get();
    const optModifiedTime = config.updateModifiedTime ? new SomeOption(now) : NoneOption.get();

    //
    // Touch the filesystem objects.
    //
    const resFsOperations = await pipeAsync(
        config.fsItems,
        (fsItems) => PromiseResult.allArrayM(
            fsItems.map((curFsItem) => updateTimes(curFsItem, optAccessTime, optModifiedTime))
        )
    );
    if (resFsOperations.failed) {
        return new FailedResult(resFsOperations.error.item);
    }

    // console.log(`${resFsOperations.value.length} items deleted.`);
    return new SucceededResult(0);
}


async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Updates the last access and modified times of the specified files and directories.",
            "",
            "touchem <options> [file_or_dir...]",
            "",
            "Specifying items via command line arguments:",
            "touchem <file_or_dir_1> <file_or_dir_2>",
            "",
            "Specifying items by piping input into this app:",
            "splat **/node_modules/ | touchem",
        ].join(os.EOL)
    )
    .option(
        "atime",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "Update the last access time to now"
        }
    )
    .option(
        "mtime",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "Update the last access time to now"
        }
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    if (!argv.atime && !argv.mtime) {
        return new FailedResult("Neither --atime or --mtime were specified.  Nothing to do.");
    }

    const inputIsPiped = !process.stdin.isTTY;
    const resFsItems = inputIsPiped ? await pipedInputToFsItems() : await argsToFsItems();

    return resFsItems.failed ?
        resFsItems :
        new SucceededResult({
            fsItems:            resFsItems.value,
            updateAccessTime:   argv.atime,
            updateModifiedTime: argv.mtime
        });


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
