import * as os from "node:os";
import * as fs from "node:fs/promises";
import { watch, type FSWatcher } from "node:fs";
import * as path from "node:path";
import * as http from "node:http";
import * as net from "node:net";
import { fileURLToPath } from "node:url";
import type { Argv, Arguments } from "yargs";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { full as markdownItEmojiFull } from "markdown-it-emoji";
import markdownItFootnote from "markdown-it-footnote";
import markdownItTaskLists from "markdown-it-task-lists";
import markdownItDeflist from "markdown-it-deflist";
import hljs from "highlight.js";
import { Directory } from "@repo/depot-node/directory";
import { launch } from "@repo/depot-node/launch";
import { getFirstExternalIpv4Address } from "@repo/depot-node/networkHelpers";
import { promptToContinue } from "@repo/depot-node/prompts";


const EXIT_SUCCESS                    = 0;
const EXIT_INVALID_INPUT              = 1;
const EXIT_RUNTIME_FAILURE            = 2;
const EXIT_INVALID_NON_INTERACTIVE_CONFIG = 3;

const WATCH_DEBOUNCE_MS = 500;

// Endpoint used by the injected live-reload client (watch mode only) to receive
// Server-Sent Events telling open browser tabs to reload after a re-render.
export const LIVE_RELOAD_PATH = "/__md-preview-reload__";

export const command  = "preview [files...]";
export const describe = "Render markdown files and preview them in a browser";


export interface IValidatedInput {
    absolutePath: string;
    baseName:     string;
}


export interface IDebouncer {
    schedule: () => void;
    cancel:   () => void;
}


export function builder(argv: Argv): Argv {
    return argv
    .positional("files", {
        type:     "string",
        describe: "Markdown files to preview"
    })
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
    .option("watch", {
        type:     "boolean",
        default:  false,
        describe: "Watch the source markdown files and re-render on change (interactive mode only)"
    })
    .option("indent-sections", {
        type:     "boolean",
        default:  false,
        describe: "Indent each section's body one step deeper than its heading, nested by heading depth"
    })
    .option("collapsible-sections", {
        type:     "boolean",
        default:  false,
        describe: "Make each heading a click-to-toggle that shows or hides the section body"
    });
}


export async function handler(args: Arguments): Promise<void> {
    const noOpen            = !(args.open as boolean);
    const outputDir         = args.outputDir as string | undefined;
    const timeoutMs         = args.timeoutMs as number | undefined;
    const watchMode         = args.watch as boolean;
    const indentSections    = args.indentSections as boolean;
    const collapsibleSecs   = args.collapsibleSections as boolean;
    const rawFiles          = args.files as Array<string> | string | undefined;
    const positionalPaths   = Array.isArray(rawFiles) ? rawFiles :
        typeof rawFiles === "string"                   ? [rawFiles] :
        [];

    try {
        const exitCode = await previewImpl(
            noOpen, outputDir, timeoutMs, watchMode, indentSections, collapsibleSecs, positionalPaths
        );
        if (exitCode !== EXIT_SUCCESS) {
            process.exit(exitCode);
        }
    }
    catch (err) {
        console.error("Fatal error while running md-tools preview.");
        console.error(formatError(err));
        process.exit(EXIT_RUNTIME_FAILURE);
    }
}


/**
 * Creates a debouncer that runs `action` once activity has been quiet for
 * `delayMs`. Extracted as a standalone helper so the timing logic can be unit
 * tested independently of the file-watching machinery.
 */
export function createDebouncer(delayMs: number, action: () => void): IDebouncer {
    let timer: NodeJS.Timeout | undefined;

    const cancel = (): void => {
        if (timer) {
            clearTimeout(timer);
            timer = undefined;
        }
    };

    const schedule = (): void => {
        cancel();
        timer = setTimeout(() => {
            timer = undefined;
            action();
        }, delayMs);
    };

    return { schedule, cancel };
}


export interface IRuntimeState {
    outputDir:          string;
    shouldDeleteOnExit: boolean;
    server?:            http.Server;
    serverSockets:      Set<net.Socket>;
    reloadClients:      Set<http.ServerResponse>;
    watchers:           Array<FSWatcher>;
    debouncer?:         IDebouncer | undefined;
    shuttingDown:       boolean;
}


