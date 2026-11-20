import { FailedResult, type Result, SucceededResult } from "./result.mjs";


export type GitHost = "github" | "gitlab";
export type GitItemKind = "file" | "directory";


/**
 * A range of lines in a file.  Line numbers are 1-based, and `start` is not
 * greater than `end`.  A single line has `start` equal to `end`.
 */
export interface ILineRange {
    start: number;
    end:   number;
}


/**
 * Extensions of files that GitHub and GitLab show rendered, where line anchors
 * do nothing.  Compared case-insensitively.
 */
export const renderedFileExtensions: ReadonlyArray<string> = [".md", ".rst", ".adoc"];


/**
 * The parts of a Git remote URL that a permalink needs.
 */
export interface IRemoteWebInfo {
    /** The web host name, e.g. `github.com`. */
    host:       string;
    /** The project's web address, e.g. `https://github.com/acme/tools`.  No token, user or `.git`. */
    webAddress: string;
}


/**
 * Converts a Git remote URL into the web address of its project.  Handles the
 * SCP-like SSH form (`git@host:path.git`), `ssh://` URLs and `http(s)://`
 * URLs.  Users, tokens, ports on SSH forms and a trailing `.git` or `/` are
 * dropped.  The port of an HTTP(S) URL is kept.  Tokens are never included in
 * the result.
 *
 * @param remoteUrl - The remote URL, such as from `git remote get-url origin`
 * @returns A succeeded result with the host and web address, or a failed result
 * with a description of the problem when the URL is not understood or its SSH
 * host has no dot in its name (an SSH config alias, not a web host).
 */
export function remoteUrlToWebInfo(remoteUrl: string): Result<IRemoteWebInfo, string> {
    const trimmed = remoteUrl.trim();
    let host: string;
    let hostWithPort: string;
    let projectPath: string;
    let isSsh: boolean;

    const schemeMatch = /^(?<scheme>[a-z][a-z0-9+.-]*):\/\//iu.exec(trimmed);
    if (schemeMatch) {
        const scheme = schemeMatch.groups!.scheme!.toLowerCase();
        if (scheme !== "ssh" && scheme !== "http" && scheme !== "https") {
            return new FailedResult(`The remote URL scheme "${scheme}" is not supported.`);
        }

        let url: URL;
        try {
            url = new URL(trimmed);
        }
        catch {
            return new FailedResult("The remote URL could not be understood.");
        }

        isSsh = scheme === "ssh";
        host = url.hostname;
        hostWithPort = isSsh ? url.hostname : url.host;
        projectPath = decodeURIComponent(url.pathname);
    }
    else {
        // The SCP-like form: [user@]host:path
        const scpMatch = /^(?:[^@/\s]+@)?(?<host>[^:/\s]+):(?<path>.+)$/u.exec(trimmed);
        if (!scpMatch) {
            return new FailedResult("The remote URL could not be understood.");
        }
        isSsh = true;
        host = scpMatch.groups!.host!;
        hostWithPort = host;
        projectPath = scpMatch.groups!.path!;
    }

    if (isSsh && !host.includes(".")) {
        return new FailedResult(
            `The SSH host "${host}" has no dot in its name, so it is probably an SSH config alias, not a web host.`
        );
    }

    projectPath = projectPath
    .replace(/^\/+/u, "")
    .replace(/\/+$/u, "")
    .replace(/\.git$/u, "")
    .replace(/\/+$/u, "");
    if (projectPath === "") {
        return new FailedResult("The remote URL has no project path.");
    }

    return new SucceededResult({ host, webAddress: `https://${hostWithPort}/${projectPath}` });
}


/**
 * Decides whether a web host is GitHub or GitLab from its name.
 *
 * @param host - The host name
 * @returns A succeeded result with the host kind, or a failed result when the
 * host is neither.
 */
export function gitHostKind(host: string): Result<GitHost, string> {
    const lower = host.toLowerCase();
    if (lower.includes("github")) {
        return new SucceededResult("github");
    }
    if (lower.includes("gitlab")) {
        return new SucceededResult("gitlab");
    }
    return new FailedResult(`The remote host "${host}" is neither GitHub nor GitLab.`);
}


/**
 * Builds a permalink to a file or directory at a commit.
 *
 * @param webAddress - The project's web address, such as from
 * {@link remoteUrlToWebInfo}
 * @param host - Whether the host is GitHub or GitLab
 * @param hash - The full commit hash
 * @param repoPath - The item's path from the repository root, with forward
 * slashes.  Empty for the repository root directory.
 * @param kind - Whether the item is a file or a directory
 * @param lines - The lines to link to.  Ignored for a directory.  A file with
 * no lines is linked as a whole.
 * @returns The permalink, with each path segment percent-encoded.  A file with
 * lines gets a line anchor, preceded by `?plain=1` when the file is of a type
 * that the host renders.
 */
export function buildPermalinkUrl(
    webAddress: string,
    host:       GitHost,
    hash:       string,
    repoPath:   string,
    kind:       GitItemKind,
    lines?:     ILineRange
): string {
    const view = kind === "file" ? "blob" : "tree";
    const prefix = host === "gitlab" ? `${webAddress}/-/${view}` : `${webAddress}/${view}`;
    const segments = repoPath
    .split("/")
    .filter((segment) => segment !== "")
    .map((segment) => encodeURIComponent(segment));
    const url = [prefix, hash, ...segments].join("/");

    if (kind === "directory" || !lines) {
        return url;
    }

    let anchor = `#L${lines.start}`;
    if (lines.end !== lines.start) {
        anchor += host === "gitlab" ? `-${lines.end}` : `-L${lines.end}`;
    }

    const lowerPath = repoPath.toLowerCase();
    const isRendered = renderedFileExtensions.some((ext) => lowerPath.endsWith(ext));
    return `${url}${isRendered ? "?plain=1" : ""}${anchor}`;
}


/**
 * A position in a text document.  Both numbers are 0-based, as in VS Code.
 */
export interface ITextPosition {
    line:      number;
    character: number;
}


/**
 * Converts the start and end of a selection into the lines it covers.  A
 * selection that ends at the start of a later line, as one of whole lines
 * usually does, does not cover that last line.
 *
 * @param start - The start of the selection
 * @param end - The end of the selection.  Equal to _start_ for a cursor with
 * no selection.
 * @returns The covered lines, 1-based.  A cursor covers its own line.
 */
export function selectionToLineRange(start: ITextPosition, end: ITextPosition): ILineRange {
    const endsAtLineStart = end.character === 0 && end.line > start.line;
    return {
        start: start.line + 1,
        end:   endsAtLineStart ? end.line : end.line + 1
    };
}
