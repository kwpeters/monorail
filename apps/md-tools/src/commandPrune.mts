import * as path from "node:path";
import type { Argv, Arguments } from "yargs";
import { Result, SucceededResult, FailedResult } from "@repo/depot/result";
import { File } from "@repo/depot-node/file";
import { Directory } from "@repo/depot-node/directory";
import { promptToContinue } from "@repo/depot-node/prompts";
import { isAbsoluteUrlOrFragment } from "./commandPreview.mjs";


const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico"]);


export const command  = "prune <directory>";
export const describe = "List image files not referenced by any markdown document, with option to delete them";


/**
 * Registers yargs positional arguments for the `prune` sub-command.
 *
 * @param argv - The yargs instance provided by the parent command.
 * @returns The yargs instance with prune-specific arguments attached.
 */
export function builder(argv: Argv): Argv {
    return argv
    .positional("directory", {
        type:     "string",
        describe: "Directory to scan for unreferenced image files"
    });
}


interface IPruneConfig {
    targetDir: Directory;
}


async function getConfiguration(args: Arguments): Promise<Result<IPruneConfig, string>> {
    const dirArg = args.directory as string;
    const dir    = new Directory(dirArg);

    const stats = await dir.exists();
    if (!stats) {
        console.error(`Error: directory not found: ${dir.absPath()}`);
        return new FailedResult(`Directory not found: ${dir.absPath()}`);
    }

    return new SucceededResult({ targetDir: dir.absolute() });
}


/**
 * Yargs command handler for the `prune` sub-command.
 *
 * Scans `targetDir` for image files not referenced by any markdown document.
 * In interactive mode, prompts the user before deleting. Exits with a non-zero
 * code on validation failure.
 *
 * @param args - Raw yargs argument map.
 */
export async function handler(args: Arguments): Promise<void> {
    const configRes = await getConfiguration(args);
    if (configRes.failed) {
        process.exit(1);
    }

    const { targetDir } = configRes.value;
    console.log(`Scanning: ${targetDir.absPath()}`);

    const markdownFiles: Array<File> = [];
    const imageFiles:    Array<File> = [];
    await collectFiles(targetDir, markdownFiles, imageFiles);

    console.log(
        `Found ${markdownFiles.length} markdown file(s) and ${imageFiles.length} image file(s).`
    );

    if (imageFiles.length === 0) {
        console.log("No image files found.");
        return;
    }

    const referencedPaths = new Set<string>();
    for (const mdFile of markdownFiles) {
        const content = await mdFile.read();
        for (const ref of extractReferencedPaths(content, mdFile)) {
            referencedPaths.add(ref);
        }
    }

    const orphans = imageFiles
    .filter((imgFile) => !referencedPaths.has(imgFile.absPath()))
    .sort((a, b) => a.absPath().localeCompare(b.absPath()));

    if (orphans.length === 0) {
        console.log("All image files are referenced. Nothing to prune.");
        return;
    }

    console.log(`\nUnreferenced image files (${orphans.length}):`);
    for (const orphan of orphans) {
        console.log(`  ${path.relative(targetDir.absPath(), orphan.absPath())}`);
    }

    const interactive = process.stdin.isTTY && process.stdout.isTTY;
    if (!interactive) {
        console.log("\nNon-interactive mode: skipping deletion prompt.");
        return;
    }

    console.log("");
    const confirmed = await promptToContinue(
        `Delete all ${orphans.length} unreferenced file(s)?`,
        false
    );

    if (!confirmed) {
        console.log("No files deleted.");
        return;
    }

    let deletedCount = 0;
    for (const orphan of orphans) {
        try {
            await orphan.delete();
            console.log(`Deleted: ${path.relative(targetDir.absPath(), orphan.absPath())}`);
            deletedCount++;
        }
        catch (err) {
            console.error(
                `Failed to delete ${path.relative(targetDir.absPath(), orphan.absPath())}: ${formatError(err)}`
            );
        }
    }

    console.log(`\nDeleted ${deletedCount} of ${orphans.length} file(s).`);
}


async function collectFiles(
    dir:           Directory,
    markdownFiles: Array<File>,
    imageFiles:    Array<File>
): Promise<void> {
    const contents = await dir.contents(false);

    for (const subdir of contents.subdirs) {
        const name = subdir.dirName;
        if (!name.startsWith(".") && name !== "node_modules") {
            await collectFiles(subdir, markdownFiles, imageFiles);
        }
    }

    for (const file of contents.files) {
        const ext = file.extName.toLowerCase();
        if (ext === ".md" || ext === ".markdown") {
            markdownFiles.push(file);
        }
        else if (IMAGE_EXTENSIONS.has(ext)) {
            imageFiles.push(file);
        }
    }
}


function extractReferencedPaths(markdownText: string, sourceFile: File): Array<string> {
    const sourceDir = sourceFile.directory.absPath();
    const result: Array<string> = [];

    const markdownLinkRegex = /!?\[[^\]]*\]\((?<target>[^)]+)\)/g;
    const htmlAttrRegex     = /<(?:img|a)\b[^>]*?\s(?:src|href)="(?<target>[^"]+)"[^>]*>/g;

    for (const regex of [markdownLinkRegex, htmlAttrRegex]) {
        let match: RegExpExecArray | null;
        regex.lastIndex = 0;
        while ((match = regex.exec(markdownText)) !== null) {
            const rawTarget = match.groups?.target;
            if (!rawTarget) {
                continue;
            }
            const cleanTarget = rawTarget.split("?")[0]?.split("#")[0] ?? "";
            if (cleanTarget && !isAbsoluteUrlOrFragment(cleanTarget)) {
                result.push(path.resolve(sourceDir, cleanTarget));
            }
        }
    }

    return result;
}


function formatError(err: unknown): string {
    if (err instanceof Error) {
        return `${err.name}: ${err.message}`;
    }
    return String(err);
}