async function previewImpl(
    noOpen: boolean,
    outputDir: string | undefined,
    timeoutMs: number | undefined,
    watchMode: boolean,
    indentSections: boolean,
    collapsibleSections: boolean,
    positionalPaths: Array<string>
): Promise<number> {
    const pipedInput = await readPipedPaths();

    const validation = await validateAndNormalizeInputs(positionalPaths, pipedInput);
    if (!validation.succeeded) {
        return validation.exitCode;
    }

    const interactive = process.stdin.isTTY && process.stdout.isTTY;
    const runModeExitCode = validateRunMode(interactive, timeoutMs);
    if (runModeExitCode !== undefined) {
        console.error("Non-interactive mode requires --timeoutMs.");
        return runModeExitCode;
    }

    if (watchMode && !interactive) {
        console.error("The --watch option is only supported in interactive mode.");
        return EXIT_INVALID_NON_INTERACTIVE_CONFIG;
    }

    const effectiveNoOpen = interactive ? noOpen : true;

    // Preparing an explicit output directory empties it. Refuse to proceed if
    // any source file lives at or beneath that directory, since emptying it
    // would delete the very files we are asked to render.
    const outputSafetyError = findSourcesInsideOutputDir(validation.inputs, outputDir);
    if (outputSafetyError.length > 0) {
        console.error("Refusing to run: the output directory would contain (and delete) these source files:");
        for (const cur of outputSafetyError) {
            console.error(`  - ${cur}`);
        }
        return EXIT_INVALID_INPUT;
    }

    const outputDirectory = await prepareOutputDirectory(outputDir, interactive);
    console.log(`Output directory: ${outputDirectory.outputDir}`);
    console.warn("Warning: raw HTML rendering is enabled. Use only trusted content.");

    const runtimeState: IRuntimeState = {
        outputDir:          outputDirectory.outputDir,
        shouldDeleteOnExit: outputDirectory.shouldDeleteOnExit,
        serverSockets:      new Set<net.Socket>(),
        reloadClients:      new Set<http.ServerResponse>(),
        watchers:           [],
        shuttingDown:       false
    };

    registerSignalHandlers(runtimeState);

    try {
        const renderResult = await renderFilesToTemp(
            validation.inputs,
            outputDirectory.outputDir,
            watchMode,
            indentSections,
            collapsibleSections
        );
        await writeSharedStylesheet(
            outputDirectory.outputDir,
            indentSections,
            collapsibleSections
        );

        console.log(`Accepted files: ${validation.inputs.length}`);
        console.log(`Rendered files: ${renderResult.renderedCount}`);

        const server = await startServer(
            outputDirectory.outputDir,
            runtimeState.serverSockets,
            runtimeState.reloadClients,
            watchMode
        );
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

        if (!effectiveNoOpen) {
            launchBrowser(localUrl);
            console.log("Browser launch: attempted");
        }
        else {
            console.log("Browser launch: skipped");
        }

        if (watchMode) {
            startWatching(validation.inputs, runtimeState, indentSections, collapsibleSections);
            console.log("Watching source files for changes. Refresh the browser after each re-render.");
        }

        if (timeoutMs !== undefined) {
            await new Promise<void>((resolve) => {
                setTimeout(resolve, timeoutMs);
            });
            console.log(`Shutdown reason: timeout (${timeoutMs} ms)`);
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
    process.stdout.write("Press any key to stop md-tools preview.\n");

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
        console.error("Usage: md-tools preview [files...] [--no-open] [--timeoutMs <n>] [--outputDir <path>]");
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
        const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "md-tools-"));
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


async function renderFilesToTemp(
    inputs: Array<IValidatedInput>,
    tempDir: string,
    liveReload = false,
    indentSections = false,
    collapsibleSections = false
): Promise<IRenderResult> {
    const renderer = createRenderer(indentSections, collapsibleSections);

    for (const input of inputs) {
        const sourceText = await fs.readFile(input.absolutePath, "utf8");
        const rewrittenText = await rewriteAndCopyAssets(sourceText, input.absolutePath, tempDir);
        const rendered = renderer.render(rewrittenText);
        const document = wrapHtmlDocument(input.baseName, rendered, liveReload, collapsibleSections);
        const outPath = getOutputHtmlPath(tempDir, input.baseName);
        await fs.writeFile(outPath, document, "utf8");
    }

    return { renderedCount: inputs.length };
}


export async function renderFilesToTempForTests(
    inputs: Array<IValidatedInput>,
    tempDir: string,
    liveReload = false,
    indentSections = false,
    collapsibleSections = false
): Promise<number> {
    const result = await renderFilesToTemp(inputs, tempDir, liveReload, indentSections, collapsibleSections);
    return result.renderedCount;
}


export function isPathInside(childPath: string, parentPath: string): boolean {
    const relative = path.relative(parentPath, childPath);
    return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}


export function findSourcesInsideOutputDir(
    inputs: Array<IValidatedInput>,
    outputDirArg: string | undefined
): Array<string> {
    if (outputDirArg === undefined) {
        return [];
    }

    const resolvedOutputDir = path.resolve(outputDirArg);
    return inputs
    .filter((input) => isPathInside(input.absolutePath, resolvedOutputDir))
    .map((input) => input.absolutePath);
}


function startWatching(
    inputs: Array<IValidatedInput>,
    runtimeState: IRuntimeState,
    indentSections: boolean,
    collapsibleSections: boolean
): void {
    const watchedFiles = new Set(inputs.map((input) => input.absolutePath));
    const watchedDirs = new Set(inputs.map((input) => path.dirname(input.absolutePath)));

    let renderChain: Promise<void> = Promise.resolve();

    const rerender = async (): Promise<void> => {
        try {
            const result = await renderFilesToTemp(
                inputs, runtimeState.outputDir, true, indentSections, collapsibleSections
            );
            console.log(`Re-rendered files: ${result.renderedCount}`);
            notifyReloadClients(runtimeState.reloadClients);
        }
        catch (err) {
            console.error(`Re-render failed: ${formatError(err)}`);
        }
    };

    const debouncer = createDebouncer(WATCH_DEBOUNCE_MS, () => {
        renderChain = renderChain.then(rerender);
    });
    runtimeState.debouncer = debouncer;

    for (const dir of watchedDirs) {
        try {
            const watcher = watch(dir, (_eventType, filename) => {
                if (filename === null) {
                    debouncer.schedule();
                    return;
                }

                const changedPath = path.resolve(dir, filename);

                if (isPathInside(changedPath, runtimeState.outputDir)) {
                    return;
                }

                if (watchedFiles.has(changedPath)) {
                    debouncer.schedule();
                }
            });

            watcher.on("error", (err) => {
                console.warn(`Watch warning for ${dir}: ${formatError(err)}`);
            });

            runtimeState.watchers.push(watcher);
        }
        catch (err) {
            console.warn(`Unable to watch directory ${dir}: ${formatError(err)}`);
        }
    }
}


function notifyReloadClients(reloadClients: Set<http.ServerResponse>): void {
    for (const client of reloadClients) {
        try {
            client.write("event: reload\ndata: {}\n\n");
        }
        catch (err) {
            console.warn(`Live-reload notification failed: ${formatError(err)}`);
        }
    }
}


export function notifyReloadClientsForTests(reloadClients: Set<http.ServerResponse>): void {
    notifyReloadClients(reloadClients);
}


function gfmSlugify(str: string): string {
    const lower       = str.toLowerCase();
    const stripped    = lower.replace(/[^\w\s-]/g, "");
    const trimmed     = stripped.trim();
    const hyphenated  = trimmed.replace(/\s+/g, "-");
    return hyphenated.replace(/-+/g, "-");
}


function createRenderer(indentSections = false, collapsibleSections = false): markdownIt {
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
    md.use(markdownItAnchor, { slugify: gfmSlugify });
    md.use(markdownItDeflist);

    if (collapsibleSections) {
        md.use(jsCollapsibleSectionPlugin);
    }
    else if (indentSections) {
        md.use(sectionWrappingPlugin);
    }

    return md;
}


export function createRendererForTests(indentSections = false, collapsibleSections = false): markdownIt {
    return createRenderer(indentSections, collapsibleSections);
}


function sectionWrappingPlugin(md: markdownIt): void {
    md.core.ruler.push("wrap_header_sections", (state) => {
        const result: Array<typeof state.tokens[number]> = [];
        const openLevels: Array<number> = [];

        const closeSection = (): void => {
            const close = new state.Token("section_close", "section", -1);
            close.block = true;
            result.push(close);
            openLevels.pop();
        };

        for (const token of state.tokens) {
            if (token.type === "heading_open") {
                const level = Number(token.tag.slice(1));
                while (openLevels.length > 0 && openLevels[openLevels.length - 1]! >= level) {
                    closeSection();
                }

                const open = new state.Token("section_open", "section", 1);
                open.block = true;
                open.attrSet("class", `md-section md-section-h${level}`);
                result.push(open);
                openLevels.push(level);
            }

            result.push(token);
        }

        while (openLevels.length > 0) {
            closeSection();
        }

        state.tokens = result;
    });
}


function jsCollapsibleSectionPlugin(md: markdownIt): void {
    md.core.ruler.push("wrap_js_collapsible_sections", (state) => {
        const result: Array<typeof state.tokens[number]> = [];
        const openLevels: Array<number> = [];
        let pendingBodyOpen = false;

        const closeTopSection = (): void => {
            const bodyClose = new state.Token("div_close", "div", -1);
            bodyClose.block = true;
            result.push(bodyClose);

            const sectionClose = new state.Token("section_close", "section", -1);
            sectionClose.block = true;
            result.push(sectionClose);

            openLevels.pop();
        };

        for (const token of state.tokens) {
            if (token.type === "heading_open") {
                const level = Number(token.tag.slice(1));
                while (openLevels.length > 0 && openLevels[openLevels.length - 1]! >= level) {
                    closeTopSection();
                }

                const sectionOpen = new state.Token("section_open", "section", 1);
                sectionOpen.block = true;
                sectionOpen.attrSet("class", `md-section md-section-h${level}`);
                result.push(sectionOpen);
                openLevels.push(level);

                result.push(token);
                pendingBodyOpen = true;
            }
            else if (token.type === "heading_close" && pendingBodyOpen) {
                pendingBodyOpen = false;
                result.push(token);

                const bodyOpen = new state.Token("div_open", "div", 1);
                bodyOpen.block = true;
                bodyOpen.attrSet("class", "md-section-body");
                result.push(bodyOpen);
            }
            else {
                result.push(token);
            }
        }

        while (openLevels.length > 0) {
            closeTopSection();
        }

        state.tokens = result;
    });
}


function wrapHtmlDocument(
    title: string,
    bodyHtml: string,
    liveReload = false,
    collapsibleSections = false
): string {
    const lines = [
        "<!doctype html>",
        "<html lang=\"en\">",
        "<head>",
        "  <meta charset=\"utf-8\">",
        "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
        `  <title>${escapeHtml(title)}</title>`,
        "  <link rel=\"stylesheet\" href=\"./md-preview.css\">",
        "</head>",
        "<body class=\"vscode-body vscode-light\">",
        ...(collapsibleSections ? toolbarHtmlLines() : []),
        "  <main class=\"markdown-body\">",
        bodyHtml,
        "  </main>"
    ];

    if (liveReload) {
        lines.push(liveReloadClientScript());
    }

    if (collapsibleSections) {
        lines.push(collapsibleToggleScript());
    }

    lines.push(
        "</body>",
        "</html>",
        ""
    );

    return lines.join("\n");
}


export function wrapHtmlDocumentForTests(
    title: string,
    bodyHtml: string,
    liveReload = false,
    collapsibleSections = false
): string {
    return wrapHtmlDocument(title, bodyHtml, liveReload, collapsibleSections);
}


function liveReloadClientScript(): string {
    return [
        "  <script>",
        "    (function () {",
        `      var source = new EventSource(${JSON.stringify(LIVE_RELOAD_PATH)});`,
        "      source.addEventListener(\"reload\", function () { window.location.reload(); });",
        "    })();",
        "  </script>"
    ].join("\n");
}


function collapsibleToggleScript(): string {
    return [
        "  <script>",
        "    (function () {",
        "      var STORAGE_KEY = 'md-preview-section-states';",
        "      function sections() { return Array.from(document.querySelectorAll('.md-section')); }",
        "      function getKey(section) {",
        "        var h = section.querySelector(':scope > :is(h1,h2,h3,h4,h5,h6)');",
        "        return h ? (h.id || h.textContent.trim()) : null;",
        "      }",
        "      function saveStates() {",
        "        var newStates = {};",
        "        sections().forEach(function (section) {",
        "          var key = getKey(section);",
        "          if (key) { newStates[key] = section.classList.contains('md-section--collapsed'); }",
        "        });",
        "        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(newStates));",
        "      }",
        "      function setAllSections(collapsed) {",
        "        sections().forEach(function (section) {",
        "          section.classList.toggle('md-section--collapsed', collapsed);",
        "        });",
        "        saveStates();",
        "      }",
        "      var saved = sessionStorage.getItem(STORAGE_KEY);",
        "      var states = saved ? JSON.parse(saved) : {};",
        "      sections().forEach(function (section) {",
        "        var key = getKey(section);",
        "        if (key && key in states) {",
        "          section.classList.toggle('md-section--collapsed', states[key]);",
        "        }",
        "      });",
        "      window.addEventListener('beforeunload', function () {",
        "        saveStates();",
        "      });",
        "      document.querySelectorAll('.md-section > :is(h1,h2,h3,h4,h5,h6)').forEach(function (h) {",
        "        h.addEventListener('click', function () {",
        "          h.closest('.md-section').classList.toggle('md-section--collapsed');",
        "          saveStates();",
        "        });",
        "      });",
        "      var expandAllButton = document.querySelector('[data-md-preview-expand-all]');",
        "      if (expandAllButton) {",
        "        expandAllButton.addEventListener('click', function () { setAllSections(false); });",
        "      }",
        "      var collapseAllButton = document.querySelector('[data-md-preview-collapse-all]');",
        "      if (collapseAllButton) {",
        "        collapseAllButton.addEventListener('click', function () { setAllSections(true); });",
        "      }",
        "    })();",
        "  </script>"
    ].join("\n");
}


function toolbarHtmlLines(): Array<string> {
    return [
        "  <div class=\"md-preview-toolbar\" role=\"toolbar\" aria-label=\"Section controls\">",
        "    <button type=\"button\" class=\"md-preview-toolbar__button\" data-md-preview-expand-all>Expand all</button>",
        "    <button type=\"button\" class=\"md-preview-toolbar__button\" data-md-preview-collapse-all>Collapse all</button>",
        "  </div>"
    ];
}


async function writeSharedStylesheet(
    tempDir: string,
    indentSections = false,
    collapsibleSections = false
): Promise<void> {
    const vscodeCssPath = fileURLToPath(new URL("../assets/vscode-markdown.css", import.meta.url));
    const vscodeHighlightCssPath = fileURLToPath(new URL("../assets/vscode-highlight.css", import.meta.url));

    let cssText: string;
    try {
        cssText = await fs.readFile(vscodeCssPath, "utf8");
    }
    catch {
        cssText = "html, body { font-family: -apple-system, BlinkMacSystemFont, \"Segoe WPC\", \"Segoe UI\", system-ui, \"Ubuntu\", \"Droid Sans\", sans-serif; font-size: 16px; line-height: 1.6; margin: 0; padding: 0 26px; } body { padding-top: 1em; }";
    }

    let highlightCssText = "";
    try {
        highlightCssText = await fs.readFile(vscodeHighlightCssPath, "utf8");
    }
    catch {
        // Keep rendering functional even if the theme file is not found.
    }

    cssText = composeStylesheet(cssText, highlightCssText, indentSections, collapsibleSections);

    await fs.writeFile(path.join(tempDir, "md-preview.css"), cssText, "utf8");
}


export function composeStylesheet(
    vscodeCssText: string,
    highlightCssText: string,
    indentSections = false,
    collapsibleSections = false
): string {
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

    let result = `${vscodeCssText}\n${highlightCssText}\n${inlineCodeFallbackCss}`;
    if (indentSections && !collapsibleSections) {
        result = `${result}\n${sectionIndentCss()}`;
    }
    if (collapsibleSections) {
        result = `${result}\n${collapsibleSectionCss()}`;
        if (indentSections) {
            result = `${result}\n${sectionIndentCss()}`;
        }
    }
    return result;
}


function sectionIndentCss(): string {
    return [
        "",
        ".markdown-body .md-section > :not(:first-child) {",
        "  margin-inline-start: 1.5em;",
        "}",
        ""
    ].join("\n");
}


function collapsibleSectionCss(): string {
    return [
        "",
        ".markdown-body {",
        "  padding-top: 4.5rem;",
        "}",
        ".md-preview-toolbar {",
        "  position: sticky;",
        "  top: 0;",
        "  z-index: 20;",
        "  display: flex;",
        "  gap: 0.5rem;",
        "  align-items: center;",
        "  padding: 0.75rem 1rem;",
        "  margin: 0 -26px 1rem;",
        "  border-bottom: 1px solid var(--vscode-widget-border, #d0d7de);",
        "  background: color-mix(in srgb, var(--vscode-editor-background, #ffffff) 92%, #dbeafe 8%);",
        "  backdrop-filter: blur(6px);",
        "}",
        ".md-preview-toolbar__button {",
        "  appearance: none;",
        "  border: 1px solid var(--vscode-widget-border, #d0d7de);",
        "  background: var(--vscode-button-secondaryBackground, #f6f8fa);",
        "  color: var(--vscode-editor-foreground, #24292f);",
        "  border-radius: 999px;",
        "  padding: 0.35rem 0.8rem;",
        "  font: inherit;",
        "  cursor: pointer;",
        "}",
        ".md-preview-toolbar__button:hover {",
        "  background: var(--vscode-button-secondaryHoverBackground, #eaeef2);",
        "}",
        ".md-section--collapsed > .md-section-body {",
        "  display: none;",
        "}",
        ".markdown-body .md-section > h1,",
        ".markdown-body .md-section > h2,",
        ".markdown-body .md-section > h3,",
        ".markdown-body .md-section > h4,",
        ".markdown-body .md-section > h5,",
        ".markdown-body .md-section > h6 {",
        "  cursor: pointer;",
        "  user-select: none;",
        "}",
        ""
    ].join("\n");
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
        launch("start", ["\"\"", escapedUrl], { shell: true, windowsVerbatimArguments: true });
    }
    else if (process.platform === "darwin") {
        launch("open", [escapedUrl], { shell: true });
    }
    else {
        launch("xdg-open", [escapedUrl], { shell: true });
    }
}


