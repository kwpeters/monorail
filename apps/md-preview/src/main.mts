import * as os from "node:os";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as http from "node:http";
import * as net from "node:net";
import { fileURLToPath } from "node:url";
import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { full as markdownItEmojiFull } from "markdown-it-emoji";
import markdownItFootnote from "markdown-it-footnote";
import markdownItTaskLists from "markdown-it-task-lists";
import hljs from "highlight.js";
import { Directory } from "@repo/depot-node/directory";
import { launch } from "@repo/depot-node/launch";
import { getFirstExternalIpv4Address } from "@repo/depot-node/networkHelpers";
import { promptToContinue } from "@repo/depot-node/prompts";


const EXIT_SUCCESS = 0;
const EXIT_INVALID_INPUT = 1;
const EXIT_RUNTIME_FAILURE = 2;
const EXIT_INVALID_NON_INTERACTIVE_CONFIG = 3;


export interface IParsedArgs {
    noOpen:          boolean;
    outputDir:       string | undefined;
    timeoutMs:       number | undefined;
    positionalPaths: Array<string>;
}


export interface IValidatedInput {
    absolutePath: string;
    baseName:     string;
}


export interface IRuntimeState {
    outputDir:          string;
    shouldDeleteOnExit: boolean;
    server?:            http.Server;
    serverSockets:      Set<net.Socket>;
    shuttingDown:       boolean;
}


export async function main(): Promise<number> {
    try {
        return await mainImpl();
    }
    catch (err) {
        console.error("Fatal error while running md-preview.");
        console.error(formatError(err));
        return EXIT_RUNTIME_FAILURE;
    }
}


async function mainImpl(): Promise<number> {
    const parsedArgs = await parseArgs();
    const pipedInput = await readPipedPaths();

    const validation = await validateAndNormalizeInputs(parsedArgs.positionalPaths, pipedInput);
    if (!validation.succeeded) {
        return validation.exitCode;
    }

    const interactive = process.stdin.isTTY && process.stdout.isTTY;
    const runModeExitCode = validateRunMode(interactive, parsedArgs.timeoutMs);
    if (runModeExitCode !== undefined) {
        console.error("Non-interactive mode requires --timeoutMs.");
        return runModeExitCode;
    }

    const noOpen = interactive ? parsedArgs.noOpen : true;
    const outputDirectory = await prepareOutputDirectory(parsedArgs.outputDir, interactive);
    console.log(`Output directory: ${outputDirectory.outputDir}`);
    console.warn("Warning: raw HTML rendering is enabled. Use only trusted content.");

    const runtimeState: IRuntimeState = {
        outputDir:          outputDirectory.outputDir,
        shouldDeleteOnExit: outputDirectory.shouldDeleteOnExit,
        serverSockets:      new Set<net.Socket>(),
        shuttingDown:       false
    };

    registerSignalHandlers(runtimeState);

    try {
        const renderResult = await renderFilesToTemp(validation.inputs, outputDirectory.outputDir);
        await writeSharedStylesheet(outputDirectory.outputDir);

        console.log(`Accepted files: ${validation.inputs.length}`);
        console.log(`Rendered files: ${renderResult.renderedCount}`);

        const server = await startServer(outputDirectory.outputDir, runtimeState.serverSockets);
        runtimeState.server = server;

        const addressInfo = server.address();
        if (!addressInfo || typeof addressInfo === "string") {
            throw new Error("Unable to determine bound server address.");
        }

        const port = addressInfo.port;
        const urls = buildPreviewUrls(port, safeGetExternalIpv4Address());
        const localUrl = urls.localUrl;
        console.log(`Local URL: ${localUrl}`);

        if (urls.lanUrl) {
            console.log(`LAN URL: ${urls.lanUrl}`);
        }
        else {
            console.warn("LAN URL unavailable: no external IPv4 address found.");
        }

        if (!noOpen) {
            launchBrowser(localUrl);
            console.log("Browser launch: attempted");
        }
        else {
            console.log("Browser launch: skipped");
        }

        if (parsedArgs.timeoutMs !== undefined) {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, parsedArgs.timeoutMs);
            });
            console.log(`Shutdown reason: timeout (${parsedArgs.timeoutMs} ms)`);
        }
        else if (interactive) {
            await waitForAnyKeypress();
            console.log("Shutdown reason: keypress");
        }
        else {
            throw new Error("Non-interactive mode requires --timeoutMs.");
        }

        await cleanupRuntime(runtimeState);
        return EXIT_SUCCESS;
    }
    catch (err) {
        console.error("Runtime failure.");
        console.error(formatError(err));
        await cleanupRuntime(runtimeState);
        return EXIT_RUNTIME_FAILURE;
    }
}


