import * as fs from "fs";
import * as cp from "child_process";
import * as compressing from "compressing";
import { Result, SucceededResult } from "../../depot/src/result.js";
import { mapAsync } from "../../depot/src/promiseHelpers.js";
import { PromiseResult } from "../../depot/src/promiseResult.js";
import {Directory} from "./directory.js";
import {File} from "./file.js";
import {spawn} from "./spawn.js";
import {gitUrlToProjectName} from "./gitHelpers.js";
import {getOs, OperatingSystem} from "./os.js";
import { addShebang, makeFileExecutable } from "./nodeUtil.js";


export interface IPackageJson {
    name: string;
    version: string;
    description: string;
    main: string;
    repository: {type: string, url: string} | undefined;
    devDependencies: {[packageName: string]: string};
    dependencies: {[packageName: string]: string};
    bin: { [binName: string]: string; };
}


export class NodePackage {

    public static async find(dir: Directory): Promise<Result<Array<NodePackage>, string>> {

        // TODO: Write unit tests for this method.

        const packageJsonFiles = await dir.filter((fsItem) => {
            return {
                recurse: true,
                include: (fsItem instanceof File) && (fsItem.fileName === "package.json")
            };
        }) as Array<File>;

        const packagesPromise = mapAsync(
            packageJsonFiles,
            (curPkgJson) => NodePackage.fromDirectory(curPkgJson.directory)
        );

        return PromiseResult.fromPromise(packagesPromise);
    }

    /**
     * Creates a NodePackage representing the package in the specified directory.
     * @param pkgDir - The directory containing the Node.js package
     * @return A promise for the resulting NodePackage.  This promise will be
     * rejected if the specified directory does not exist or does not contain a
     * package.json file.
     */
    public static fromDirectory(pkgDir: Directory): Promise<NodePackage> {

        // TODO: Refactor this method to return a Promise<Result>>.

        // Make sure the directory exists.
        return pkgDir.exists()
        .then((stats: fs.Stats | undefined) => {
            if (!stats) {
                throw new Error(`Directory ${pkgDir.toString()} does not exist.`);
            }

            // Make sure the package has a package.json file in it.
            const packageJson = new File(pkgDir, "package.json");
            return packageJson.exists();
        })
        .then((stats) => {
            if (!stats) {
                throw new Error(`Directory ${pkgDir.toString()} does not contain a package.json file.`);
            }

            return new NodePackage(pkgDir);
        });

    }


    // region Data members
    private readonly _pkgDir: Directory;
    private _config: undefined | IPackageJson;
    // endregion


    /**
     * Constructs a new NodePackage.  This constructor is private and should not
     * be called by clients.  Instead, use one of the static methods to create
     * instances.
     *
     * @classdesc A class that represents a Node.js package.
     *
     * @param pkgDir - The directory containing the Node.js package
     */
    private constructor(pkgDir: Directory) {
        this._pkgDir = pkgDir.absolute();
    }


    public get directory(): Directory {
        return this._pkgDir;
    }


    public get config(): IPackageJson {
        // If the package.json file has not been read yet, read it now.
        if (this._config === undefined) {
            this._config = new File(this._pkgDir, "package.json").readJsonSync<IPackageJson>();
        }

        return this._config;
    }


    // TODO: Write unit tests for the following method.
    public get projectName(): string {
        return this.config?.repository?.url ?
            gitUrlToProjectName(this.config?.repository.url) :
            this.config.name;
    }


    /**
     * Gets a map of bin files for this package.  The key is the the bin name
     * and the value is the path to the file.
     */
    public get bin(): ReadonlyMap<string, string> {
        const bins =  this.config.bin === undefined ?
            new Map<string, string>() :
            new Map<string, string>(Object.entries(this.config.bin));

        return bins;
    }


    /**
     * Gets a map of bin files for this package.  The key is the bin name
     * and the value is a File instance.
     */
    public get binFiles(): ReadonlyMap<string, File> {
        if (this.config?.bin === undefined) {
            return new Map<string, File>();
        }

        const entries =
            Object.entries(this.config.bin)
            .map(([name, path]) => [name, new File(this._pkgDir, path)] as const);
        return new Map<string, File>(entries);
    }


