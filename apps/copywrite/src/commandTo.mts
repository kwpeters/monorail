import { type Argv, type Arguments } from "yargs";
import { splitLinesOsIndependent } from "@repo/depot/stringHelpers";
import { assertNever } from "@repo/depot/never";
import { PromiseResult } from "@repo/depot/promiseResult";
import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { type PathPart } from "@repo/depot-node/pathHelpers";
import { Directory } from "@repo/depot-node/directory";
import { FsPath } from "@repo/depot-node/fsPath";
import { File } from "@repo/depot-node/file";
import { readableStreamToText } from "@repo/depot-node/streamHelpers";
import { type FsItem, fsPathToFsItem } from "@repo/depot-node/fsItem";
import { Symlink } from "@repo/depot-node/symlink";


export const command = "to <destDir>";
export const describe = "Copies files specified in stdin to a destination directory.";
export function builder(argv: Argv): Argv {
    return argv
    .option(
        "srcRoot",
        {
            demandOption: false,
            type:         "string",
            default:      ".",
            describe:     "The directory the input items will be relative to. The source directory structure will be maintained."
        }
    )
    .option(
        "verbose",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "Prints verbose information about copy operations"
        }
    )
    .option(
        "dryRun",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "Prints operations that will be done without actually performing them"
        }
    )
    .option(
        "emptyDestDir",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "Empties destDir before copying files into it."
        }
    )
    .positional("destDir", {
        describe: "The destination directory",
        type:     "string"
    })
    .check(
        (args: Arguments) => {

            const configRes = getConfiguration(args);
            if (configRes.failed) {
                throw new Error(configRes.error);
            }

            // If we got this far, everything is valid.
            return true;
        },
        false
    );
}


export async function handler(args: Arguments): Promise<void> {

    const res = await main(args);
    if (res.failed) {
        console.error(res.error);
    }
}


interface IConfig {
    srcRoot:      Directory,
    verbose:      boolean,
    dryRun:       boolean,
    emptyDestDir: boolean,
    destDir:      Directory
}


function getConfiguration(args: Arguments): Result<IConfig, string> {


    const destDir = new Directory(args.destDir as PathPart);
    if (!destDir.existsSync()) {
        return new FailedResult(`The destination directory "${destDir.toString()}" does not exist.`);
    }

    const srcRoot = new Directory(args.srcRoot as PathPart);
    if (!srcRoot.existsSync()) {
        return new FailedResult(`The srcRoot directory "${srcRoot.toString()}" does not exist.`);
    }

    return new SucceededResult({
        srcRoot,
        verbose:      args.verbose as boolean,
        dryRun:       args.dryRun as boolean,
        emptyDestDir: args.emptyDestDir as boolean,
        destDir
    });
}


async function main(
    args: Arguments
): Promise<Result<void, string>> {

    // Get the configuration for this app.
    const configRes = getConfiguration(args);
    if (configRes.failed) {
        return configRes;
    }

    // Read all lines in from stdin. Each line is the path to a filesystem item
    // (relative to config.srcRoot) to be copied.
    const linesRes = await getStdinLines(process.stdin);
    if (linesRes.failed) {
        return linesRes;
    }

    const copyRes = await copyTo(configRes.value, linesRes.value);
    if (copyRes.failed) {
        return copyRes;
    }

    return new SucceededResult(undefined);
}

export async function copyTo(config: IConfig, pathStrs: Array<string>): Promise<Result<Array<FsItem>, string>> {

    // Convert each line of input into an operation that needs to be performed
    // when copying.
    const createOpsRes = await PromiseResult.allArrayM(
        pathStrs.map(async (line) => createOp(config.srcRoot, line, config.destDir))
    );
    if (createOpsRes.failed) {
        return new FailedResult(createOpsRes.error.item);
    }

    // If needed, print a description of the operations.
    if (config.verbose || config.dryRun) {
        createOpsRes.value.forEach((op) => console.log(op.toString()));
        console.log(`${createOpsRes.value.length} operations.`);
    }

    // If --dryRun just print a message stating that operations are being skipped.
    // Otherwise, execute the operations.
    if (config.dryRun) {
        console.log(`Skipping operations due to --dryRun.`);
        return new SucceededResult([]);
    }
    else {

        if (config.emptyDestDir) {
            await config.destDir.empty();
            console.log(`Destination directory "${config.destDir.toString()}" emptied.`);
        }

        const opsRes = await PromiseResult.allArrayM<File | Symlink | Directory, string>(
            createOpsRes.value.map((op) => op.execute())
        );

        if (opsRes.succeeded) {
            console.log(`Completed ${opsRes.value.length} operations.`);
            return opsRes;
        }
        else {
            return new FailedResult(opsRes.error.item);
        }
    }
}


