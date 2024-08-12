import * as fsp from "fs/promises";
import { ArgumentsCamelCase, Argv } from "yargs";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { pipeAsync } from "../../../packages/depot/src/pipeAsync2.js";
import { matchesAny, strToRegExp } from "../../../packages/depot/src/regexpHelpers.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { File } from "../../../packages/depot-node/src/file.js";


/**
 * Files that will be ignored when searching for files to be imported.
 */
const skipFileRegexes = [
    /Thumbs.db/i,
    /ZbThumbnail.info/i,
    /picasa.ini/i,
] as Array<RegExp>;


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

    const res = pipeAsync(
        removeDuplicates(configRes.value)
    );
    return res;
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


    const files = await pipeAsync(
        config.photoLibDir.contents(true),
        (contents) => contents.files,
        (files) => files.filter((curFile) => !matchesAny(curFile.absPath(), skipFileRegexes))
    );

    console.log(`Found ${files.length} files in photo library.`);
    if (files.length === 0) {
        return new SucceededResult(0);
    }

    return new SucceededResult(0);

}


export async function isDuplicateFile(file1: File, file2: File): Promise<boolean> {

    // Check the names for similarity.
    const isSimilarName = isSimilarFileName(file1, file2) || isSimilarFileName(file2, file1);
    if (!isSimilarName) {
        return false;
    }

    // Check the file sizes for equality.
    const [stat1, stat2] = await Promise.all([
        fsp.stat(file1.toString()),
        fsp.stat(file2.toString())
    ]);

    if (stat1.size === 0 || stat2.size === 0) {
        // The underlying file system does not support getting the size of the
        // file (see Node.js documentation).
        return false;
    }
    if (stat1.size !== stat2.size) {
        // The files have different sizes.  They are not duplicates.
        return false;
    }

    // The files have the same size.  See if they also have the same content.
    try {
        const [hash1, hash2] = await Promise.all([
            file1.getHash(),
            file2.getHash()
        ]);
        return hash1 === hash2;
    }
    catch (err) {
        return false;
    }
}


export function isSimilarFileName(referenceFile: File, otherFile: File): boolean {

    const similarRegexpRes = regexpForSimilar(referenceFile);
    if (similarRegexpRes.failed) {
        return false;
    }

    return similarRegexpRes.value.test(otherFile.toString());


    function regexpForSimilar(file: File): Result<RegExp, string> {
        let ext = referenceFile.extName;
        if (ext.startsWith(".")) {
            ext = ext.slice(1);
        }

        const patternStr = `${referenceFile.baseName}_\\d+\\.${ext}`;
        return strToRegExp(patternStr);
    }
}
