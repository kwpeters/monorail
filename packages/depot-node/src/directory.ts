import * as fs from "fs";
import * as fsp from "fs/promises";
import * as path from "path";
import * as _ from "lodash-es";
import { sequence, mapAsync } from "../../depot/src/promiseHelpers.js";
import { StorageSize } from "../../depot/src/storageSize.js";
import { matchesAny } from "../../depot/src/regexpHelpers.js";
import {File} from "./file.js";
import {PathPart, reducePathParts} from "./pathHelpers.js";
import { ISystemError } from "./nodeTypes.js";


export interface IDirectoryContents {
    subdirs: Array<Directory>;
    files:   Array<File>;
}


export type WalkCallback = (item: Directory | File) => boolean | Promise<boolean>;

export interface IFilterResult {
    recurse?: boolean;
    include: boolean;
}
export type FilterCallback = (item: Directory | File) => IFilterResult | Promise<IFilterResult>;

export class Directory {

    /**
     * Creates a Directory representing the relative path from `from` to `to`
     * @param from - The starting directory
     * @param to - The ending directory
     * @return A directory representing the relative path from `from` to `to`
     */
    public static relative(
        from: Directory,
        to:   Directory
    ): Directory {
        const relPath = path.relative(from.toString(), to.toString());
        return new Directory(relPath);
    }


    /**
     * Calculates the parts of the relative path from `from` to `to`.
     * @param from - The starting point
     * @param to - The ending point
     * @return An array of strings representing the path segments needed to get
     * from `from` to `to`.
     */
    public static relativeParts(from: Directory, to: Directory): Array<string> {
        const relPath = path.relative(from.toString(), to.toString());
        return relPath.split(path.sep);
    }


    // region Data Members
    private readonly _dirPath: string;
    private _cachedSize: StorageSize | undefined;
    // endregion


    /**
     * Constructs a new instance.
     *
     * @param pathPart - First required part of the path
     * @param pathParts - Optional subsequent path parts
     */
    public constructor(pathPart: PathPart, ...pathParts: Array<PathPart>) {
        const allParts: Array<PathPart> = [pathPart].concat(pathParts);
        this._dirPath = reducePathParts(allParts);

        if (this._dirPath === "\\" || this._dirPath === "/") {
            // The path begins with a directory separator, which means that it
            // is a relative path starting from the root of the drive.
            this._dirPath = path.resolve(this._dirPath);
        }

        // Remove trailing directory separator characters.
        while ((this._dirPath.length > 1) &&
            this._dirPath.endsWith(path.sep)) {
            this._dirPath = this._dirPath.slice(0, -1);
        }
    }


    /**
     * Gets the name of this directory (without the preceding path)
     */
    public get dirName(): string {
        if (this._dirPath.length === 0) {
            // This directory represents the root of the filesystem.
            return "/";
        }
        else {
            return this._dirPath.split(path.sep).at(-1)!;
        }
    }


    public toString(): string {
        return this._dirPath;
    }


    public equals(otherDir: Directory): boolean {
        return this.absPath() === otherDir.absPath();
    }


    /**
     * Gets the parent directory of this directory, if one exists.
     * @return This directory's parent directory.  undefined is returned if this
     * directory is the root of a drive.
     */
    public parentDir(): undefined | Directory {
        const parts = this.split();

        // If the directory separator was not found, the split will result in a
        // 1-element array.  If this is the case, this directory is the root of
        // the drive.
        if (parts.length === 1) {
            return undefined;
        }

        const parentParts = _.dropRight(parts);
        const [first, ...rest] = parentParts;
        const firstDir = new Directory(first);
        const parentDir = new Directory(firstDir, ...rest);
        return parentDir;
    }


    /**
     * Determines whether this directory is the root of a drive.
     * @return true if this directory is the root of a drive.  false otherwise.
     */
    public isRoot(): boolean {
        return this.parentDir() === undefined;
    }


    /**
     * Gets the absolute path of this Directory.
     * @return The absolute path of this Directory
     */
    public absPath(): string {
        if (this._dirPath[1] === ":") {
            // The path is a Windows path that already has a drive letter at the
            // beginning.  It is already absolute.
            return this._dirPath;
        }
        else {
            return path.resolve(this._dirPath);
        }
    }