async function waitForAnyKeypress(): Promise<void> {
    process.stdout.write("Press any key to stop md-preview.\n");

    return new Promise<void>((resolve) => {
        const stdin = process.stdin;
        const canSetRawMode = stdin.isTTY && typeof stdin.setRawMode === "function";
        const originalRawMode = canSetRawMode ? stdin.isRaw : undefined;

        stdin.resume();

        if (canSetRawMode) {
            stdin.setRawMode(true);
        }

        const onData = (): void => {
            stdin.off("data", onData);

            if (canSetRawMode) {
                stdin.setRawMode(originalRawMode ?? false);
            }

            stdin.pause();
            resolve();
        };

        stdin.on("data", onData);
    });
}


function registerSignalHandlers(runtimeState: IRuntimeState): void {
    const signalHandler = async (signal: NodeJS.Signals): Promise<void> => {
        console.log(`Shutdown reason: ${signal}`);
        await cleanupRuntime(runtimeState);
        process.exit(EXIT_SUCCESS);
    };

    process.on("SIGINT", () => {
        const __dontCare = signalHandler("SIGINT");
    });
    process.on("SIGTERM", () => {
        const __dontCare = signalHandler("SIGTERM");
    });
}


function safeGetExternalIpv4Address(): string | undefined {
    try {
        const value = getFirstExternalIpv4Address();
        return value || undefined;
    }
    catch {
        return undefined;
    }
}


async function parseArgs(): Promise<IParsedArgs> {
    const argv = await yargs(hideBin(process.argv))
    .scriptName("md-preview")
    .usage("$0 [files...] [--no-open] [--timeoutMs <n>] [--outputDir <path>]")
    .option("open", {
        type:     "boolean",
        default:  true,
        describe: "Launch a browser automatically"
    })
    .option("outputDir", {
        type:     "string",
        describe: "Write generated files to this directory instead of a temp directory"
    })
    .option("timeoutMs", {
        type:     "number",
        describe: "In non-interactive mode, automatically stop after this duration"
    })
    .help()
    .strictOptions()
    .argv;

    const positionals = argv._.map((cur) => String(cur));
    return {
        noOpen:          !argv.open,
        outputDir:       argv.outputDir,
        timeoutMs:       argv.timeoutMs,
        positionalPaths: positionals
    };
}


async function readPipedPaths(): Promise<Array<string>> {
    if (process.stdin.isTTY) {
        return [];
    }

    const chunks: Array<Uint8Array> = [];
    for await (const chunk of process.stdin) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const text = Buffer.concat(chunks).toString("utf8");
    return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}


export async function validateAndNormalizeInputs(
    positional: Array<string>,
    piped: Array<string>
): Promise<
    | { succeeded: true; inputs: Array<IValidatedInput>; }
    | { succeeded: false; exitCode: number; }
> {
    const merged = dedupePaths([...positional, ...piped]);
    const invalid: Array<string> = [];
    const valid: Array<IValidatedInput> = [];

    for (const candidate of merged) {
        const absolutePath = path.resolve(candidate);
        const ext = path.extname(absolutePath).toLowerCase();

        if (ext !== ".md" && ext !== ".markdown") {
            invalid.push(candidate);
            continue;
        }

        try {
            const stats = await fs.stat(absolutePath);
            if (!stats.isFile()) {
                invalid.push(candidate);
                continue;
            }
        }
        catch {
            invalid.push(candidate);
            continue;
        }

        valid.push({
            absolutePath,
            baseName: path.basename(absolutePath, path.extname(absolutePath))
        });
    }

    if (invalid.length > 0) {
        console.error("Invalid input paths:");
        for (const cur of invalid) {
            console.error(`  - ${cur}`);
        }
        return { succeeded: false, exitCode: EXIT_INVALID_INPUT };
    }

    if (valid.length === 0) {
        console.error("No valid markdown files were provided.");
        console.error("Usage: md-preview [files...] [--no-open] [--timeoutMs <n>] [--outputDir <path>]");
        return { succeeded: false, exitCode: EXIT_INVALID_INPUT };
    }

    return { succeeded: true, inputs: valid };
}


