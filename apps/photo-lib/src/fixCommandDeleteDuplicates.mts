import * as fsp from "node:fs/promises";
import * as _ from "lodash-es";
import { Result } from "@repo/depot/result";
import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { mapAsync } from "@repo/depot/promiseHelpers";
import { strToRegExp } from "@repo/depot/regexpHelpers";
import { StorageSize } from "@repo/depot/storageSize";
import { id } from "@repo/depot/functional";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";


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
    originalFile:  File;
    originalSize:  StorageSize;
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
