import * as path from "path";
import * as fs from "fs";
import * as fsp from "fs/promises";
import { Result, FailedResult, SucceededResult } from "../../depot/src/result.js";
import { PromiseResult } from "../../depot/src/promiseResult.js";
import { errorToString } from "../../depot/src/errorHelpers.js";
import { PathPart, reducePathParts } from "./pathHelpers.js";
import { File } from "./file.js";
import { Directory } from "./directory.js";


export class Symlink {


    private readonly _symlinkPath: string;


    /**
     * Constructs a new instance.
     *
     * @param pathPart - First required part of the path
     * @param pathParts - Optional subsequent path parts
     */
    public constructor(pathPart: PathPart, ...pathParts: Array<PathPart>) {
        if (typeof pathPart === "string" && pathPart === "") {
            throw new Error("File instance created with illegal first pathPart.");
        }

        const allParts: Array<PathPart> = [pathPart].concat(pathParts);
        this._symlinkPath = reducePathParts(allParts);
    }


    /**
     * Gets the directory containing this symlink
     * @return A Directory object representing this symlink's directory.
     */
    public get directory(): Directory {
        const dirName: string = path.dirname(this._symlinkPath);
        return new Directory(dirName);
    }


    /**
     * Returns the path of this symlink within the filesystem
     *
     * @return The path of this symlink within the filesystem
     */
    public toString(): string {
        return this._symlinkPath;
    }


    /**
     * Gets the absolute path of this symlink (not of the target)
     *
     * @return The absolute path of this symlink (not of the target)
     */
    public absPath(): string {
        return path.resolve(this._symlinkPath);
    }


    /**
     * Creates this symlink in the filesystem
     *
     * @param target - The target of this symlink
     * @param pathType - Whether the path to the specified target should be a
     * relative path or an absolute path
     * @return A Promise that always resolves with a Result.  When successful,
     * the Result contains a reference to this instance.  When an error occurs,
     * the Result will contain a descriptive error message.
     */
    public async create(
        target: File | Directory | Symlink,
        pathType: "absolute" | "relative"
    ): Promise<Result<Symlink, string>> {

        const targetExists = await target.exists();
        if (!targetExists) {
            return new FailedResult(`Target of symlink "${target.toString()}" does not exist.`);
        }

        const symlinkDir = new Directory(path.dirname(this._symlinkPath));
        const symlinkDirStats = await symlinkDir.exists();
        if (!symlinkDirStats) {
            return new FailedResult(`Cannot create symlink ${this._symlinkPath} because the directory does not exist.`);
        }

        const symlinkPath = pathType === "relative" ?
            path.relative(symlinkDir.toString(), target.absPath()) :
            target.absPath();

        try {
            await fsp.symlink(
                symlinkPath,
                this._symlinkPath,
                target instanceof Directory ? "dir" : "file"
            );
        }
        catch (err: unknown) {
            return new FailedResult(`Failed to create symlink "${this._symlinkPath}".  ${errorToString(err)}`);
        }

        return new SucceededResult(this);
    }


    /**
     * Deletes this symlink.  The symlink is deleted, not the file it targets.
     *
     * @returns A Promise that resolves when this file has been deleted (or it
     * doesn't exist).
     */
    public async delete(): Promise<Result<void, string>> {

        return fsp.lstat(this._symlinkPath)
        .then(
            (stats) => {
                if (stats.isSymbolicLink()) {
                    return PromiseResult.fromPromise(fsp.unlink(this._symlinkPath));
                }
                else {
                    // The item in the filesystem is not a symbolic link.
                    return new FailedResult(`Cannot delete symlink "${this._symlinkPath}" because the item in the filesystem is not a symbolic link.`);
                }
            },
            (err: NodeJS.ErrnoException) => {
                if (err.code === "ENOENT") {
                    // Nothing exists in the filesystem.  Consider the deletion successful.
                    return new SucceededResult(undefined);
                }
                else {
                    // Some other error was encountered.  Fail.
                    return new FailedResult(`Failed to delete symlink "${this._symlinkPath}". ${errorToString(err)}`);
                }
            }
        );
    }


    /**
     * Gets this symlink's path to its target.
     *
     * @return A Promise that always resolves with a Result.  When successful,
     * the Result contains the path to the target.  Upon failure, the Result
     * contains a descriptive error message.
     */
    public async pathToTarget(): Promise<Result<string, string>> {
        try {
            const linkString = await fsp.readlink(this._symlinkPath);
            return new SucceededResult(linkString);
        }
        catch (err) {
            return new FailedResult(`Failed to read symlink "${this._symlinkPath}". ${errorToString(err)}`);
        }
    }


    /**
     * Checks to see if this Symlink exists.
     *
     * @return A Promise that always resolves.  It is resolved with a truthy
     * fs.Stats object for the symbolic link (not the target) if it exists.
     * Otherwise, it is resolved with undefined.
     */
    public exists(): Promise<fs.Stats | undefined> {
        return new Promise<fs.Stats | undefined>((resolve: (result: fs.Stats | undefined) => void) => {
            fs.lstat(this._symlinkPath, (err: unknown, stats: fs.Stats) => {
                if (!err && stats.isSymbolicLink()) {
                    resolve(stats);
                }
                else {
                    resolve(undefined);
                }
            });
        });
    }


    /**
     * Follows this symbolic link once and yields the target Directory, File or
     * Symlink.
     *
     * @return A Promise that always resolves with the operation status.  If
     * successful, the target Directory, File or Symlink is provided.  If this
     * symbolic link does not exist or the target does not exist, a failed
     * Result containing a descriptive error message is returned.
     */
    public async followOnce(): Promise<Result<Directory | File | Symlink, string>> {

        const thisStats = await this.exists();
        if (!thisStats) {
            return new FailedResult(`Symlink "${this._symlinkPath}" does not exist so it can't be followed.`);
        }

        const pathToTargetRes = await this.pathToTarget();
        if (pathToTargetRes.failed) {
            return pathToTargetRes;
        }

        const realPath = path.join(this.directory.toString(), pathToTargetRes.value);

        try {
            const targetStats = await fsp.lstat(realPath);
            if (targetStats.isFile()) {
                return new SucceededResult(new File(realPath));
            }
            else if (targetStats.isDirectory()) {
                return new SucceededResult(new Directory(realPath));
            }
            else if (targetStats.isSymbolicLink()) {
                return new SucceededResult(new Symlink(realPath));
            }
            else {
                return new FailedResult(`Target of symlink "${this._symlinkPath}" has unknown type.`);
            }
        }
        catch (err) {
            return new FailedResult(`The symlink "${this._symlinkPath}" has a target of "${pathToTargetRes.value}" which does not exist.`);
        }
    }


    /**
     * Follows all symbolic links until a destination Directory or File is
     * reached.
     *
     * @return A Promise that always resolves with the operation status.  If
     * successful, the final Directory or File is provided.  If this symbolic
     * link does not exist or any symbolic link target does not exist, a failed
     * Result containing a descriptive error message is returned.
     */
    public async followAll(): Promise<Result<Directory | File, string>> {

        // eslint-disable-next-line @typescript-eslint/no-this-alias, consistent-this
        let curFsItem: File | Directory | Symlink = this;
        while (curFsItem instanceof Symlink) {
            const res = await curFsItem.followOnce();
            if (res.failed) {
                return res;
            }
            curFsItem = res.value;
        }

        return new SucceededResult(curFsItem);
    }

}
