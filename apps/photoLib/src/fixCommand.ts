import * as os from "os";
import { ArgumentsCamelCase, Argv } from "yargs";
import { glob } from "glob";
import table from "text-table";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { pipeAsync } from "../../../packages/depot/src/pipeAsync2.js";
import { mapAsync, Task } from "../../../packages/depot/src/promiseHelpers.js";
import { StorageSize } from "../../../packages/depot/src/storageSize.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { promptToContinue } from "../../../packages/depot-node/src/prompts.js";
import { TaskQueue } from "../../../packages/depot-node/src/taskQueue.js";
import { getDuplicateFiles } from "./fixCommandDeleteDuplicates.js";


/**
 * A type that describes the properties that are added to the Yargs arguments
 * object once the command line has been parsed.  This must be kept in sync with
 * the builder.
 */
export interface IArgsFix {
    photoLibDir: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const builder = (yargs: Argv<NonNullable<unknown>>) => {
    return  yargs
    .option(
        "photoLibDir",
        {
            describe:     "Path to root of photo library",
            type:         "string",
            demandOption: true
        }
    );
};


async function handler(argv: ArgumentsCamelCase<IArgsFix>): Promise<Result<number, string>> {
    const configRes = await argsToConfig(argv);
    if (configRes.failed) {
        return configRes;
    }

    return pipeAsync(
        removeDuplicates(configRes.value)
    );
}


/**
 * Config object for this subcommand.
 */
interface IFixConfig {
    photoLibDir: Directory;
}


/**
 * Converts this subcommand's arguments to its configuration object.
 *
 * @param argv - This subcommand's arguments
 * @return If successful, a successful Result containing the config object.
 */
async function argsToConfig(
    argv: ArgumentsCamelCase<IArgsFix>
): Promise<Result<IFixConfig, string>> {

    const photoLibDir = new Directory(argv.photoLibDir);

    const [photoLibDirExists] = await Promise.all([photoLibDir.exists()]);

    if (!photoLibDirExists) {
        return new FailedResult(`Photo library directory "${photoLibDir.toString()}" does not exist.`);
    }
    else {
        return new SucceededResult({ photoLibDir });
    }
}


/**
 * Definition of this subcommand.
 */
export const def = {
    command:     "fix",
    description: "Fixes common problems in a photo library.",
    builder:     builder,
    handler:     handler
};


async function removeDuplicates(config: IFixConfig): Promise<Result<number, string>> {

    // Find all directories in the photo library.  All backslashes need to be
    // replaced with forward slashes so that UNC paths will work correctly.
    const taskQueue = new TaskQueue(20);
    const globPattern = config.photoLibDir.toString().replace(/\\/g, "/") + "/**/";

    const dirs = await pipeAsync(
        globPattern,
        (pattern) => glob(pattern),
        (dirPathStrings) => dirPathStrings.map((curPathStr) => new Directory(curPathStr))
    );

    const dupeInfos = await pipeAsync(
        dirs,
        (dirs) => mapAsync(dirs, async (curDir) => taskQueue.push(() => getDuplicateFiles(curDir))),
        (dupes) => dupes.flat()
    );

    if (dupeInfos.length === 0) {
        console.log("No duplicate files found.");
        return new SucceededResult(0);
    }

    //
    // Generate a table containing one row for each duplicate found.
    //
    let totalBytes = 0;
    const rows = dupeInfos.map((dupeInfo) => {
        totalBytes += dupeInfo.duplicateSize.bytes;
        const [size, units] = dupeInfo.duplicateSize.normalized();
        return [
            dupeInfo.duplicateFile.toString(),
            `${size} ${units}`
        ];
    });
    // Add the total row.
    const [totalSize, totalUnits] = StorageSize.fromBytes(totalBytes).normalized();
    rows.push([`total duplicate files: ${dupeInfos.length}`, `${totalSize} ${totalUnits}`]);
    console.log(table(rows));

    //
    // Ask the user to confirm duplicate file deletion.
    //
    const confirmed = await promptToContinue(`Delete these duplicate files?`, false);
    if (!confirmed) {
        return new FailedResult("Duplicate removal cancelled by user.");
    }

    const {succeeded, failed} = await pipeAsync(
        dupeInfos.map((curDupeInfo) => curDupeInfo.duplicateFile),
        (dupeFiles) => mapAsync(dupeFiles, async (dupeFile) => taskQueue.push(getDeleteFileTask(dupeFile))),
        (results) => Result.partition(results)
    );

    if (failed.length > 0) {
        const msg = [
            "Some duplicates could not be deleted:",
            ...failed.map((failedDupeFile) => failedDupeFile.toString())
        ];
        return new FailedResult(msg.join(os.EOL));
    }
    else {
        console.log(`Successfully removed ${succeeded.length} duplicate files.`);
    }

    return new SucceededResult(0);

    function getDeleteFileTask(theFile: File): Task<Result<File, File>> {
        return async () => {
            const res = await PromiseResult.fromPromise(theFile.delete());
            return res.succeeded ? new SucceededResult(theFile) : new FailedResult(theFile);
        };
    }

}
