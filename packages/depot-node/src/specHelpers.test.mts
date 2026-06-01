import * as url from "node:url";
import { generateUuid, UuidFormat } from "@repo/depot/uuid";
import { Url } from "@repo/depot/url";
import { Directory } from "./directory.mjs";
import { GitRepo } from "./gitRepo.mjs";


const __dirname = url.fileURLToPath(new URL(".", import.meta.url));


export const sampleRepoUrl = "https://github.com/kwpeters/sampleGitRepo-src.git";
export const sampleRepoDir = new Directory(__dirname, "..", "..", "..", "..", "..", "sampleGitRepo-src");
export const tmpDir = new Directory("tmp");
export const floydHomeDir = new Directory("\\\\floyd\\home");


/**
 * Creates a uniquely named temporary directory inside `tmpDir`.  Each test
 * that needs its own working directory should call this rather than using
 * `tmpDir` directly.  This prevents interference between tests when git
 * processes on Windows hold file handles after the spawned process exits.
 * @return A new, empty Directory with a UUID-based name inside `tmpDir`.
 */
export function getUniqueTmpDir(): Directory {
    const uniqueDir = new Directory(tmpDir, generateUuid(UuidFormat.N));
    uniqueDir.ensureExistsSync();
    return uniqueDir;
}


/**
 * Determines whether the shared `floyd` UNC path is currently available.
 * @return true when the share is reachable; false otherwise.
 */
export function isFloydAvailable(): boolean {
    return floydHomeDir.existsSync() !== undefined;
}


/**
 * Marks the current spec pending when the shared `floyd` UNC path is not
 * reachable.
 * @return true when the caller should exit early; false otherwise.
 */
export function exitEarlyIfFloydUnavailable(): boolean {
    if (isFloydAvailable()) {
        return false;
    }

    pending(`Skipping test because "${floydHomeDir.toString()}" is unavailable.`);
    return true;
}


/**
 * Clones a git repo with retry logic to handle intermittent failures on
 * Windows caused by file handle contention on the source repo's pack files.
 * @param src - The source URL or directory to clone from.
 * @param parentDir - The parent directory to clone into.
 * @param dirName - Optional directory name for the clone.
 * @param bare - Whether to create a bare clone.
 * @param maxAttempts - Maximum number of clone attempts.
 * @return The cloned GitRepo.
 */
export async function cloneWithRetry(
    src: Url | Directory,
    parentDir: Directory,
    dirName?: string,
    bare: boolean = false,
    maxAttempts: number = 3
): Promise<GitRepo> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await GitRepo.clone(src, parentDir, dirName, bare);
        }
        catch (err) {
            lastError = err;
            if (attempt < maxAttempts) {
                // Wait before retrying to allow file handles to be released.
                await new Promise<void>((resolve) => {
                    setTimeout(resolve, 1000 * attempt);
                });
            }
        }
    }
    throw lastError;
}
