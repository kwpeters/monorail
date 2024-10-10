import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { assertNever } from "@repo/depot/never";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { errorToString } from "@repo/depot/errorHelpers";
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
