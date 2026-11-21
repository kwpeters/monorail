import { glob } from "glob";
import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";


/**
 * Names of directories that are never enumerated, at any depth.  They hold
 * dependencies, VCS metadata, caches and tool state, not build output, so
 * directories such as `bin` and `dist` are deliberately absent.
 */
export const defaultIgnoredDirNames: ReadonlyArray<string> = [
    ".git",
    "node_modules",
    ".turbo",
    ".vs",
    "obj",
    ".svn",
    ".hg",
    "__pycache__",
    ".venv",
    ".nuget"
];


export type ProjectKind = "node" | "dotnet";


export interface IProjectInfo {
    /** The project's name. */
    name:   string;
    kind:   ProjectKind;
    /** The project's directory, relative to the enumeration root.  Forward slashes.  "" when it is the root. */
    relDir: string;
}


/**
 * Builds glob `ignore` patterns that skip the named directories (and
 * everything under them) at any depth.
 *
 * @param dirNames - The directory names to ignore
 * @returns The glob ignore patterns
 */
function ignorePatterns(dirNames: ReadonlyArray<string>): Array<string> {
    return dirNames.flatMap((name) => [`**/${name}`, `**/${name}/**`]);
}


function globOptions(root: Directory, ignoredDirNames: ReadonlyArray<string>) {
    return {
        cwd:    root.absPath(),
        dot:    true,
        posix:  true,
        ignore: ignorePatterns(ignoredDirNames)
    };
}


/**
 * Enumerates the files under _root_, recursively, skipping ignored directories.
 *
 * @param root - The directory to enumerate
 * @param ignoredDirNames - Names of directories to skip, at any depth
 * @returns A promise for the files' paths relative to _root_, with forward
 * slashes.  Rejects if _root_ cannot be read.
 */
export async function enumerateFiles(
    root:            Directory,
    ignoredDirNames: ReadonlyArray<string> = defaultIgnoredDirNames
): Promise<Array<string>> {
    const paths = await glob("**/*", { ...globOptions(root, ignoredDirNames), nodir: true });
    return paths.sort();
}


/**
 * Enumerates the directories under _root_, recursively, skipping ignored
 * directories.  _root_ itself is not included.
 *
 * @param root - The directory to enumerate
 * @param ignoredDirNames - Names of directories to skip, at any depth
 * @returns A promise for the directories' paths relative to _root_, with
 * forward slashes.  Rejects if _root_ cannot be read.
 */
export async function enumerateDirectories(
    root:            Directory,
    ignoredDirNames: ReadonlyArray<string> = defaultIgnoredDirNames
): Promise<Array<string>> {
    const paths = await glob("**/", globOptions(root, ignoredDirNames));
    // The pattern also matches _root_ itself, as ".".
    return paths.filter((p) => p !== "." && p !== "").sort();
}


/**
 * Enumerates the projects under _root_: each `package.json` (named by its
 * `name` field with any scope removed, else by its directory) and each
 * `.csproj` file (named by its file name without the extension).
 *
 * @param root - The directory to enumerate
 * @param ignoredDirNames - Names of directories to skip, at any depth
 * @returns A promise for the projects, sorted by name and then directory.
 * Rejects if _root_ cannot be read.
 */
export async function enumerateProjects(
    root:            Directory,
    ignoredDirNames: ReadonlyArray<string> = defaultIgnoredDirNames
): Promise<Array<IProjectInfo>> {
    const paths = await glob(
        ["**/package.json", "**/*.csproj"],
        { ...globOptions(root, ignoredDirNames), nodir: true }
    );

    const projects = await Promise.all(paths.map(async (relPath): Promise<IProjectInfo> => {
        const slash = relPath.lastIndexOf("/");
        const relDir = slash < 0 ? "" : relPath.slice(0, slash);
        const fileName = relPath.slice(slash + 1);

        if (fileName === "package.json") {
            const dirName = relDir.slice(relDir.lastIndexOf("/") + 1) || root.dirName;
            return { name: await nodeProjectName(new File(root, relPath), true, dirName), kind: "node", relDir };
        }

        return { name: fileName.slice(0, -".csproj".length), kind: "dotnet", relDir };
    }));

    return projects.sort((a, b) => a.name.localeCompare(b.name) || a.relDir.localeCompare(b.relDir));
}


/**
 * Reads the name of the Node project described by a package.json file.
 *
 * @param packageJson - The package.json file
 * @param removeScope - Whether to remove any `@scope/` prefix from the name
 * @param fallbackName - The name to use when the file has no usable `name`
 * @returns A promise for the project's name.  This promise never rejects.
 */
export async function nodeProjectName(
    packageJson: File,
    removeScope: boolean,
    fallbackName: string
): Promise<string> {
    try {
        const json = await packageJson.readJson<{ name?: unknown }>();
        if (typeof json.name === "string" && json.name !== "") {
            return removeScope ? json.name.replace(/^@[^/]+\//u, "") : json.name;
        }
    }
    catch {
        // An unreadable or malformed package.json still counts as a project.
    }
    return fallbackName;
}


export type PathBase = "absolute" | "relative";
export type SlashStyle = "forward" | "backward";


/**
 * Formats a path as absolute or relative, with the chosen separator.  Pure
 * string manipulation, so the result does not depend on the platform it runs
 * on.
 *
 * @param baseDir - Absolute path of the directory that _relPath_ is relative to
 * @param relPath - The item's path relative to _baseDir_ (either slash style)
 * @param base - Whether to produce an absolute or a relative path
 * @param slashStyle - The path separator to use in the result
 * @returns The formatted path
 */
export function formatPath(
    baseDir:    string,
    relPath:    string,
    base:       PathBase,
    slashStyle: SlashStyle
): string {
    const forward = (p: string): string => p.replaceAll("\\", "/");
    const rel = forward(relPath);
    const joined = base === "relative" ?
                   rel :
                   [forward(baseDir).replace(/\/+$/u, ""), rel].filter((s) => s !== "").join("/");
    return slashStyle === "forward" ? joined : joined.replaceAll("/", "\\");
}


/**
 * Formats a Markdown link, `[text](target)`.  Special characters are escaped so
 * that the link is valid:
 *
 * - In the link text, a backslash is put before each `\`, `[` and `]`.
 * - In the link target, every `\` is doubled.  The target is wrapped in `<...>`
 *   when it contains whitespace, `(`, `)`, `<` or `>`, and then a backslash is
 *   put before each `<` and `>` inside the brackets.
 *
 * A Markdown link target is a URL reference, so callers should pass a path that
 * uses forward slashes.
 *
 * @param text - The link text.  When _target_ is not given, this is also the
 * link target, as in `[path](path)`.
 * @param target - The link target, such as a URL.  Defaults to _text_.
 * @returns The Markdown link text
 */
export function formatMarkdownLink(text: string, target: string = text): string {
    const escapedText = text.replaceAll(/[\\[\]]/gu, "\\$&");

    const doubled = target.replaceAll("\\", "\\\\");
    const escapedTarget = /[\s()<>]/u.test(doubled) ?
                          `<${doubled.replaceAll(/[<>]/gu, "\\$&")}>` :
                          doubled;

    return `[${escapedText}](${escapedTarget})`;
}
