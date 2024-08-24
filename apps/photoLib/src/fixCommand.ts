import * as os from "os";
import * as fsp from "fs/promises";
import * as _ from "lodash-es";
import { ArgumentsCamelCase, Argv } from "yargs";
import { glob } from "glob";
import table from "text-table";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { NoneOption, Option, SomeOption } from "../../../packages/depot/src/option.js";
import { pipeAsync } from "../../../packages/depot/src/pipeAsync2.js";
import { mapAsync, Task } from "../../../packages/depot/src/promiseHelpers.js";
import { strToRegExp } from "../../../packages/depot/src/regexpHelpers.js";
import { StorageSize } from "../../../packages/depot/src/storageSize.js";
import { id } from "../../../packages/depot/src/functional.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { promptToContinue } from "../../../packages/depot-node/src/prompts.js";
import { TaskQueue } from "../../../packages/depot-node/src/taskQueue.js";


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


export async function getDuplicateFiles(dir: Directory): Promise<IDuplicateFileInfo[]> {
    return pipeAsync(
        dir.contents(false),
        (contents) => contents.files,
        (files) => mapAsync(files, async (curFile, idx, files) => {
            return pipeAsync(
                _.without(files, curFile),
                (otherFiles) => mapAsync(otherFiles, async (curOtherFile) => isDuplicateFile(curFile, curOtherFile)),
                (opts) => Option.choose(id, opts)
            );
        }),
        (dupes) => dupes.flat()
    );
}


export interface IDuplicateFileInfo {
    originalFile: File;
    originalSize: StorageSize;
    duplicateFile: File;
    duplicateSize: StorageSize;
}


/**
 * Determines whether possibleDuplicateFile is a duplicate of referenceFile.
 *
 * @param referenceFile - The reference file
 * @param potentialDuplicateFile - The possible duplicate file
 * @return true if possibleDuplicateFile is a duplicate of referenceFile;
 * otherwise false.
 */
export async function isDuplicateFile(
    referenceFile: File,
    potentialDuplicateFile: File
): Promise<Option<IDuplicateFileInfo>> {

    // Check the file names
    if (!isSimilarFileName(referenceFile, potentialDuplicateFile)) {
        return NoneOption.get();
    }

    // Check the file sizes for equality.
    const [refStats, dupeStats] = await Promise.all([
        fsp.stat(referenceFile.toString()),
        fsp.stat(potentialDuplicateFile.toString())
    ]);

    if (refStats.size === 0 || dupeStats.size === 0) {
        // The underlying file system does not support getting the size of the
        // file (see Node.js documentation).
        return NoneOption.get();
    }
    if (refStats.size !== dupeStats.size) {
        // The files have different sizes.  They are not duplicates.
        return NoneOption.get();
    }

    // The files have the same size.  See if they also have the same content.
    try {
        const [hash1, hash2] = await Promise.all([
            referenceFile.getHash(),
            potentialDuplicateFile.getHash()
        ]);
        return hash1 === hash2 ?
            new SomeOption({
                originalFile:  referenceFile,
                originalSize:  StorageSize.fromBytes(refStats.size),
                duplicateFile: potentialDuplicateFile,
                duplicateSize: StorageSize.fromBytes(dupeStats.size)
            }) :
            NoneOption.get();
    }
    catch (err) {
        return NoneOption.get();
    }
}


/**
 * Determines if possibleDuplicateFile has a name indicating that it is a
 * duplicate of referenceFile.
 *
 * @param referenceFile - The reference file
 * @param possibleDuplicateFile - The possible duplicate file
 * @return true if possibleDuplicateFile has a name indicating that it is a
 * possible duplicate of referenceFile.
 */
export function isSimilarFileName(referenceFile: File, possibleDuplicateFile: File): boolean {

    const similarRegexpRes = regexpForSimilar(referenceFile);
    if (similarRegexpRes.failed) {
        return false;
    }

    return similarRegexpRes.value.test(possibleDuplicateFile.toString());

    function regexpForSimilar(file: File): Result<RegExp, string> {
        let ext = referenceFile.extName;
        if (ext.startsWith(".")) {
            ext = ext.slice(1);
        }

        const patternStr = `${referenceFile.baseName}_\\d+\\.${ext}`;
        return strToRegExp(patternStr);
    }
}
