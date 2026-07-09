import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Argv, Arguments } from "yargs";
import { promptToContinue } from "@repo/depot-node/prompts";
import { isAbsoluteUrlOrFragment } from "./commandPreview.mjs";


const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".bmp", ".ico"]);

export const command  = "prune <directory>";
export const describe = "List image files not referenced by any markdown document, with option to delete them";


export function builder(argv: Argv): Argv {
    return argv
    .positional("directory", {
        type:     "string",
        describe: "Directory to scan for unreferenced image files"
    });
}


export async function handler(args: Arguments): Promise<void> {
    const dirArg  = args.directory as string;
    const dirPath = path.resolve(dirArg);

    try {
        const stats = await fs.stat(dirPath);
        if (!stats.isDirectory()) {
            console.error(`Error: not a directory: ${dirPath}`);
            process.exit(1);
        }
    }
    catch {
        console.error(`Error: directory not found: ${dirPath}`);
        process.exit(1);
    }

    console.log(`Scanning: ${dirPath}`);

    const markdownFiles: Array<string> = [];
    const imageFiles: Array<string>    = [];
    await walkDirectory(dirPath, markdownFiles, imageFiles);

    console.log(`Found ${markdownFiles.length} markdown file(s) and ${imageFiles.length} image file(s).`);

    if (imageFiles.length === 0) {
        console.log("No image files found.");
        return;
    }

    const referencedPaths = new Set<string>();
    for (const mdFile of markdownFiles) {
        const content = await fs.readFile(mdFile, "utf8");
        for (const ref of extractReferencedPaths(content, mdFile)) {
            referencedPaths.add(ref);
        }
    }

    const orphans = imageFiles
    .filter((imgFile) => !referencedPaths.has(imgFile))
    .sort();

    if (orphans.length === 0) {
        console.log("All image files are referenced. Nothing to prune.");
        return;
    }

    console.log(`\nUnreferenced image files (${orphans.length}):`);
    for (const orphan of orphans) {
        console.log(`  ${path.relative(dirPath, orphan)}`);
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
            await fs.unlink(orphan);
            console.log(`Deleted: ${path.relative(dirPath, orphan)}`);
            deletedCount++;
        }
        catch (err) {
            console.error(`Failed to delete ${path.relative(dirPath, orphan)}: ${formatError(err)}`);
        }
    }

    console.log(`\nDeleted ${deletedCount} of ${orphans.length} file(s).`);
}


async function walkDirectory(
    dir: string,
    markdownFiles: Array<string>,
    imageFiles: Array<string>
): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
                await walkDirectory(fullPath, markdownFiles, imageFiles);
            }
        }
        else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (ext === ".md" || ext === ".markdown") {
                markdownFiles.push(fullPath);
            }
            else if (IMAGE_EXTENSIONS.has(ext)) {
                imageFiles.push(fullPath);
            }
        }
    }
}


function extractReferencedPaths(markdownText: string, sourceFile: string): Array<string> {
    const sourceDir = path.dirname(sourceFile);
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
            // Strip query string and fragment before resolving to a filesystem path.
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