async function startServer(
    rootDir: string,
    serverSockets: Set<net.Socket>,
    reloadClients: Set<http.ServerResponse>,
    liveReloadEnabled: boolean
): Promise<http.Server> {
    const server = http.createServer((req, res) => {
        const __dontCare = (async () => {
            try {
                const requestUrl = new URL(req.url ?? "/", "http://localhost");

                if (liveReloadEnabled && requestUrl.pathname === LIVE_RELOAD_PATH) {
                    res.statusCode = 200;
                    res.setHeader("content-type", "text/event-stream");
                    res.setHeader("cache-control", "no-cache");
                    res.setHeader("connection", "keep-alive");
                    res.write("retry: 1000\n\n");
                    reloadClients.add(res);
                    req.on("close", () => {
                        reloadClients.delete(res);
                    });
                    return;
                }

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
                        "<head><meta charset=\"utf-8\"><title>md-tools listing</title><link rel=\"stylesheet\" href=\"/md-preview.css\"></head>",
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


export async function startServerForTests(
    rootDir: string,
    serverSockets: Set<net.Socket>,
    reloadClients: Set<http.ServerResponse>,
    liveReloadEnabled: boolean
): Promise<http.Server> {
    return startServer(rootDir, serverSockets, reloadClients, liveReloadEnabled);
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

    if (runtimeState.debouncer) {
        runtimeState.debouncer.cancel();
        runtimeState.debouncer = undefined;
    }
    for (const watcher of runtimeState.watchers) {
        try {
            watcher.close();
        }
        catch (err) {
            console.warn(`Cleanup warning while closing watcher: ${formatError(err)}`);
        }
    }
    runtimeState.watchers = [];

    for (const client of runtimeState.reloadClients) {
        try {
            client.end();
        }
        catch (err) {
            console.warn(`Cleanup warning while closing live-reload client: ${formatError(err)}`);
        }
    }
    runtimeState.reloadClients.clear();

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