async function getStdinLines(readStream: NodeJS.ReadStream): Promise<Result<Array<string>, string>> {
    const text = await readableStreamToText(readStream);
    const lines =
        splitLinesOsIndependent(text)
        .filter((curLine) => curLine.trim().length > 0);

    return new SucceededResult(lines);
}


async function createOp(
    srcRootDir: Directory,
    relPath: string,
    destRootDir: Directory
): Promise<Result<Operation, string>> {
    const fsItemRes = await fsPathToFsItem(new FsPath(srcRootDir, relPath));
    if (fsItemRes.failed) {
        return fsItemRes;
    }

    const fsItem = fsItemRes.value;
    if (fsItem instanceof File) {
        return new SucceededResult(new FileCopyOp(srcRootDir, new FsPath(relPath), destRootDir));
    }
    else if (fsItem instanceof Symlink) {
        return new SucceededResult(new SymlinkCopyOp(srcRootDir, new FsPath(relPath), destRootDir));
    }
    else if (fsItem instanceof Directory) {
        return new SucceededResult(new DirectoryExistsOp(srcRootDir, new FsPath(relPath), destRootDir));
    }
    else {
        assertNever(fsItem);
    }
}

/**
 * An operation that will copy a File.
 */
class FileCopyOp {
    public constructor(
        private readonly _srcRootDir: Directory,
        private readonly _relSrcPath: FsPath,
        private readonly _destRootDir: Directory
    ) {
    }

    public get srcFile(): File {
        return new File(this._srcRootDir, this._relSrcPath.toString());
    }

    public get destFile(): File {
        return new File(this._destRootDir, this._relSrcPath.toString());
    }

    public toString(): string {
        return `${this.srcFile.toString()} → ${this.destFile.toString()}`;
    }

    public execute(): Promise<Result<File, string>> {
        const promise = this.srcFile.copy(this.destFile);
        return PromiseResult.fromPromise(promise);
    }
}

/**
 * An operation that will copy a Symlink.
 */
class SymlinkCopyOp {
    public constructor(
        private readonly _srcRootDir: Directory,
        private readonly _relSrcPath: FsPath,
        private readonly _destRootDir: Directory
    ) {
    }

    public get srcSymlink(): Symlink {
        return new Symlink(this._srcRootDir, this._relSrcPath.toString());
    }

    public get destSymlink(): Symlink {
        return new Symlink(this._destRootDir, this._relSrcPath.toString());
    }

    public toString(): string {
        return `${this.srcSymlink.toString()} → ${this.destSymlink.toString()}`;
    }

    public execute(): Promise<Result<Symlink, string>> {
        return this.srcSymlink.copy(this.destSymlink);
    }
}

/**
 * An operation that will make sure a destination Directory exists.
 */
class DirectoryExistsOp {
    public constructor(
        private readonly _srcRootDir: Directory,
        private readonly _relPath: FsPath,
        private readonly _destRootDir: Directory
    ) {
    }

    public get srcDir(): Directory {
        return new Directory(this._srcRootDir, this._relPath.toString());
    }

    public get destDir(): Directory {
        return new Directory(this._destRootDir, this._relPath.toString());
    }

    public toString(): string {
        return `${this.srcDir.toString()} → ${this.destDir.toString()}`;
    }

    public execute(): Promise<Result<Directory, string>> {
        const promise = this.destDir.ensureExists();
        return PromiseResult.fromPromise(promise);
    }

}

type Operation = FileCopyOp | SymlinkCopyOp | DirectoryExistsOp;
