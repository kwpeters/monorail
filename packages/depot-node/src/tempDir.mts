import * as os from "node:os";
import { generateUuid, UuidFormat } from "@repo/depot/uuid";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";


/**
 * The name of the directory (within the OS temp directory) under which all
 * temp directories created by this module are placed.
 */
const rootDirName = "depot-node-tempdir";

/**
 * The minimum amount of time that must elapse between cleanup sweeps.
 */
const cleanupIntervalMs = 60 * 60 * 1000; // 1 hour

/**
 * The name of the file (within a container directory) that records a temp
 * directory's metadata (e.g. its expiration timestamp).
 */
const propsFileName = "props.json";

/**
 * The number of characters (from a dashless UUID) used to disambiguate
 * container directories that share the same requested name.
 */
const shortIdLength = 10;

/**
 * The name of the file (within the root directory) that records when the
 * last cleanup sweep occurred.
 */
const lastCleanupFileName = "last-cleanup.json";


interface ITempDirProps {
    expiresAtMs: number;
}


interface ILastCleanupData {
    lastCleanupMs: number;
}


/**
 * Gets the (shared) root directory under which all temp directories created
 * by this module are placed, creating it if needed.
 *
 * @returns The root directory
 */
async function getRootDir(): Promise<Directory> {
    const rootDir = new Directory(os.tmpdir(), rootDirName);
    await rootDir.ensureExists();
    return rootDir;
}


/**
 * Gets the file that stores _containerDir_'s metadata.
 *
 * @param containerDir - The container directory whose props file is wanted
 * @returns The props file
 */
function getPropsFile(containerDir: Directory): File {
    return new File(containerDir, propsFileName);
}


/**
 * Performs a sweep of _rootDir_, deleting temp directories whose recorded
 * expiration has passed.  Failures to delete an individual entry are ignored
 * so that the sweep can continue processing the remaining entries.
 *
 * @param rootDir - The root directory to sweep
 * @returns A Promise that resolves when the sweep has finished
 */
async function performCleanup(rootDir: Directory): Promise<void> {
    const contents = await rootDir.contents(false);
    const nowMs = Date.now();

    await Promise.all(contents.subdirs.map(async (containerDir) => {
        const propsFile = getPropsFile(containerDir);

        try {
            const data = await propsFile.readJson<ITempDirProps>();
            if (data.expiresAtMs <= nowMs) {
                await containerDir.delete();
            }
        }
        catch {
            // Ignore errors for this entry (corrupt/unreadable props file,
            // directory already removed, etc.) and continue sweeping the
            // remaining entries.
        }
    }));
}


/**
 * Checks how long it has been since the last cleanup sweep and, if more than
 * _cleanupIntervalMs_ has elapsed, performs a new sweep and records the new
 * cleanup timestamp.
 *
 * @param rootDir - The root directory to maybe clean up
 * @returns A Promise that resolves when this check (and any resulting sweep)
 * has finished
 */
async function maybeCleanup(rootDir: Directory): Promise<void> {
    const lastCleanupFile = new File(rootDir, lastCleanupFileName);
    const nowMs = Date.now();

    let lastCleanupMs = 0;
    try {
        const data = await lastCleanupFile.readJson<ILastCleanupData>();
        lastCleanupMs = data.lastCleanupMs;
    }
    catch {
        // The file does not exist or is corrupt.  Treat this as though a
        // cleanup has never been performed.
    }

    if (nowMs - lastCleanupMs > cleanupIntervalMs) {
        await performCleanup(rootDir);
        await lastCleanupFile.writeJson({lastCleanupMs: nowMs} satisfies ILastCleanupData);
    }
}


/**
 * Creates a new temporary directory inside the operating system's temp
 * directory.  Before creating the directory, this function checks whether
 * enough time has elapsed since the last cleanup sweep and, if so, deletes
 * any previously created temp directories that have expired.
 *
 * @param name - The name the returned directory should have.  Because each
 * call nests this directory inside a uniquely named container, this name
 * need not be unique across calls.
 * @param lifetimeMs - The number of milliseconds the temp directory should be
 * allowed to live before it becomes eligible for cleanup
 * @returns A successful Result containing the new temp Directory, or a failed
 * Result containing an error message
 */
export async function createTempDir(
    name:       string,
    lifetimeMs: number
): Promise<Result<Directory, string>> {
    if (lifetimeMs <= 0) {
        return new FailedResult(`lifetimeMs must be greater than 0 (got ${lifetimeMs}).`);
    }

    const rootDir = await getRootDir();
    await maybeCleanup(rootDir);

    // The container directory keeps the requested name (for easy inspection)
    // plus a short id that disambiguates requests that reuse the same name,
    // while the nested directory has the exact name requested.
    const shortId = generateUuid(UuidFormat.N).slice(0, shortIdLength);
    const containerDirName = `${name}-${shortId}`;
    const containerDir = new Directory(rootDir, containerDirName);
    const tempDir = new Directory(containerDir, name);
    await tempDir.ensureExists();

    const propsFile = getPropsFile(containerDir);
    await propsFile.writeJson({expiresAtMs: Date.now() + lifetimeMs} satisfies ITempDirProps);

    return new SucceededResult(tempDir);
}