    /**
     * Makes another Directory instance that is wrapping this Directory's
     * absolute path.
     * @return A new Directory representing this Directory's absolute path.
     */
    public absolute(): Directory {
        return new Directory(this.absPath());
    }


    public exists(): Promise<fs.Stats | undefined> {
        return new Promise<fs.Stats | undefined>((resolve: (result: fs.Stats | undefined) => void) => {
            fs.lstat(this._dirPath, (err: unknown, stats: fs.Stats) => {
                if (!err && stats.isDirectory()) {
                    resolve(stats);
                }
                else {
                    resolve(undefined);
                }

            });
        });
    }


    public existsSync(): fs.Stats | undefined {
        try {
            const stats = fs.lstatSync(this._dirPath);
            return stats.isDirectory() ? stats : undefined;
        }
        catch (err) {
            if ((err as NodeJS.ErrnoException).code === "ENOENT") {
                return undefined;
            }
            else {
                throw err;
            }
        }
    }


    public isEmpty(): Promise<boolean> {
        return fsp.readdir(this._dirPath)
        .then((fsEntries) => {
            return fsEntries.length === 0;
        });
    }


    public isEmptySync(): boolean {
        const fsEntries = fs.readdirSync(this._dirPath);
        return fsEntries.length === 0;
    }


    /**
     * Creates the directory represented by this instance.  If needed,
     * nonexistent parent directories will also be created.
     * @returns A Promise that resolves with this Directory instance (for
     * chaining) when this operation completes.
     */
    public ensureExists(): Promise<Directory> {
        return this.exists()
        .then((stats) => {
            if (stats) {
                return;
            }
            else {
                const parts = this.split();

                // Create an array of successively longer paths, each one adding a
                // new directory onto the end.
                const dirsToCreate = parts.reduce((acc: Array<string>, curPart: string): Array<string> => {
                    if (acc.length === 0) {
                        if (curPart.length === 0) {
                            // The first item is an empty string.  The path must
                            // have started with the directory separator character
                            // (an absolute path was specified).
                            acc.push(path.sep);
                        }
                        else {
                            // The first item contains text.  A relative path must
                            // have been specified.
                            acc.push(curPart);
                        }
                    }
                    else {
                        const last = acc[acc.length - 1]!;
                        const newDirPath = path.join(last, curPart);
                        acc.push(newDirPath);
                    }
                    return acc;
                }, []);

                // Don't attempt to create the root of the filesystem.
                if ((dirsToCreate.length > 0) && ((new Directory(dirsToCreate[0])).parentDir() === undefined)) {
                    dirsToCreate.shift();
                }

                // Map each successively longer path to a function that will create
                // it.
                const createFuncs = dirsToCreate.map((dirToCreate: string) => {
                    return (): Promise<void> => {
                        return fsp.mkdir(dirToCreate)
                        .catch((err: ISystemError) => {
                            // If the directory already exists, just keep going.
                            if (err.code !== "EEXIST") {
                                throw err;
                            }
                        });
                    };
                });

                // Execute the directory creation functions in sequence.
                return sequence(createFuncs, undefined);
            }
        })
        .then(() => {
            return this;
        });
    }


    /**
     * Creates the directory represented by this instance.  If needed,
     * nonexistent parent directories will also be created.
     * @returns This Directory instance (for chaining)
     */
    public ensureExistsSync(): this {
        if (this.existsSync()) {
            return this;
        }

        const parts = this.split();

        // Create an array of successively longer paths, each one adding a
        // new directory onto the end.
        const dirsToCreate = parts.reduce((acc: Array<string>, curPart: string): Array<string> => {
            if (acc.length === 0) {
                if (curPart.length === 0) {
                    // The first item is an empty string.  The path must
                    // have started with the directory separator character
                    // (an absolute path was specified).
                    acc.push(path.sep);
                }
                else {
                    // The first item contains text.  A relative path must
                    // have been specified.
                    acc.push(curPart);
                }
            }
            else {
                const last = acc[acc.length - 1]!;
                acc.push(path.join(last, curPart));
            }
            return acc;
        }, []);

        // Don't attempt to create the root of the filesystem.
        if ((dirsToCreate.length > 0) && (dirsToCreate[0] === path.sep)) {
            dirsToCreate.shift();
        }

        dirsToCreate.forEach((curDir) => {
            try {
                fs.mkdirSync(curDir);
            }
            catch (err) {
                // If the directory already exists, just keep going.
                if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
                    throw err;
                }
            }
        });