    /**
     * Performs operations to make scripts executable:
     *     - Prepends a shebang line
     *     - Sets executable mode bits
     *
     * @return A map of all files that were made executable.  The keys are a
     * string name, and the values are the File instances.
     */
    public async makeBinsExecutable(): Promise<Result<ReadonlyMap<string, File>, string>> {

        // TODO: Write unit tests for this method.
        await mapAsync(
            Array.from(this.binFiles.entries()),
            async ([binName, binScript]) => {
                // Prepend a shebang line to the script.
                const shebangRes = await addShebang(binScript);
                if (shebangRes.failed) {
                    return shebangRes;
                }

                // Set the access mode of the script.
                const modeRes = await makeFileExecutable(binScript);
                if (modeRes.failed) {
                    return modeRes;
                }

                return undefined;
            }
        );

        // Return to the caller a map of all the bin files that were made
        // executable.
        return new SucceededResult(this.binFiles);
    }


    /**
     * Packs this Node package into a .tgz file using "npm pack"
     *
     * @param outDir - The output directory where to place the output file.  If
     * not specified, the output will be placed in the package's folder.
     * @return A File object representing the output .tgz file
     */
    public pack(outDir?: Directory): Promise<File> {
        const spawnOptions: cp.SpawnOptions = { cwd: this._pkgDir.toString() };
        if (getOs() === OperatingSystem.Windows) {
            // On Windows child_process.spawn() can only run executables, not
            // scripts.  Since npm is a script on windows, we need to set the
            // shell option so that we are not directly running the script, but
            // rather a shell, which is then running the script.  For more
            // information, see:
            // https://github.com/nodejs/node-v0.x-archive/issues/2318
            spawnOptions.shell = true;
        }

        return spawn("npm", ["pack"], spawnOptions)
        .closePromise
        .then((stdout: string) => {
            return new File(this._pkgDir, stdout);
        })
        .then((tgzFile: File) => {
            if (outDir) {
                return tgzFile.move(outDir);
            }
            else {
                return tgzFile;
            }
        });
    }


    /**
     * Publishes this Node.js package to the specified directory.
     * @param publishDir - The directory that will contain the published version
     * of this package
     * @param emptyPublishDir - A flag indicating whether publishDir should be
     * emptied before publishing to it.  If publishing to a regular directory,
     * you probably want to pass true so that any old files are removed.  If
     * publishing to a Git repo directory, you probably want false because you
     * have already removed the files under version control and want the .git
     * directory to remain.
     * @param tmpDir - A temporary directory that can be used when packing and
     * unpacking the package.
     * @return A promise for publishDir
     */
    public publish(publishDir: Directory, emptyPublishDir: boolean, tmpDir: Directory): Promise<Directory> {
        let packageBaseName: string;
        let unpackedDir: Directory;
        let unpackedPackageDir: Directory;

        // Since we will be executing commands from different directories, make
        // the directories absolute so things don't get confusing.
        publishDir = publishDir.absolute();
        tmpDir = tmpDir.absolute();

        if (publishDir.equals(tmpDir)) {
            return Promise.reject("When publishing, publishDir cannot be the same as tmpDir");
        }

        return this.pack(tmpDir)
        .then((tgzFile: File) => {
            packageBaseName = tgzFile.baseName;

            unpackedDir = new Directory(tmpDir, packageBaseName);
            // Emptying the directory will create it if it does not exist.
            return unpackedDir.empty()
            .then(() => {
                // Use the "compressing" package to extract the .tgz file.
                return compressing.tgz.uncompress(tgzFile.absPath(), unpackedDir.absPath());
            });
        })
        .then(() => {
            // When uncompressed, all content is contained within a "package"
            // directory.
            unpackedPackageDir = new Directory(unpackedDir, "package");
            return unpackedPackageDir.exists();
        })
        .then((stats) => {
            if (!stats) {
                throw new Error("Uncompressed package does not have a 'package' directory as expected.");
            }

            if (emptyPublishDir) {
                // The caller wants us to empty the publish directory before
                // publishing to it.  Do it now.
                return publishDir.empty()
                .then(() => {
                    return undefined; // To make resolve type undefined in all cases
                });
            }

            return undefined;
        })
        .then(() => {
            return unpackedPackageDir.copy(publishDir, false);
        })
        .then(() => {
            return publishDir;
        });
    }


}