export function dedupePaths(paths: Array<string>): Array<string> {
    const seen = new Set<string>();
    const result: Array<string> = [];
    for (const curPath of paths) {
        const key = path.resolve(curPath);
        if (!seen.has(key)) {
            seen.add(key);
            result.push(curPath);
        }
    }
    return result;
}


export function validateRunMode(interactive: boolean, timeoutMs: number | undefined): number | undefined {
    if (!interactive && timeoutMs === undefined) {
        return EXIT_INVALID_NON_INTERACTIVE_CONFIG;
    }

    return undefined;
}


export function buildPreviewUrls(port: number, lanHost: string | undefined):
{ localUrl: string; lanUrl?: string; } {
    const localUrl = `http://localhost:${port}/`;

    if (lanHost) {
        return {
            localUrl,
            lanUrl: `http://${lanHost}:${port}/`
        };
    }

    return { localUrl };
}


export function getOutputHtmlPath(tempDir: string, baseName: string): string {
    return path.join(tempDir, `${baseName}.html`);
}


interface IPreparedOutputDirectory {
    outputDir:          string;
    shouldDeleteOnExit: boolean;
}


async function prepareOutputDirectory(
    outputDirArg: string | undefined,
    interactive: boolean
): Promise<IPreparedOutputDirectory> {
    if (!outputDirArg) {
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "md-preview-"));
        return { outputDir: tempDir, shouldDeleteOnExit: true };
    }

    const outputDir = path.resolve(outputDirArg);
    await prepareNamedOutputDirectory(outputDir, interactive, async () => {
        return promptToContinue(
            `The output directory "${outputDir}" is not empty. Delete its contents?`,
            false
        );
    });

    return { outputDir, shouldDeleteOnExit: false };
}


async function prepareNamedOutputDirectory(
    outputDir: string,
    interactive: boolean,
    confirmDeletion: () => Promise<boolean>
): Promise<void> {
    const outputDirectory = (new Directory(outputDir)).absolute();
    const outputDirPath = outputDirectory.toString();

    const stats = await outputDirectory.exists();
    if (!stats) {
        const existingPathStats = await tryStat(outputDirPath);
        if (existingPathStats) {
            throw new Error(`Output path exists and is not a directory: ${outputDirPath}`);
        }

        await outputDirectory.ensureExists();
        return;
    }

    if (await outputDirectory.isEmpty()) {
        return;
    }

    if (!interactive) {
        throw new Error(
            `The output directory "${outputDirPath}" is not empty and cannot be confirmed in non-interactive mode.`
        );
    }

    const confirmed = await confirmDeletion();
    if (!confirmed) {
        throw new Error("Canceled by user because output directory cleanup was not confirmed.");
    }

    await outputDirectory.empty();
}


async function tryStat(targetPath: string): Promise<Awaited<ReturnType<typeof fs.stat>> | undefined> {
    try {
        return await fs.stat(targetPath);
    }
    catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === "ENOENT") {
            return undefined;
        }

        throw err;
    }
}


export async function prepareNamedOutputDirectoryForTests(
    outputDir: string,
    interactive: boolean,
    confirmDeletion: () => Promise<boolean>
): Promise<void> {
    await prepareNamedOutputDirectory(outputDir, interactive, confirmDeletion);
}


interface IRenderResult {
    renderedCount: number;
}


