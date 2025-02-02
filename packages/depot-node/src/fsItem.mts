import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as _ from "lodash-es";
import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { PromiseResult } from "@repo/depot/promiseResult";
import { assertNever } from "@repo/depot/never";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { errorToString } from "@repo/depot/errorHelpers";
import { mapAsync } from "@repo/depot/promiseHelpers";
import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";
import { Symlink } from "./symlink.mjs";
import { FsPath } from "./fsPath.mjs";


export type FsItem = Directory | File | Symlink;


export async function fsPathToFsItem(path: FsPath): Promise<Result<FsItem, string>> {
    let stats: fs.Stats;
    try {
        stats = await fsp.lstat(path.toString());
    }
    catch (err) {
        return new FailedResult(`Item "${path.toString()}" does not exist in filesystem.  ${errorToString(err)}`);
    }

    if (stats.isDirectory()) {
        return new SucceededResult(new Directory(path.toString()));
    }
    else if (stats.isSymbolicLink()) {
        return new SucceededResult(new Symlink(path.toString()));
    }
    else if (stats.isFile()) {
        return new SucceededResult(new File(path.toString()));
    }
    else {
        return new FailedResult(`Filesystem item "${path.toString()}" has unknown type.`);
    }
}



export async function deleteFsItem(fsItem: FsItem): Promise<Result<FsItem, string>> {
    if (fsItem instanceof Directory) {
        return fsItem.delete()
        .then(
            () => new SucceededResult(fsItem),
            (err) => new FailedResult(errorToString(err))
        );
    }
    else if (fsItem instanceof File) {
        return fsItem.delete()
        .then(
            () => new SucceededResult(fsItem),
            (err) => new FailedResult(errorToString(err))
        );
    }
    else if (fsItem instanceof Symlink) {
        return pipeAsync(
            fsItem.delete(),
            (res) => PromiseResult.mapSuccess(() => fsItem, res)
        );
    }
    else {
        assertNever(fsItem);
    }
}


/**
 * Updates the last access time and modified time of the specified filesystem
 * item.
 *
 * @param fsItem - The filesystem item to be updated
 * @param optAccessTime - An Option for the new last access time.  If a
 *      NoneOption, the current value will be preserved.
 * @param optModificationTime - An Option for the new last modified time.  If a
 *      NoneOption, the current value will be preserved.
 * @return The original _fsItem_
 */
export async function updateTimes(
    fsItem: FsItem,
    optAccessTime: Option<Date>,
    optModificationTime: Option<Date>
): Promise<Result<FsItem, string>> {

    if (optAccessTime.isNone && optModificationTime.isNone) {
        return new SucceededResult(fsItem);
    }

    let optStats: Option<fs.Stats> = NoneOption.get();

    // If either time has not been specified, we need to stat the item to get
    // the current value.
    if (optAccessTime.isNone || optModificationTime.isNone) {
        try {
            const stats = await fsp.stat(fsItem.toString());
            optStats = new SomeOption(stats);
        }
        catch (err) {
            return new FailedResult((err as Error).message);
        }
    }

    const aTime =
        optAccessTime
        .bindNone(() => optStats.mapSome((stats) => stats.atime));
    const mTime =
        optModificationTime
        .bindNone(() => optStats.mapSome((stats) => stats.mtime));

    if (aTime.isNone || mTime.isNone) {
        // This should never happen.
        return new FailedResult("Failed to calculate new aTime or mTime.");
    }

    try {
        await fsp.utimes(fsItem.toString(), aTime.value, mTime.value);
    }
    catch (err) {
        return new FailedResult((err as Error).message);
    }

    return new SucceededResult(fsItem);
}


/**
 * Converts an array of strings to a tuple containing the strings that represent
 * non-extant FsItems and FsItem instances that represent extant file system
 * objects.
 *
 * @param candidates - The strings that represent possible filesystem paths
 * @return A tuple.  The first element contains the strings that represent non
 * extant filesystem objects.  The second element contains FsItem instances that
 * represent extant filesystem objects.
 */
export async function stringsToFsItems(
    candidates: Array<string>
): Promise<[Array<string>, Array<FsItem>]> {

    const fsPaths = candidates.map((curStr) => new FsPath(curStr));

    const [extant, nonExtant] = await pipeAsync(
        mapAsync(fsPaths, async (fsPath) => {

            const res = await fsPathToFsItem(fsPath);
            if (res.succeeded) {
                return { fsPath, fsItem: res.value };
            }
            else {
                return { fsPath, fsItem: undefined };
            }
        }),
        (objs) => _.partition(objs, (obj) => !!obj.fsItem)
    );

    return [
        nonExtant.map((x) => x.fsPath.toString()),
        extant.map((x) => x.fsItem)
    ];
}
