import * as fs from "fs";
import * as fsp from "fs/promises";
import { Result, FailedResult, SucceededResult } from "../../depot/src/result.js";
import { PromiseResult } from "../../depot/src/promiseResult.js";
import { assertNever } from "../../depot/src/never.js";
import { pipeAsync } from "../../depot/src/pipeAsync2.js";
import { errorToString } from "../../depot/src/errorHelpers.js";
import { Directory } from "./directory.js";
import { File } from "./file.js";
import { Symlink } from "./symlink.js";
import { FsPath } from "./fsPath.js";


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