async function renderFilesToTemp(inputs: Array<IValidatedInput>, tempDir: string): Promise<IRenderResult> {
    const renderer = createRenderer();

    for (const input of inputs) {
        const sourceText = await fs.readFile(input.absolutePath, "utf8");
        const rewrittenText = await rewriteAndCopyAssets(sourceText, input.absolutePath, tempDir);
        const rendered = renderer.render(rewrittenText);
        const document = wrapHtmlDocument(input.baseName, rendered);
        const outPath = getOutputHtmlPath(tempDir, input.baseName);
        await fs.writeFile(outPath, document, "utf8");
    }

    return { renderedCount: inputs.length };
}


export async function renderFilesToTempForTests(
    inputs: Array<IValidatedInput>,
    tempDir: string
): Promise<number> {
    const result = await renderFilesToTemp(inputs, tempDir);
    return result.renderedCount;
}


function createRenderer(): markdownIt {
    const md = new markdownIt({
        html:        true,
        linkify:     true,
        typographer: true,
        highlight:   (code, lang) => {
            if (lang && hljs.getLanguage(lang)) {
                return `<pre><code class="hljs language-${escapeHtml(lang)}">${hljs.highlight(code, { language: lang }).value}</code></pre>`;
            }
            return `<pre><code class="hljs">${escapeHtml(code)}</code></pre>`;
        }
    });

    md.use(markdownItFootnote);
    md.use(markdownItEmojiFull);
    md.use(markdownItTaskLists, { enabled: true, label: true, labelAfter: true });
    md.use(markdownItAnchor);

    return md;
}


export function createRendererForTests(): markdownIt {
    return createRenderer();
}


function wrapHtmlDocument(title: string, bodyHtml: string): string {
    return [
        "<!doctype html>",
        "<html lang=\"en\">",
        "<head>",
        "  <meta charset=\"utf-8\">",
        "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
        `  <title>${escapeHtml(title)}</title>`,
        "  <link rel=\"stylesheet\" href=\"./md-preview.css\">",
        "</head>",
        "<body class=\"vscode-body vscode-light\">",
        "  <main class=\"markdown-body\">",
        bodyHtml,
        "  </main>",
        "</body>",
        "</html>",
        ""
    ].join("\n");
}


async function writeSharedStylesheet(tempDir: string): Promise<void> {
    const vscodeCssPath = fileURLToPath(new URL("../assets/vscode-markdown.css", import.meta.url));
    const vscodeHighlightCssPath = fileURLToPath(new URL("../assets/vscode-highlight.css", import.meta.url));

    let cssText: string;
    try {
        cssText = await fs.readFile(vscodeCssPath, "utf8");
    }
    catch {
        // Fallback to keep md-preview functional if the vendored CSS is missing.
        cssText = "html, body { font-family: -apple-system, BlinkMacSystemFont, \"Segoe WPC\", \"Segoe UI\", system-ui, \"Ubuntu\", \"Droid Sans\", sans-serif; font-size: 16px; line-height: 1.6; margin: 0; padding: 0 26px; } body { padding-top: 1em; }";
    }

    let highlightCssText = "";
    try {
        highlightCssText = await fs.readFile(vscodeHighlightCssPath, "utf8");
    }
    catch {
        // Keep rendering functional even if the theme file is not found.
    }

    cssText = composeStylesheet(cssText, highlightCssText);

    await fs.writeFile(path.join(tempDir, "md-preview.css"), cssText, "utf8");
}


export function composeStylesheet(vscodeCssText: string, highlightCssText: string): string {
    const inlineCodeFallbackCss = [
        "",
        ":root {",
        "  --vscode-editor-foreground: #24292f;",
        "  --vscode-textPreformat-foreground: #b42318;",
        "  --vscode-textPreformat-background: rgba(175, 184, 193, 0.2);",
        "  --vscode-textCodeBlock-background: #f6f8fa;",
        "  --vscode-textBlockQuote-background: #f3f8fd;",
        "  --vscode-textBlockQuote-border: #75beff;",
        "  --vscode-widget-border: #d0d7de;",
        "}",
        ".markdown-body blockquote {",
        "  background: var(--vscode-textBlockQuote-background, #f3f8fd);",
        "  border-left-color: var(--vscode-textBlockQuote-border, #75beff);",
        "}",
        ".markdown-body pre {",
        "  background-color: var(--vscode-textCodeBlock-background, #f6f8fa);",
        "  border-color: var(--vscode-widget-border, #d0d7de);",
        "}",
        ".markdown-body :not(pre) > code {",
        "  color: var(--vscode-textPreformat-foreground, #24292f);",
        "  background-color: var(--vscode-textPreformat-background, rgba(175, 184, 193, 0.2));",
        "  border-radius: 4px;",
        "  padding: 0.15em 0.4em;",
        "}",
        ""
    ].join("\n");

    return `${vscodeCssText}\n${highlightCssText}\n${inlineCodeFallbackCss}`;
}


