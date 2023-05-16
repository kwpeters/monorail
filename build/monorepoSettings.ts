import * as url from "url";
import { Result, SucceededResult, FailedResult } from "../packages/depot/src/result.js";
import { Directory } from "../packages/depot-node/src/directory.js";
import { resolveDirectoryLocation } from "../packages/depot-node/src/filesystemHelpers.js";


const thisDir = new Directory(url.fileURLToPath(new URL(".", import.meta.url)));


export async function getRepoDir(): Promise<Result<Directory, string>> {
    const gitDirRes = await resolveDirectoryLocation(".git", thisDir);
    if (gitDirRes.failed) {
        return gitDirRes;
    }

    const repoDir = gitDirRes.value.parentDir();
    if (repoDir === undefined) {
        return new FailedResult(`Failed to find the root directory of this Git repository.`);
    }

    return new SucceededResult(repoDir);
}


export async function getOutDir(repoDir: Directory): Promise<Result<Directory, string>> {
    const outDir = new Directory(repoDir, "out");
    const outDirExists = await outDir.exists();
    return outDirExists ?
        new SucceededResult(outDir) :
        new FailedResult(`Output directory ${outDir.toString()} does not exist.`);
}


export async function getSnapshotDir(repoDir: Directory): Promise<Result<Directory, string>> {
    const snapshotDir = new Directory(repoDir, "snapshot");
    await snapshotDir.ensureExists();
    return new SucceededResult(snapshotDir);
}


/**
 * Creates a .bin directory within the specified output directory (typically,
 * the output directory or the snapshot directory).
 *
 * @param parentDir - The directory that will contain the .bin directory
 * @return A successful Result containing the .bin directory
 */
export async function getBinDir(parentDir: Directory): Promise<Result<Directory, string>> {
    const binDir = new Directory(parentDir, ".bin");
    await binDir.ensureExists();
    return new SucceededResult(binDir);
}
