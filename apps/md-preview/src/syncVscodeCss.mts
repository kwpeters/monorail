import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import { fileURLToPath } from "node:url";


const thisFile = fileURLToPath(import.meta.url);
const thisDir = path.dirname(thisFile);
const appRoot = path.resolve(thisDir, "..");
const destinationMarkdownCssPath = path.join(appRoot, "assets", "vscode-markdown.css");
const destinationHighlightCssPath = path.join(appRoot, "assets", "vscode-highlight.css");


void syncVscodeMarkdownCss();


async function syncVscodeMarkdownCss(): Promise<void> {
    const sourceMediaDir = await findSourceMediaDir();
    if (!sourceMediaDir) {
        throw new Error(
            [
                "Could not find VS Code markdown preview media directory automatically.",
                "Update getCandidatePaths() in syncVscodeCss.mts for your platform/install path.",
            ].join(" ")
        );
    }

    const sourceMarkdownCssPath = path.join(sourceMediaDir, "markdown.css");
    const sourceHighlightCssPath = path.join(sourceMediaDir, "highlight.css");

    await fs.mkdir(path.dirname(destinationMarkdownCssPath), { recursive: true });
    await fs.copyFile(sourceMarkdownCssPath, destinationMarkdownCssPath);
    await fs.copyFile(sourceHighlightCssPath, destinationHighlightCssPath);

    console.log(`Copied VS Code markdown.css from: ${sourceMarkdownCssPath}`);
    console.log(`Copied VS Code highlight.css from: ${sourceHighlightCssPath}`);
    console.log(`Updated vendored stylesheets at:`);
    console.log(`  - ${destinationMarkdownCssPath}`);
    console.log(`  - ${destinationHighlightCssPath}`);
}


async function findSourceMediaDir(): Promise<string | undefined> {
    const candidateDirs = await getCandidateDirs();
    for (const candidateDir of candidateDirs) {
        const markdownCssPath = path.join(candidateDir, "markdown.css");
        const highlightCssPath = path.join(candidateDir, "highlight.css");
        if (await pathExists(markdownCssPath) && await pathExists(highlightCssPath)) {
            return candidateDir;
        }
    }

    return undefined;
}


async function getCandidateDirs(): Promise<Array<string>> {
    const relativeMediaPath = path.join(
        "resources",
        "app",
        "extensions",
        "markdown-language-features",
        "media"
    );

    const candidates = new Set<string>();

    const windowsRoots = [
        "C:\\Program Files",
        "C:\\Program Files (x86)",
        path.join(os.homedir(), "AppData", "Local", "Programs"),
    ];

    for (const windowsRoot of windowsRoots) {
        const vscodeRoot = path.join(windowsRoot, "Microsoft VS Code");
        candidates.add(path.join(vscodeRoot, relativeMediaPath));

        const subdirs = await getSubdirectories(vscodeRoot);
        for (const subdir of subdirs) {
            candidates.add(path.join(vscodeRoot, subdir, relativeMediaPath));
        }
    }

    candidates.add(path.join("/Applications", "Visual Studio Code.app", "Contents", relativeMediaPath));
    candidates.add(path.join("/usr", "share", "code", relativeMediaPath));
    candidates.add(path.join("/usr", "share", "code-insiders", relativeMediaPath));

    return [...candidates];
}


async function getSubdirectories(rootPath: string): Promise<Array<string>> {
    try {
        const entries = await fs.readdir(rootPath, { withFileTypes: true });
        return entries
        .filter((curEntry) => curEntry.isDirectory())
        .map((curEntry) => curEntry.name);
    }
    catch {
        return [];
    }
}


async function pathExists(candidatePath: string): Promise<boolean> {
    try {
        await fs.access(candidatePath);
        return true;
    }
    catch {
        return false;
    }
}