async function rewriteAndCopyAssets(markdownText: string, sourceFile: string, tempDir: string): Promise<string> {
    const sourceDir = path.dirname(sourceFile);

    const markdownLinkRegex = /(?<prefix>!?\[[^\]]*\]\()(?<target>[^)]+)(?<suffix>\))/g;
    const htmlAttrRegex = /(?<prefix><(?:img|a)\b[^>]*?\s(?:src|href)=")(?<target>[^"]+)(?<suffix>"[^>]*>)/g;

    let updated = markdownText;
    updated = await rewriteMatches(updated, markdownLinkRegex, sourceDir, tempDir);
    updated = await rewriteMatches(updated, htmlAttrRegex, sourceDir, tempDir);
    return updated;
}


export async function rewriteAndCopyAssetsForTests(
    markdownText: string,
    sourceFile: string,
    tempDir: string
): Promise<string> {
    return rewriteAndCopyAssets(markdownText, sourceFile, tempDir);
}


async function rewriteMatches(
    text: string,
    regex: RegExp,
    sourceDir: string,
    tempDir: string
): Promise<string> {
    const matches = Array.from(text.matchAll(regex));
    let result = text;

    for (const match of matches) {
        const full = match[0];
        const prefix = match.groups?.prefix;
        const target = match.groups?.target;
        const suffix = match.groups?.suffix;

        if (!full || !prefix || !target || !suffix) {
            continue;
        }

        const replacementTarget = await resolveRewrittenTarget(target, sourceDir, tempDir);
        const replacement = `${prefix}${replacementTarget}${suffix}`;
        result = result.replace(full, replacement);
    }

    return result;
}


async function resolveRewrittenTarget(target: string, sourceDir: string, tempDir: string): Promise<string> {
    if (isAbsoluteUrlOrFragment(target)) {
        return target;
    }

    const sourceAssetPath = path.resolve(sourceDir, target);
    const normalizedRelative = target.replaceAll("\\", "/").replace(/^\/+/, "");
    const destinationPath = path.join(tempDir, normalizedRelative);

    try {
        const stats = await fs.stat(sourceAssetPath);
        if (!stats.isFile()) {
            console.warn(`Warning: asset is not a file: ${sourceAssetPath}`);
            return target;
        }
    }
    catch {
        console.warn(`Warning: missing asset target: ${target}`);
        return target;
    }

    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourceAssetPath, destinationPath);
    return normalizedRelative;
}


export function isAbsoluteUrlOrFragment(target: string): boolean {
    if (target.startsWith("#")) {
        return true;
    }

    return /^(?:[a-z]+:)?\/\//i.test(target)
        || /^[a-z]+:/i.test(target)
        || target.startsWith("data:")
        || target.startsWith("mailto:")
        || target.startsWith("file:");
}


function launchBrowser(url: string): void {
    const escapedUrl = `"${url}"`;
    if (process.platform.startsWith("win")) {
        // In cmd.exe, the first quoted argument after "start" is treated as
        // window title. Provide an empty title so the URL is opened correctly.
        launch("start", ["\"\"", escapedUrl], { shell: true, windowsVerbatimArguments: true });
    }
    else if (process.platform === "darwin") {
        launch("open", [escapedUrl], { shell: true });
    }
    else {
        launch("xdg-open", [escapedUrl], { shell: true });
    }
}


