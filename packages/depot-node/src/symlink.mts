import * as path from "node:path";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { pipeAsync } from "@repo/depot/pipeAsync";
import { errorToString } from "@repo/depot/errorHelpers";
import { type PathPart, reducePathParts } from "./pathHelpers.mjs";
import { File } from "./file.mjs";
import { Directory } from "./directory.mjs";
import { getFilesystemItem } from "./filesystemHelpers.mjs";


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
     * Gets the directory portion of this symlink's path (everything before the
     * file name and extension).
     * @return The directory portion of this symlink's path.  This string will
     * always end with the OS's directory separator ("/").
     */
    public get dirName(): string {
        return path.dirname(this._symlinkPath) + path.sep;
    }


    /**
     * Gets this symlink's base name.  This is the part of the name preceding
     * the extension.
     * @return This symlink's base name.
     */
    public get baseName(): string {
        const extName: string = path.extname(this._symlinkPath);
        return path.basename(this._symlinkPath, extName);
    }


    /**
     * Gets the full file name of this symbolic link.  This includes both the
     * base name and extension.
     * @return This symlink's file name
     */
    public get fileName(): string {
        return path.basename(this._symlinkPath);
    }


    /**
     * Gets the extension of this symlink.  This includes the initial dot (".").
     * If the symlink has no extension an empty string is returned.
     * @return This symlink's extension
     */
    public get extName(): string {
        return path.extname(this._symlinkPath);
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
     * Copies this symlink to the specified destination, preserving the
     * relative/absolute nature of the target path.
     *
     * Note: When performing this operation, this link must refer to an extant
     * target so that the type of the link can be determined.  If the target
     * does not exist, a failed Result is returned.
     *
     * Note:  If this Symlink has a relative path to its target, the copied
     * Symlink will have the exact same relative path.  Nothing will be done to
     * correct the relative path so that it refers to the same target file.
     *
     * @param dstDirOrSymlink - If a Symlink, specifies the
     * destination directory and file name.  If a directory, specifies only the
     * destination directory and _dstSymlinkName_ specifies the destination file
     * name.
     * @param dstSymlinkName - When _dstDirOrSymlink_ is a Directory,
     * optionally specifies the destination file name.  If omitted, the
     * destination file name will be the same as this Symlink.
     * @return A Promise that always resolves with a Result.  If successful, the
     * Result contains the destination Symlink instance.  If an error occurred,
     * an error message is contained.
     */
    public async copy(dstDirOrSymlink: Directory | Symlink, dstSymlinkName?: string): Promise<Result<Symlink, string>> {

        const targetFsItemRes = await this.followOnce();
        if (targetFsItemRes.failed) {
            return targetFsItemRes;
        }

        const pathToTargetRes = await this.pathToTarget();
        if (pathToTargetRes.failed) {
            return pathToTargetRes;
        }

        const dest: Symlink =
            dstDirOrSymlink instanceof Symlink ?
                dstDirOrSymlink :
                dstSymlinkName === undefined ?
                    new Symlink(dstDirOrSymlink, this.fileName) :
                    new Symlink(dstDirOrSymlink, dstSymlinkName);

        await dest.directory.ensureExists();
        const symlinkType = targetFsItemRes.value instanceof Directory ? "dir" : "file";

        const pr =
            pipeAsync(PromiseResult.fromPromise(fsp.symlink(pathToTargetRes.value, dest._symlinkPath, symlinkType)))
            .pipe((res) => Result.mapSuccess(() => dest, res))
            .end();

        return pr;
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
     * Moves this symlink to the specified destination, preserving the
     * relative/absolute nature of the target path.
     *
     * Note: When performing this operation, this link must refer to an extant
     * target so that the type of the link can be determined.  If the target
     * does not exist, a failed Result is returned.
     *
     * Note:  If this Symlink has a relative path to its target, the copied
     * Symlink will have the exact same relative path.  Nothing will be done to
     * correct the relative path so that it refers to the same target file.
     *
     * @param dstDirOrSymlink - If a Symlink, specifies the
     * destination directory and file name.  If a directory, specifies only the
     * destination directory and _dstSymlinkName_ specifies the destination file
     * name.
     * @param dstSymlinkName - When _dstDirOrSymlink_ is a Directory,
     * optionally specifies the destination file name.  If omitted, the
     * destination file name will be the same as this Symlink.
     * @return A Promise that always resolves with a Result.  If successful, the
     * Result contains the destination Symlink instance.  If an error occurred,
     * an error message is contained.
     */
    public async move(dstDirOrSymlink: Directory | Symlink, dstFileName?: string): Promise<Result<Symlink, string>> {
        const copyRes = await this.copy(dstDirOrSymlink, dstFileName);
        if (copyRes.failed) {
            return copyRes;
        }

        const delRes = await this.delete();
        if (delRes.failed) {
            return delRes;
        }

        return copyRes;
    }


    /**
     * Gets this symlink's path to its target.
     *
     * @return A Promise that always resolves with a Result.  When successful,
     * the Result contains the path to the target (relative or absolute).  Upon
     * failure, the Result contains a descriptive error message.
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

        const targetFsItemRes = await getFilesystemItem(this.directory.toString(), pathToTargetRes.value);
        return targetFsItemRes;
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
            const res: Result<Directory | File | Symlink, string> = await curFsItem.followOnce();
            if (res.failed) {
                return res;
            }
            curFsItem = res.value;
        }

        return new SucceededResult(curFsItem);
    }

}
