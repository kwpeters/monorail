import * as os from "node:os";
import * as fsp from "node:fs/promises";
import * as _ from "lodash-es";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult, FailedResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { isBlank, splitIntoLines } from "@repo/depot/stringHelpers";
import { deleteFsItem, type FsItem, fsPathToFsItem } from "@repo/depot-node/fsItem";
import { readableStreamToText } from "@repo/depot-node/streamHelpers";
import { FsPath } from "@repo/depot-node/fsPath";
import { mapAsync } from "@repo/depot/promiseHelpers";


interface IConfig {
    fsItems: Array<FsItem>;
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

    const inputStrings = argv._.filter((cur) => typeof cur === "string");

    // If input is being piped into this app, append to the list of inputs.
    const inputIsPiped = !process.stdin.isTTY;
    if (inputIsPiped) {
        const text = await readableStreamToText(process.stdin);
        const lines = splitIntoLines(text, false).filter((curLine) => !isBlank(curLine));
        inputStrings.push(...lines);
    }

    const resFsItems = await stringsToFsItems(inputStrings);

    return resFsItems.failed ?
        resFsItems :
        new SucceededResult({ fsItems: resFsItems.value });


    async function stringsToFsItems(
        strings: Array<string>
    ): Promise<Result<Array<FsItem>, string>> {

        const fsPaths = strings.map((curStr) => new FsPath(curStr));

        const [extant, nonextant] = await pipeAsync(
            mapAsync(fsPaths, async (fsPath) => {
                let exists = false;
                try {
                    const stats = await fsp.stat(fsPath.toString());
                    exists = !!stats;
                }
                catch (err) {
                    exists = false;
                }
                return { fsPath, exists };
            }),
            (objs) => _.partition(objs, (obj) => !!obj.exists)
        );

        if (nonextant.length > 0) {
            console.log(`${nonextant.length} items do not exist and will be skipped:`);
            nonextant.forEach((nonextant) => {
                console.log(`    ${nonextant.fsPath.toString()}`);
            });
        }

        return pipeAsync(
            extant.map((extant) => extant.fsPath),
            // Map to FsItem objects.
            (paths) => Promise.all(paths.map((curPath) => fsPathToFsItem(curPath))),
            // Convert array of Results to a Result for an array.
            (results) => Result.allArrayM(results)
        );

    }
}
