import * as fsp from "fs/promises";
import * as _ from "lodash-es";
import { Result } from "../../../packages/depot/src/result.js";
import { NoneOption, Option, SomeOption } from "../../../packages/depot/src/option.js";
import { pipeAsync } from "../../../packages/depot/src/pipeAsync2.js";
import { mapAsync } from "../../../packages/depot/src/promiseHelpers.js";
import { strToRegExp } from "../../../packages/depot/src/regexpHelpers.js";
import { StorageSize } from "../../../packages/depot/src/storageSize.js";
import { id } from "../../../packages/depot/src/functional.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { File } from "../../../packages/depot-node/src/file.js";


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
