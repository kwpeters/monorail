import { FailedResult, type Result, SucceededResult } from "@repo/depot/result";
import {
    buildPermalinkUrl,
    gitHostKind,
    remoteUrlToWebInfo,
    type GitItemKind,
    type ILineRange
} from "@repo/depot/gitPermalink";
import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";
import { spawn, spawnErrorToString, type SpawnError } from "./spawn2.mjs";


export interface IMakeGitPermalinkOptions {
    /**
     * Whether to run `git fetch origin` once when the current commit is not on
     * any `origin` branch, before reporting that it is not pushed.  Defaults to
     * true.
     */
    fetchOrigin?: boolean;

    /**
     * The lines of a file to link to.  A file with no lines is linked as a
     * whole, and a directory is always linked as a whole.
     */
    lines?: ILineRange;
}


/**
 * Runs `git` in a directory, never prompting on the terminal and never
 * rejecting.
 *
 * @param dir - The directory to run `git` in (`git -C <dir>`)
 * @param args - The `git` arguments
 * @returns A promise for the result of the command: its trimmed stdout, or the
 * spawn error
 */
function git(dir: Directory, args: Array<string>): Promise<Result<string, SpawnError>> {
    return spawn(
        "git",
        ["-C", dir.absPath(), "--literal-pathspecs", ...args],
        {
            stdio: ["ignore", "pipe", "pipe"],
            env:   { ...process.env, GIT_TERMINAL_PROMPT: "0" }
        }
    ).closePromise;
}


/**
 * Makes a permalink (a GitHub or GitLab URL pinned to the current commit) to a
 * file or directory in a local Git repository.  The link has no line anchor.
 * Follows the logic of the `make-permalinks` skill, except that it never asks
 * questions: every case that skill asks about is reported as a problem.
 *
 * @param item - The file or directory to link to
 * @param options - Options
 * @returns A promise that always resolves.  It resolves with a succeeded result
 * holding the permalink, or with a failed result holding a description of each
 * problem found (not in a repo, untracked, no `origin`, unsupported host,
 * unpushed commit, uncommitted changes).
 */
export async function makeGitPermalink(
    item:     File | Directory,
    options?: IMakeGitPermalinkOptions
): Promise<Result<string, Array<string>>> {
    const fetchOrigin = options?.fetchOrigin ?? true;
    const kind: GitItemKind = item instanceof File ? "file" : "directory";
    const dir = item instanceof File ? item.directory : item;
    const itemPathArg = item instanceof File ? item.fileName : ".";
    const problems: Array<string> = [];

    if (!await dir.exists()) {
        return new FailedResult([`${dir.absPath()} does not exist.`]);
    }

    const toplevelRes = await git(dir, ["rev-parse", "--show-toplevel"]);
    if (!toplevelRes.succeeded) {
        return new FailedResult([
            toplevelRes.error.type === "ISpawnSystemError" ?
            `Could not run git: ${spawnErrorToString(toplevelRes.error)}` :
            `${item.absPath()} is not in a Git repository.`
        ]);
    }

    // The item's path in the repository, and whether Git tracks it.
    let repoPath: string;
    let isTracked: boolean;
    if (kind === "file") {
        const res = await git(dir, ["ls-files", "--full-name", "--", itemPathArg]);
        repoPath = res.succeeded ? res.value.split(/\r?\n/u)[0]!.trim() : "";
        isTracked = repoPath !== "";
    }
    else {
        const prefixRes = await git(dir, ["rev-parse", "--show-prefix"]);
        repoPath = prefixRes.succeeded ? prefixRes.value.replace(/\/+$/u, "") : "";
        const trackedRes = await git(dir, ["ls-files", "--", "."]);
        isTracked = trackedRes.succeeded && trackedRes.value !== "";
    }
    if (!isTracked) {
        problems.push(
            kind === "file" ?
            `${item.absPath()} is not tracked by Git.` :
            `${item.absPath()} contains no files tracked by Git.`
        );
    }

    // The remote.
    let permalinkParts: { webAddress: string; host: "github" | "gitlab" } | undefined;
    const remoteRes = await git(dir, ["remote", "get-url", "origin"]);
    if (!remoteRes.succeeded) {
        problems.push("The repository has no remote named origin.");
    }
    else {
        const webInfoRes = remoteUrlToWebInfo(remoteRes.value);
        if (!webInfoRes.succeeded) {
            problems.push(webInfoRes.error);
        }
        else {
            const hostRes = gitHostKind(webInfoRes.value.host);
            if (!hostRes.succeeded) {
                problems.push(hostRes.error);
            }
            else {
                permalinkParts = { webAddress: webInfoRes.value.webAddress, host: hostRes.value };
            }
        }
    }

    // The commit, and whether it has been pushed.
    const hashRes = await git(dir, ["rev-parse", "HEAD"]);
    if (!hashRes.succeeded) {
        problems.push("The repository has no current commit.");
    }
    else if (remoteRes.succeeded) {
        const hash = hashRes.value;
        const containing = (): Promise<Result<string, SpawnError>> => {
            return git(dir, ["branch", "-r", "--list", "origin/*", "--contains", hash]);
        };

        let containingRes = await containing();
        if ((!containingRes.succeeded || containingRes.value === "") && fetchOrigin) {
            await git(dir, ["fetch", "origin"]);
            containingRes = await containing();
        }
        if (!containingRes.succeeded || containingRes.value === "") {
            problems.push(
                `The current commit ${hash.slice(0, 7)} is not on any origin branch, so the permalink would not resolve.  Push it first.`
            );
        }
    }

    // Uncommitted changes to the item.
    if (isTracked) {
        const statusRes = await git(dir, ["status", "--porcelain", "--", itemPathArg]);
        if (statusRes.succeeded && statusRes.value !== "") {
            problems.push(
                `${item.absPath()} has uncommitted changes, so the permalink would not show your local version.`
            );
        }
    }

    if (problems.length > 0 || !permalinkParts || !hashRes.succeeded) {
        return new FailedResult(problems);
    }

    return new SucceededResult(
        buildPermalinkUrl(permalinkParts.webAddress, permalinkParts.host, hashRes.value, repoPath, kind, options?.lines)
    );
}