        return this;
    }


    /**
     * Deletes the contents of this directory.  This directory is created if it
     * does not exist.
     * @returns A Promise that resolves with this Directory instance when this
     * operation has finished.
     */
    public empty(): Promise<Directory> {
        return this.delete()
        .then(() => {
            return this.ensureExists();
        });
    }


    /**
     * Deletes the contents of this directory.  This directory is created if it
     * does not exist.
     * @returns This Directory instance (to facilitate chaining)
     */
    public emptySync(): this {
        this.deleteSync();
        return this.ensureExistsSync();
    }


    /**
     * Deletes this directory.  Does nothing if this directory does not exist.
     * @returns A Promise that is resolved when this operation has finished.
     */
    public delete(): Promise<void> {
        return this.exists()
        .then((stats) => {
            if (!stats) {
                // The specified directory does not exist.  Do nothing.
                return;
            }
            else {
                // With retries, the following may take up to 12 seconds.
                return fsp.rm(
                    this._dirPath,
                    { recursive: true, force: true, maxRetries: 15, retryDelay: 100}
                );
            }
        });
    }


    /**
     * Deletes this directory.  Does nothing if this directory does not exist.
     */
    public deleteSync(): void {
        if (!this.existsSync()) {
            // The directory does not exist.  Do nothing.
            return;
        }

        // With retries, the following may take up to 12 seconds.
        fs.rmSync(
            this._dirPath,
            { recursive: true, force: true, maxRetries: 15, retryDelay: 100 }
        );
    }


    /**
     * Determines whether this directory contains the specified file
     * @param file - The file to search for within this directory
     * @param recursiveSearch - Whether to search recursively through
     * subdirectories for the file
     * @returns true if the file was found; false otherwise.
     */
    public contains(file: File, recursiveSearch: boolean): boolean {
        return file.isWithin(this, recursiveSearch);
    }


    /**
     * Reads the contents of this directory.
     * @param recursive - Whether to find subdirectories and files recursively
     * (default is false).
     * @return The contents of the directory, separated into a list of files and
     * a list of subdirectories.  The relative/absolute nature of the returned
     * File and Directory objects will be determined by the relative/absolute
     * nature of this Directory object.
     */
    public contents(recursive = false): Promise<IDirectoryContents> {
        const parentDirPath = this.toString();

        return fsp.readdir(this._dirPath)
        .then((fsEntries) => {
            const fsEntryPaths = fsEntries.map((curEntry) => {
                return path.join(parentDirPath, curEntry);
            });

            const contents: IDirectoryContents = {subdirs: [], files: []};

            return mapAsync(fsEntryPaths, (curPath) => {
                return fsp.lstat(curPath)
                .then((stats) => {
                    if (stats.isFile()) {
                        contents.files.push(new File(curPath));
                    }
                    else if (stats.isDirectory()) {
                        contents.subdirs.push(new Directory(curPath));
                    }
                    // Note: We are ignoring symbolic links here.
                })
                .catch(() => {
                    // We failed to stat the current item.  This is probably a
                    // permissions error.  Pretend like it's not here.
                });
            })
            .then(() => {
                return contents;
            });
        })
        .then((contents: IDirectoryContents) => {
            if (!recursive) {
                return contents;
            }

            // Get the contents of each subdirectory.
            return Promise.all<IDirectoryContents>(_.map(contents.subdirs, (curSubdir) => curSubdir.contents(true)))
            .then((subdirContents: Array<IDirectoryContents>) => {
                // Put the contents of each subdirectory into the returned
                // `contents` object.
                for (const curContents of subdirContents) {
                    contents.subdirs = _.concat(contents.subdirs, curContents.subdirs);
                    contents.files = _.concat(contents.files, curContents.files);
                }

                return contents;
            });
        });
    }


    /**
     * Reads the contents of this directory.
     * @param recursive - Whether to find subdirectories and files recursively
     * @return The contents of the directory, separated into a list of files and a
     * list of subdirectories.  The relative/absolute nature of the returned
     * File and Directory objects will be determined by the relative/absolute
     * nature of this Directory object.
     */
    public contentsSync(recursive = false): IDirectoryContents {
        const parentDirPath = this.toString();

        let fsEntries = fs.readdirSync(this._dirPath);
        fsEntries = fsEntries.map((curFsEntry) => {
            return path.join(parentDirPath, curFsEntry);
        });

        const contents: IDirectoryContents = {subdirs: [], files: []};
        fsEntries.forEach((curFsEntry) => {
            const stats = fs.lstatSync(curFsEntry);
            if (stats.isFile()) {
                contents.files.push(new File(curFsEntry));
            }
            else if (stats.isDirectory()) {
                contents.subdirs.push(new Directory(curFsEntry));
            }
            // Note: We are ignoring symbolic links here.
        });

        if (recursive) {
            contents.subdirs.forEach((curSubdir) => {
                const subdirContents = curSubdir.contentsSync(true);
                contents.subdirs = _.concat(contents.subdirs, subdirContents.subdirs);
                contents.files   = _.concat(contents.files,   subdirContents.files);
            });
        }

        return contents;
    }


    /**
     * Recursively removes empty subdirectories from within this directory.
     * @return A Promise that is resolved when this directory has been pruned.
     */
    public prune(): Promise<void> {
        return this.contents()
        .then((contents) => {
            return mapAsync(contents.subdirs, (curSubdir) => {
                //
                // Prune the current subdirectory.
                //
                return curSubdir.prune()
                .then(() => {
                    //
                    // If the subdirectory is now empty, delete it.
                    //
                    return curSubdir.isEmpty();
                })
                .then((dirIsEmpty) => {
                    if (dirIsEmpty) {
                        return curSubdir.delete();
                    }
                    return undefined;
                });
            })
            .then(() => {
                return;
            });
        });
    }


    /**
     * Recursively removes empty subdirectories from this directory.
     */
    public pruneSync(): void {
        const contents = this.contentsSync();
        contents.subdirs.forEach((curSubdir) => {
            curSubdir.pruneSync();

            //
            // If the subdirectory is now empty, delete it.
            //
            if (curSubdir.isEmptySync()) {
                curSubdir.deleteSync();
            }
        });
    }


    /**
     * Copies this directory to `destDir`.
     * @param destDir - The destination directory
     * @param copyRoot - If true, this directory name will be a subdirectory of
     * `destDir`.  If false, only the contents of this directory will be copied
     * into `destDir`.
     * @return A promise that is resolved with a Directory object representing
     * the destination directory.  If copyRoot is false, this will be `destDir`.
     * If copyRoot is true, this will be this Directory's counterpart
     * subdirectory in `destDir`.
     */
    public copy(destDir: Directory, copyRoot: boolean): Promise<Directory> {
        if (copyRoot) {
            // Copying this directory to the destination with copyRoot true just
            // means creating the counterpart to this directory in the
            // destination and then copying to that directory with copyRoot
            // false.
            const thisDest: Directory = new Directory(destDir, this.dirName);
            return thisDest.ensureExists()
            .then(() => {
                return this.copy(thisDest, false);
            })
            .then(() => {
                return thisDest;
            });
        }

        return this.contents()
        .then((contents: IDirectoryContents) => {
            // Copy the files in this directory to the destination.
            const fileCopyPromises = contents.files.map((curFile) => {
                return curFile.copy(destDir, curFile.fileName);
            });

            const dirCopyPromises = contents.subdirs.map((curSubdir) => {
                return curSubdir.copy(destDir, true);
            });

            return Promise.all(_.concat<Array<Promise<File | Directory>>>(fileCopyPromises, dirCopyPromises));
        })
        .then(() => {
            return destDir;
        });
    }


    /**
     * Copies this directory to `destDir`.
     * @param destDir - The destination directory
     * @param copyRoot - If true, this directory name will be a subdirectory of
     * `destDir`.  If false, only the contents of this directory will be copied
     * into `destDir`.
     */
    public copySync(destDir: Directory, copyRoot: boolean): Directory {
        if (copyRoot) {
            // Copying this directory to the destination with copyRoot true just
            // means creating the counterpart to this directory in the
            // destination and then copying to that directory with copyRoot
            // false.
            const thisDest: Directory = new Directory(destDir, this.dirName);
            thisDest.ensureExistsSync();
            this.copySync(thisDest, false);
            return thisDest;
        }

        const contents = this.contentsSync();

        // Copy the files in this directory to the destination.
        contents.files.forEach((curFile) => {
            curFile.copySync(destDir, curFile.fileName);
        });

        contents.subdirs.forEach((curSubdir) => {
            curSubdir.copySync(destDir, true);
        });

        return destDir;
    }


    /**
     * Copies the selected files and directories to `destDir`.
     * @param destDir
     * @param copyRoot
     */
    public async copyFiltered(
        destDir: Directory,
        copyRoot: boolean,
        includeRegexes: Array<RegExp>,
        excludeRegexes: Array<RegExp>
    ): Promise<Directory> {
        if (copyRoot) {
            const thisDest: Directory = new Directory(destDir, this.dirName);
            await thisDest.ensureExists();
            await this.copyFiltered(thisDest, false, includeRegexes, excludeRegexes);
            return thisDest;
        }

        await this.walk(async (fsItem) => {

            const curItemRelative = fsItem instanceof Directory ?
                Directory.relative(this, fsItem) :
                File.relative(this, fsItem);

            const relativeStr = curItemRelative.toString();
            let shouldRecurse = false;

            if (matchesAny(relativeStr, includeRegexes) &&
                !matchesAny(relativeStr, excludeRegexes)) {
                if (curItemRelative instanceof Directory) {
                    const dstDir = new Directory(destDir, relativeStr);
                    await dstDir.ensureExists();
                    shouldRecurse = true;
                }
                else {
                    const dstFile = new File(destDir, relativeStr);
                    await (fsItem as File).copy(dstFile);
                }
            }

            return shouldRecurse;
        });

        return destDir;
    }


    /**
     * Copies the selected files and directories to `destDir`.
     */
    public async copyFilteredWith(
        destDir: Directory,
        copyRoot: boolean,
        shouldCopyFn: (relFileOrDir: File | Directory) => boolean | Promise<boolean>
    ): Promise<Directory> {
        if (copyRoot) {
            const thisDest: Directory = new Directory(destDir, this.dirName);
            await thisDest.ensureExists();
            await this.copyFilteredWith(thisDest, false, shouldCopyFn);
            return thisDest;
        }

        await this.walk(async (fsItem) => {

            const curItemRelative = fsItem instanceof Directory ?
                Directory.relative(this, fsItem) :
                File.relative(this, fsItem);

            let shouldRecurse = false;

            const shouldCopy = await Promise.resolve(shouldCopyFn(curItemRelative));
            if (shouldCopy) {
                if (curItemRelative instanceof Directory) {
                    const dstDir = new Directory(destDir, curItemRelative.toString());
                    await dstDir.ensureExists();
                    shouldRecurse = true;
                }
                else {
                    const dstFile = new File(destDir, curItemRelative.toString());
                    await (fsItem as File).copy(dstFile);
                }
            }

            return shouldRecurse;
        });

        return destDir;
    }


    /**
     * Moves this Directory or the contents of this Directory to `destDir`.
     * @param destDir - The destination directory
     * @param moveRoot - If true, this directory name will be a subdirectory of
     * `destDir`.  If false, only the contents of this directory will be copied
     * into `destDir`.
     * @return A promise that is resolved with a Directory object representing
     * the destination directory.  If moveRoot is false, this will be `destDir`.
     * If moveRoot is true, this will be this Directory's counterpart
     * subdirectory in `destDir`.
     */
    public move(destDir: Directory, moveRoot: boolean): Promise<Directory> {
        return destDir.ensureExists()
        .then(() => {
            return this.copy(destDir, moveRoot);
        })
        .then((counterpartDestDir) => {
            return this.delete()
            .then(() => {
                return counterpartDestDir;
            });
        });
    }


    /**
     * Walks this Directory in a depth-first manner.
     *
     * @param cb - A callback function that will be called for each subdirectory
     *   and file encountered.  It is invoked with one argument: (item).  When
     *   item is a Directory, the function returns a boolean indicating whether
     *   to recurse into the directory.  When item is a File, the returned value
     *   is ignored.
     * @return A promise that is resolved when the directory tree has been
     *   completely walked.
     */
    public async walk(cb: WalkCallback): Promise<void> {
        const thisDirectoryContents = await this.contents(false);

        // Invoke the callback for all files concurrently.
        const filePromises: Array<Promise<boolean>> = _.map(thisDirectoryContents.files, (curFile: File) => {
            return Promise.resolve(cb(curFile));
        });
        await Promise.all(filePromises);

        // Process each of the subdirectories one at a time.
        for (const curSubDir of thisDirectoryContents.subdirs) {
            const shouldRecurse = await Promise.resolve(cb(curSubDir));
            if (shouldRecurse) {
                await curSubDir.walk(cb);
            }
        }
    }


    /**
     * Filters the contents of this directory.
     *
     * @param cb - A callback function that will be called for each contained
     *   file and subdirectory.  When invoked for a Directory, this callback
     *   returns whether to recurse into the directory.
     * @param includeRootFiles - Whether to include the files in this root
     *   directory
     * @returns A Promise that is resolved with all of the items for which _cb_
     *   returned a truthy _include_ property.
     */
    public async filter(
        cb: FilterCallback,
        includeRootFiles: boolean
    ): Promise<Array<File | Directory>> {
        let selected: Array<File | Directory> = [];
        const thisDirectoryContents = await this.contents(false);

        if (includeRootFiles) {
            // Process the files in this directory.
            await mapAsync(
                thisDirectoryContents.files,
                async (curFile) => {
                    const res = await Promise.resolve(cb(curFile));
                    if (res.include) {
                        selected.push(curFile);
                    }
                }
            );
        }

        await mapAsync(
            thisDirectoryContents.subdirs,
            async (curSubdir) => {
                const res = await Promise.resolve(cb(curSubdir));
                if (res.include) {
                    selected.push(curSubdir);
                }
                if (res.recurse) {
                    const subdirFsItems = await curSubdir.filter(cb, true);
                    selected = selected.concat(subdirFsItems);
                }
            }
        );

        return selected;
    }


    /**
     * Finds files within this Directory whose absolute path matches the
     * specified pattern.
     *
     * @param pattern - The pattern that the Directory's files will be tested
     * with.
     * @return A Promise that resolves with the result array.  The array will be
     * empty if no files were found.
     */
    public async findMatchingFiles(pattern: RegExp, recurse: boolean = false): Promise<Array<File>> {

        function isFileWithMatchingAbsPath(fsItem: Directory | File): IFilterResult {
            if (!(fsItem instanceof File)) {
                return { include: false, recurse };
            }

            const isMatch = pattern.test(fsItem.absPath());
            return { include: isMatch, recurse: false };
        }


        const filesFound = await this.filter(isFileWithMatchingAbsPath, true) as Array<File>;
        return filesFound;
    }


    /**
     * Calculates the size of this Directory.
     *
     * @returns The size of all files (recursively) in this Directory.
     */
    public async getSize(refresh = true): Promise<StorageSize> {
        // Note: Calling fs.stat() on a directory returns a size of 0.
        // Therefore, we must sum the size of files.

        if (refresh || this._cachedSize === undefined) {
            const {files} = await this.contents(true);
            const totalBytes =
                (await Promise.all(files.map((curFile) => curFile.exists())))
                .filter((stat): stat is fs.Stats => stat !== undefined)
                .reduce((acc, stat) => acc + stat.size, 0);
            this._cachedSize = StorageSize.fromBytes(totalBytes);
        }

        return this._cachedSize;
    }


    /**
     * Calculates the size of this Directory.
     *
     * @returns The size of all files (recursively) in this Directory.
     */
    public getSizeSync(): StorageSize {
        const {files} = this.contentsSync(true);
        const totalBytes =
            files
            .map((curFile) => curFile.existsSync())
            .filter((stat): stat is fs.Stats => stat !== undefined)
            .reduce((acc, stat) => acc + stat.size, 0);
        return StorageSize.fromBytes(totalBytes);
    }


    /**
     * Helper method that splits this Directory's path into parts, adjusting
     * for UNC paths.
     *
     * @return The path parts
     */
    private split(): string[] {
        const absPath = this.absPath();
        let parts = absPath.split(path.sep);

        // If the path is a UNC path, there will be 4 or more parts:
        // 1. empty
        // 2. empty
        // 3. server name
        // 4. share name
        // etc.
        if (parts.length >= 4 &&
            parts[0].length === 0 &&
            parts[1].length === 0) {
            // Adjust the parts.  Get rid of the first two empty parts and
            // prefix the new first part with "\\".
            parts = parts.slice(2);
            parts[0] = "\\\\" + parts[0];
        }

        return parts;
    }


}