async function startServer(rootDir: string, serverSockets: Set<net.Socket>): Promise<http.Server> {
    const server = http.createServer((req, res) => {
        const __dontCare = (async () => {
            try {
                const requestUrl = new URL(req.url ?? "/", "http://localhost");
                const decodedPath = decodeURIComponent(requestUrl.pathname);
                const fsPath = path.join(rootDir, decodedPath);

                const normalized = path.normalize(fsPath);
                if (!normalized.startsWith(path.normalize(rootDir))) {
                    res.statusCode = 403;
                    res.setHeader("content-type", "text/plain; charset=utf-8");
                    res.end("Forbidden");
                    return;
                }

                const stats = await fs.stat(normalized);
                if (stats.isDirectory()) {
                    const entries = await fs.readdir(normalized, { withFileTypes: true });
                    const items = entries
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((entry) => {
                        const suffix = entry.isDirectory() ? "/" : "";
                        const href = path.posix.join(decodedPath.replaceAll("\\", "/"), entry.name) + suffix;
                        return `<li><a href="${escapeHtml(href)}">${escapeHtml(entry.name)}${suffix}</a></li>`;
                    })
                    .join("\n");

                    const html = [
                        "<!doctype html>",
                        "<html lang=\"en\">",
                        "<head><meta charset=\"utf-8\"><title>md-preview listing</title><link rel=\"stylesheet\" href=\"/md-preview.css\"></head>",
                        "<body><main class=\"markdown-body\">",
                        `<h1>Directory listing: ${escapeHtml(decodedPath)}</h1>`,
                        "<ul>",
                        items,
                        "</ul>",
                        "</main></body></html>"
                    ].join("\n");

                    res.statusCode = 200;
                    res.setHeader("content-type", "text/html; charset=utf-8");
                    res.end(html);
                    return;
                }

                const fileBuffer = await fs.readFile(normalized);
                const contentType = getContentType(normalized);
                res.statusCode = 200;
                res.setHeader("content-type", contentType);
                res.end(fileBuffer);
            }
            catch {
                res.statusCode = 404;
                res.setHeader("content-type", "text/plain; charset=utf-8");
                res.end("Not found");
            }
        })();
    });

    server.on("connection", (socket) => {
        serverSockets.add(socket);
        socket.on("close", () => {
            serverSockets.delete(socket);
        });
    });

    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "0.0.0.0", () => {
            server.off("error", reject);
            resolve();
        });
    });

    return server;
}


function getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case ".html":
            return "text/html; charset=utf-8";
        case ".css":
            return "text/css; charset=utf-8";
        case ".js":
            return "text/javascript; charset=utf-8";
        case ".png":
            return "image/png";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".gif":
            return "image/gif";
        case ".svg":
            return "image/svg+xml";
        default:
            return "application/octet-stream";
    }
}


async function cleanupRuntime(runtimeState: IRuntimeState): Promise<void> {
    if (runtimeState.shuttingDown) {
        return;
    }
    runtimeState.shuttingDown = true;

    try {
        if (runtimeState.server) {
            await new Promise<void>((resolve) => {
                let resolved = false;
                const finish = (): void => {
                    if (!resolved) {
                        resolved = true;
                        resolve();
                    }
                };

                runtimeState.server!.close(() => {
                    finish();
                });

                // Keep-alive browser sockets can prevent close callbacks.
                // Force close all active connections to ensure shutdown completes.
                if (typeof runtimeState.server!.closeAllConnections === "function") {
                    runtimeState.server!.closeAllConnections();
                }

                for (const socket of runtimeState.serverSockets) {
                    socket.destroy();
                }
                runtimeState.serverSockets.clear();

                setTimeout(() => {
                    finish();
                }, 500);
            });
        }
    }
    catch (err) {
        console.warn(`Cleanup warning while stopping server: ${formatError(err)}`);
    }

    if (!runtimeState.shouldDeleteOnExit) {
        console.log(`Cleanup: preserved output directory ${runtimeState.outputDir}`);
        return;
    }

    try {
        await fs.rm(runtimeState.outputDir, { recursive: true, force: true });
        console.log(`Cleanup: deleted temp directory ${runtimeState.outputDir}`);
    }
    catch (err) {
        console.warn(`Cleanup warning while deleting temp directory: ${formatError(err)}`);
    }
}


function escapeHtml(value: string): string {
    return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}


function formatError(err: unknown): string {
    if (err instanceof Error) {
        return `${err.name}: ${err.message}`;
    }
    return String(err);
}
