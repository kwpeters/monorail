import * as os from "node:os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult, FailedResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { deleteFsItem, type FsItem, stringsToFsItems } from "@repo/depot-node/fsItem";
import { getStdinPipedLines } from "@repo/depot-node/ttyHelpers";


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
    inputStrings.push(...(await getStdinPipedLines()));

    const [nonExtant, extant] = await stringsToFsItems(inputStrings);
    if (nonExtant.length > 0) {
        console.error(`${nonExtant.length} items do not exist and will be skipped:`);
        nonExtant.forEach((nonextant) => {
            console.log(`    ${nonextant}`);
        });
    }

    if (extant.length === 0) {
        return new FailedResult("No valid input files specified.");
    }

    return new SucceededResult({ fsItems: extant });
}
