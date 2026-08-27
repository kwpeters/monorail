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
import { Result, SucceededResult, FailedResult } from "@repo/depot/result";
import { Option, SomeOption, NoneOption } from "@repo/depot/option";
import { createDebouncer, type IDebouncer } from "@repo/depot/debounce";
import { File } from "@repo/depot-node/file";
import { Directory } from "@repo/depot-node/directory";
import { launch } from "@repo/depot-node/launch";
import { getFirstExternalIpv4Address } from "@repo/depot-node/networkHelpers";
import { promptToContinue } from "@repo/depot-node/prompts";
import { getStdinPipedLines } from "@repo/depot-node/ttyHelpers";
import { createTempDir } from "@repo/depot-node/tempDir";


const EXIT_SUCCESS        = 0;
const EXIT_INVALID_INPUT  = 1;
const EXIT_RUNTIME_FAILURE = 2;

const WATCH_DEBOUNCE_MS = 500;

/** SSE endpoint path injected into each preview page for watch-mode live reload. */
export const LIVE_RELOAD_PATH = "/__md-preview-reload__";

export const command  = "preview [files...]";
export const describe = "Render markdown files and preview them in a browser";


/**
 * Registers yargs options and positional arguments for the `preview` sub-command.
 *
 * @param argv - The yargs instance provided by the parent command.
 * @returns The yargs instance with preview-specific options attached.
 */
export function builder(argv: Argv): Argv {
    return argv
    .positional("files", {
        type:     "string",
        describe: "Markdown files to preview"
    })
    .option("outputDir", {
        type:     "string",
        describe: "Write generated files here; required in non-interactive mode, optional (defaults to temp dir) in interactive mode"
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


/**
 * Fields shared by both interactive and non-interactive preview configurations.
 */
interface IPreviewConfigBase {
    inputFiles:          Array<File>;
    indentSections:      boolean;
    collapsibleSections: boolean;
}

/**
 * Configuration for an interactive preview session: serves files over HTTP,
 * opens a browser, and watches for changes until the user presses a key.
 * `outputDir` is optional; when absent a managed temp directory is used.
 */
interface IInteractiveConfig extends IPreviewConfigBase {
    interactive: true;
    outputDir:   Option<Directory>;
}

/**
 * Configuration for a non-interactive (headless) preview session: renders
 * markdown to HTML in the named output directory and exits immediately.
 * `outputDir` is required because there is no server and no temp-dir cleanup.
 */
interface INonInteractiveConfig extends IPreviewConfigBase {
    interactive: false;
    outputDir:   Directory;
}

/** Discriminated union of the two mutually exclusive preview configurations. */
type IPreviewConfig = IInteractiveConfig | INonInteractiveConfig;


/**
 * Validates and normalizes all CLI arguments into a typed {@link IPreviewConfig}.
 *
 * Merges positional file paths with any lines piped through stdin and validates
 * each file. In non-interactive mode, `--outputDir` is required.
 *
 * @param args - Raw yargs argument map from the `preview` handler.
 * @returns A succeeded result containing the config, or a failed result with an
 *          error message.
 */
async function getConfiguration(args: Arguments): Promise<Result<IPreviewConfig, string>> {
    const rawFiles = args.files as Array<string> | string | undefined;
    const positionalPaths =
        Array.isArray(rawFiles)      ? rawFiles :
        typeof rawFiles === "string" ? [rawFiles] :
        [];

    const stdinLines = await getStdinPipedLines();
    const mergedPaths = [...positionalPaths, ...stdinLines];

    const filesRes = await validateAndNormalizeInputs(mergedPaths);
    if (filesRes.failed) {
        return filesRes;
    }
    const inputFiles = filesRes.value;

    const interactive  = process.stdin.isTTY && process.stdout.isTTY;
    const rawOutputDir = args.outputDir as string | undefined;
    const base = {
        inputFiles,
        indentSections:      args.indentSections as boolean,
        collapsibleSections: args.collapsibleSections as boolean
    };

    if (!interactive) {
        if (rawOutputDir === undefined) {
            console.error("Non-interactive mode requires --outputDir.");
            return new FailedResult("Non-interactive mode requires --outputDir.");
        }
        const outputDir   = new Directory(rawOutputDir);
        const conflicting = findSourcesInsideOutputDir(inputFiles, outputDir);
        if (conflicting.length > 0) {
            console.error("Refusing to run: the output directory would contain (and delete) these source files:");
            for (const f of conflicting) {
                console.error(`  - ${f.absPath()}`);
            }
            return new FailedResult("Source files conflict with the output directory.");
        }
        return new SucceededResult({ ...base, interactive: false, outputDir });
    }

    const outputDir: Option<Directory> = rawOutputDir !== undefined ?
        new SomeOption(new Directory(rawOutputDir)) :
        NoneOption.get();

    if (outputDir.isSome) {
        const conflicting = findSourcesInsideOutputDir(inputFiles, outputDir.value);
        if (conflicting.length > 0) {
            console.error("Refusing to run: the output directory would contain (and delete) these source files:");
            for (const f of conflicting) {
                console.error(`  - ${f.absPath()}`);
            }
            return new FailedResult("Source files conflict with the output directory.");
        }
    }

    return new SucceededResult({ ...base, interactive: true, outputDir });
}


/**
 * Yargs command handler for the `preview` sub-command.
 *
 * Calls {@link getConfiguration}, then delegates to {@link previewImpl}. Exits
 * the process with a non-zero code on validation or runtime failure.
 *
 * @param args - Raw yargs argument map.
 */
export async function handler(args: Arguments): Promise<void> {
    try {
        const configRes = await getConfiguration(args);
        if (configRes.failed) {
            process.exit(EXIT_INVALID_INPUT);
        }

        const exitCode = await previewImpl(configRes.value);
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
 * Mutable state shared between all live components during a preview session:
 * the HTTP server, file watchers, live-reload SSE clients, and shutdown flag.
 */
export interface IRuntimeState {
    outputDir:          Directory;
    shouldDeleteOnExit: boolean;
    server:             Option<http.Server>;
    serverSockets:      Set<net.Socket>;
    reloadClients:      Set<http.ServerResponse>;
    watchers:           Array<FSWatcher>;
    debouncer:          Option<IDebouncer>;
    shuttingDown:       boolean;
}


/**
 * Core preview implementation. Dispatches to {@link nonInteractiveImpl} for
 * non-interactive sessions; runs the full interactive loop (HTTP server, browser
 * launch, file watching, keypress-to-exit) for interactive sessions.
 *
 * @param config - Validated preview configuration.
 * @returns Process exit code (`EXIT_SUCCESS` or `EXIT_RUNTIME_FAILURE`).
 */
async function previewImpl(config: IPreviewConfig): Promise<number> {
    if (!config.interactive) {
        return nonInteractiveImpl(config);
    }

    const { indentSections, collapsibleSections } = config;

    const outputDirectory = await prepareOutputDirectory(config.outputDir);
    console.log(`Output directory: ${outputDirectory.dir.toString()}`);
    console.warn("Warning: raw HTML rendering is enabled. Use only trusted content.");

    const runtimeState: IRuntimeState = {
        outputDir:          outputDirectory.dir,
        shouldDeleteOnExit: outputDirectory.shouldDeleteOnExit,
        server:             NoneOption.get(),
        serverSockets:      new Set<net.Socket>(),
        reloadClients:      new Set<http.ServerResponse>(),
        watchers:           [],
        debouncer:          NoneOption.get(),
        shuttingDown:       false
    };

    registerSignalHandlers(runtimeState);

    try {
        const renderResult = await renderFilesToDir(
            config.inputFiles,
            outputDirectory.dir,
            true,   // always enable live-reload in interactive mode
            indentSections,
            collapsibleSections
        );
        await writeSharedStylesheet(outputDirectory.dir, indentSections, collapsibleSections);

        console.log(`Accepted files: ${config.inputFiles.length}`);
        console.log(`Rendered files: ${renderResult.renderedCount}`);

        const server = await startServer(
            outputDirectory.dir,
            runtimeState.serverSockets,
            runtimeState.reloadClients,
            true    // always enable live-reload in interactive mode
        );
        runtimeState.server = new SomeOption(server);

        const addressInfo = server.address();
        if (!addressInfo || typeof addressInfo === "string") {
            throw new Error("Unable to determine bound server address.");
        }

        const port = addressInfo.port;
        const urls = buildPreviewUrls(port, safeGetExternalIpv4Address());
        const localUrl = urls.localUrl;
        console.log(`Local URL: ${localUrl}`);

        if (urls.lanUrl.isSome) {
            console.log(`LAN URL: ${urls.lanUrl.value}`);
        }
        else {
            console.warn("LAN URL unavailable: no external IPv4 address found.");
        }

        launchBrowser(localUrl);
        console.log("Browser launch: attempted");

        startWatching(config.inputFiles, runtimeState, indentSections, collapsibleSections);
        console.log("Watching source files for changes. Refresh the browser after each re-render.");

        await waitForAnyKeypress();
        console.log("Shutdown reason: keypress");

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


/**
 * Non-interactive implementation: renders all input files to HTML in the named
 * output directory and exits immediately without starting an HTTP server.
 *
 * @param config - Validated non-interactive preview configuration.
 * @returns Process exit code (`EXIT_SUCCESS` or `EXIT_RUNTIME_FAILURE`).
 */
async function nonInteractiveImpl(config: INonInteractiveConfig): Promise<number> {
    try {
        await config.outputDir.ensureExists();
        await renderFilesToDir(
            config.inputFiles,
            config.outputDir,
            false,  // no live-reload in non-interactive mode
            config.indentSections,
            config.collapsibleSections
        );
        await writeSharedStylesheet(config.outputDir, config.indentSections, config.collapsibleSections);
        console.log(`Rendered ${config.inputFiles.length} file(s) to: ${config.outputDir.absPath()}`);
        return EXIT_SUCCESS;
    }
    catch (err) {
        console.error("Runtime failure.");
        console.error(formatError(err));
        return EXIT_RUNTIME_FAILURE;
    }
}


/**
 * Pauses execution until the user presses any key on stdin.
 *
 * Puts stdin into raw mode while waiting so that the keypress is captured
 * without requiring Enter.
 */
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


/**
 * Registers SIGINT and SIGTERM handlers so that Ctrl-C and process termination
 * both trigger a graceful {@link cleanupRuntime} before exiting.
 *
 * @param runtimeState - Live state to clean up on signal.
 */
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


/**
 * Returns the machine's first external IPv4 address, or `NoneOption` if none
 * can be determined. Swallows errors so callers do not need to handle the case
 * where network introspection fails.
 */
function safeGetExternalIpv4Address(): Option<string> {
    try {
        const value = getFirstExternalIpv4Address();
        return value ? new SomeOption(value) : NoneOption.get();
    }
    catch {
        return NoneOption.get();
    }
}


/**
 * Deduplicates, validates extension, and checks file existence for a list of
 * candidate markdown paths.
 *
 * @param paths - Absolute or relative path strings to evaluate.
 * @returns A succeeded result with the unique, existing `File` objects, or a
 *          failed result if any path is invalid or no markdown files were given.
 */
export async function validateAndNormalizeInputs(
    paths: Array<string>
): Promise<Result<Array<File>, string>> {
    const seen    = new Set<string>();
    const invalid: Array<string> = [];
    const valid:   Array<File>   = [];

    for (const candidate of paths) {
        const file = new File(candidate);
        const key  = file.absPath();

        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        const ext = file.extName.toLowerCase();
        if (ext !== ".md" && ext !== ".markdown") {
            invalid.push(candidate);
            continue;
        }

        const stats = await file.exists();
        if (!stats?.isFile()) {
            invalid.push(candidate);
            continue;
        }

        valid.push(file);
    }

    if (invalid.length > 0) {
        console.error("Invalid input paths:");
        for (const cur of invalid) {
            console.error(`  - ${cur}`);
        }
        return new FailedResult("One or more input paths are invalid.");
    }

    if (valid.length === 0) {
        console.error("No valid markdown files were provided.");
        console.error("Usage: md-tools preview [files...] [--outputDir <path>]");
        return new FailedResult("No valid markdown files were provided.");
    }

    return new SucceededResult(valid);
}


/**
 * Builds the local and LAN preview URLs from the server port and an optional
 * external IP address.
 *
 * @param port    - The TCP port the HTTP server is listening on.
 * @param lanHost - External IPv4 address option; `NoneOption` if unavailable.
 * @returns An object with `localUrl` (always present) and `lanUrl` as an
 *          `Option<string>`.
 */
export function buildPreviewUrls(port: number, lanHost: Option<string>):
{ localUrl: string; lanUrl: Option<string>; } {
    const localUrl = `http://localhost:${port}/`;

    if (lanHost.isSome) {
        return {
            localUrl,
            lanUrl: new SomeOption(`http://${lanHost.value}:${port}/`)
        };
    }

    return { localUrl, lanUrl: NoneOption.get() };
}


/**
 * Returns the `File` path where the rendered HTML for a given markdown source
 * should be written.
 *
 * @param dir      - Directory to write into.
 * @param baseName - The markdown file's base name without extension.
 * @returns The corresponding `.html` output `File`.
 */
export function getOutputHtmlPath(dir: Directory, baseName: string): File {
    return new File(dir, `${baseName}.html`);
}


/**
 * Describes the output directory ready to receive rendered files, along with a
 * flag indicating whether it should be deleted when the preview session ends.
 */
interface IPreparedOutputDirectory {
    dir:                Directory;
    shouldDeleteOnExit: boolean;
}


/**
 * Resolves or creates the output directory for an interactive preview session.
 *
 * If no explicit `outputDir` was requested, a managed temp directory with a
 * 7-day lifetime is created (explicit cleanup on normal exit; expiry-based
 * cleanup handles orphaned directories from killed sessions). If a named
 * directory was requested, it is created or (if non-empty) emptied after user
 * confirmation.
 *
 * @param outputDirOpt - The caller-supplied output directory, if any.
 * @returns A {@link IPreparedOutputDirectory} with the resolved directory and a
 *          deletion-on-exit flag.
 */
async function prepareOutputDirectory(
    outputDirOpt: Option<Directory>
): Promise<IPreparedOutputDirectory> {
    if (outputDirOpt.isNone) {
        const res = await createTempDir("md-preview", 7 * 24 * 60 * 60 * 1000);
        if (res.failed) {
            throw new Error(`Failed to create temp directory: ${res.error}`);
        }
        return { dir: res.value, shouldDeleteOnExit: true };
    }

    const outputDir = outputDirOpt.value;
    await prepareNamedOutputDirectory(outputDir, true, async () => {
        return promptToContinue(
            `The output directory "${outputDir.toString()}" is not empty. Delete its contents?`,
            false
        );
    });

    return { dir: outputDir, shouldDeleteOnExit: false };
}


/**
 * Ensures a named output directory is ready to receive rendered files.
 *
 * - Creates the directory if it does not exist.
 * - Returns immediately if it already exists and is empty.
 * - In interactive mode, prompts the user to confirm emptying a non-empty directory.
 * - In non-interactive mode, throws if the directory is non-empty.
 *
 * @param outputDir       - Target output directory.
 * @param interactive     - Whether the process is running in interactive (TTY) mode.
 * @param confirmDeletion - Callback that asks the user for confirmation before
 *                          emptying the directory.
 */
export async function prepareNamedOutputDirectory(
    outputDir:       Directory,
    interactive:     boolean,
    confirmDeletion: () => Promise<boolean>
): Promise<void> {
    const outputDirectory = outputDir.absolute();

    const stats = await outputDirectory.exists();
    if (!stats) {
        // Path doesn't exist as a directory; check for a non-directory at the same path.
        try {
            await fs.stat(outputDirectory.absPath());
            throw new Error(`Output path exists and is not a directory: ${outputDirectory.absPath()}`);
        }
        catch (err) {
            const error = err as NodeJS.ErrnoException;
            if (error.code !== "ENOENT") {
                throw err;
            }
        }

        await outputDirectory.ensureExists();
        return;
    }

    if (await outputDirectory.isEmpty()) {
        return;
    }

    if (!interactive) {
        throw new Error(
            `The output directory "${outputDirectory.absPath()}" is not empty and cannot be confirmed in non-interactive mode.`
        );
    }

    const confirmed = await confirmDeletion();
    if (!confirmed) {
        throw new Error("Canceled by user because output directory cleanup was not confirmed.");
    }

    await outputDirectory.empty();
}


/** Summary of a completed render pass. */
interface IRenderResult {
    renderedCount: number;
}


/**
 * Renders all markdown input files to HTML and writes them into `outputDir`.
 *
 * @param inputs             - Source markdown files to render.
 * @param outputDir          - Directory to write rendered HTML into.
 * @param liveReload         - Whether to inject the live-reload SSE client script.
 * @param indentSections     - Whether to apply section indentation CSS/markup.
 * @param collapsibleSections - Whether to make sections collapse/expand on click.
 * @returns A result object with the count of successfully rendered files.
 */
export async function renderFilesToDir(
    inputs:              Array<File>,
    outputDir:           Directory,
    liveReload           = false,
    indentSections       = false,
    collapsibleSections  = false
): Promise<IRenderResult> {
    const renderer = createRenderer(indentSections, collapsibleSections);

    for (const input of inputs) {
        const sourceText    = await input.read();
        const rewrittenText = await rewriteAndCopyAssets(sourceText, input.absPath(), outputDir.absPath());
        const rendered      = renderer.render(rewrittenText);
        const document      = wrapHtmlDocument(input.baseName, rendered, liveReload, collapsibleSections);
        const outFile       = getOutputHtmlPath(outputDir, input.baseName);
        await outFile.write(document);
    }

    return { renderedCount: inputs.length };
}


/**
 * Identifies input files whose absolute paths fall inside the output directory.
 *
 * Used as a safety check: if the user specifies an output directory that
 * overlaps with a source file, continuing would delete that source file.
 *
 * @param inputs    - Array of source markdown files.
 * @param outputDir - The requested output directory.
 * @returns The subset of `inputs` that are located inside `outputDir`.
 */
export function findSourcesInsideOutputDir(
    inputs:    Array<File>,
    outputDir: Directory
): Array<File> {
    return inputs.filter((file) => file.isWithin(outputDir, true));
}


/**
 * Registers `node:fs` watchers on each directory that contains an input file.
 *
 * File-change events are debounced to avoid triggering a re-render for every
 * rapid-fire event. Changes to files inside the output directory are ignored
 * to prevent re-render loops caused by the render writing new files.
 *
 * @param inputs             - Source files to watch.
 * @param runtimeState       - Mutable runtime state; receives watcher handles and
 *                             the debouncer.
 * @param indentSections     - Forwarded to {@link renderFilesToDir}.
 * @param collapsibleSections - Forwarded to {@link renderFilesToDir}.
 */
function startWatching(
    inputs:             Array<File>,
    runtimeState:       IRuntimeState,
    indentSections:     boolean,
    collapsibleSections: boolean
): void {
    const watchedFiles = new Set(inputs.map((f) => f.absPath()));
    const watchedDirs  = new Set(inputs.map((f) => f.directory.absPath()));

    let renderChain: Promise<void> = Promise.resolve();

    const rerender = async (): Promise<void> => {
        try {
            const result = await renderFilesToDir(
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
    runtimeState.debouncer = new SomeOption(debouncer);

    for (const dir of watchedDirs) {
        try {
            const watcher = watch(dir, (_eventType, filename) => {
                if (filename === null) {
                    debouncer.schedule();
                    return;
                }

                const changedFile = new File(path.resolve(dir, filename));

                if (changedFile.isWithin(runtimeState.outputDir, true)) {
                    return;
                }

                if (watchedFiles.has(changedFile.absPath())) {
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


/**
 * Sends a `reload` SSE event to every connected live-reload client.
 *
 * @param reloadClients - Set of open SSE response streams.
 */
export function notifyReloadClients(reloadClients: Set<http.ServerResponse>): void {
    for (const client of reloadClients) {
        try {
            client.write("event: reload\ndata: {}\n\n");
        }
        catch (err) {
            console.warn(`Live-reload notification failed: ${formatError(err)}`);
        }
    }
}


/**
 * Converts a heading string to a GitHub-Flavored Markdown anchor slug.
 *
 * Mirrors GitHub's behaviour: lower-case, strip non-word/non-space/non-hyphen
 * characters, trim, then replace whitespace runs with a single `-`.
 *
 * @param str - Heading text.
 * @returns URL-safe anchor slug.
 */
function gfmSlugify(str: string): string {
    const lower      = str.toLowerCase();
    const stripped   = lower.replace(/[^\w\s-]/g, "");
    const trimmed    = stripped.trim();
    const hyphenated = trimmed.replace(/\s+/g, "-");
    return hyphenated.replace(/-+/g, "-");
}


/**
 * Constructs a configured `markdown-it` instance with all required plugins
 * (footnotes, emoji, task lists, anchors, definition lists, code highlighting)
 * and optional section-structure plugins.
 *
 * @param indentSections     - Apply {@link sectionWrappingPlugin} for CSS indentation.
 * @param collapsibleSections - Apply {@link jsCollapsibleSectionPlugin} for
 *                             click-to-collapse behaviour.
 * @returns Configured `markdown-it` renderer.
 */
export function createRenderer(indentSections = false, collapsibleSections = false): markdownIt {
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


/**
 * `markdown-it` core rule plugin that wraps each heading and its following
 * content in a `<section>` element.
 *
 * Enables CSS indentation of section bodies via `.md-section` class. A new
 * section is opened at each heading and closed when a heading of equal or
 * higher level is encountered.
 *
 * @param md - The `markdown-it` instance to register the rule on.
 */
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


/**
 * `markdown-it` core rule plugin that wraps each section in a `<section>` +
 * `<div class="md-section-body">` structure, allowing JavaScript to collapse
 * and expand sections by toggling a CSS class.
 *
 * @param md - The `markdown-it` instance to register the rule on.
 */
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


/**
 * Wraps rendered HTML body content in a full HTML document, adding the shared
 * stylesheet link, optional live-reload script, and optional collapsible-section
 * toolbar and script.
 *
 * @param title              - Document `<title>` text.
 * @param bodyHtml           - Rendered markdown body HTML.
 * @param liveReload         - Whether to inject the live-reload SSE client.
 * @param collapsibleSections - Whether to inject the collapsible-section toolbar
 *                             and JavaScript.
 * @returns A complete HTML document string.
 */
export function wrapHtmlDocument(
    title:              string,
    bodyHtml:           string,
    liveReload          = false,
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


/**
 * Returns an inline `<script>` block that connects to the live-reload SSE
 * endpoint and triggers `window.location.reload()` when a `reload` event
 * arrives.
 */
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


/**
 * Returns an inline `<script>` block that makes each `.md-section` heading a
 * click-to-toggle that shows or hides its section body.
 *
 * Persists expand/collapse state across navigations using `sessionStorage`. Also
 * wires up "Expand all" and "Collapse all" toolbar buttons.
 */
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


/**
 * Returns the HTML lines for the "Expand all / Collapse all" toolbar, rendered
 * as a sticky bar above the markdown body when collapsible sections are active.
 */
function toolbarHtmlLines(): Array<string> {
    return [
        "  <div class=\"md-preview-toolbar\" role=\"toolbar\" aria-label=\"Section controls\">",
        "    <button type=\"button\" class=\"md-preview-toolbar__button\" data-md-preview-expand-all>Expand all</button>",
        "    <button type=\"button\" class=\"md-preview-toolbar__button\" data-md-preview-collapse-all>Collapse all</button>",
        "  </div>"
    ];
}


/**
 * Composes the preview stylesheet from the bundled VS Code CSS files and any
 * active section-layout options, then writes it as `md-preview.css` into the
 * output directory.
 *
 * Falls back to a minimal inline stylesheet if the bundled CSS assets are not
 * found (e.g. during tests run against the TypeScript source tree).
 *
 * @param outputDir          - Output directory to write the stylesheet into.
 * @param indentSections     - Whether to include section-indent CSS.
 * @param collapsibleSections - Whether to include collapsible-section CSS.
 */
async function writeSharedStylesheet(
    outputDir:          Directory,
    indentSections      = false,
    collapsibleSections = false
): Promise<void> {
    const vscodeCssPath          = fileURLToPath(new URL("../assets/vscode-markdown.css", import.meta.url));
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

    await new File(outputDir, "md-preview.css").write(cssText);
}


/**
 * Assembles the final stylesheet string from constituent CSS blocks.
 *
 * @param vscodeCssText      - VS Code markdown theme CSS.
 * @param highlightCssText   - Syntax-highlighting theme CSS.
 * @param indentSections     - Whether to append {@link sectionIndentCss}.
 * @param collapsibleSections - Whether to append {@link collapsibleSectionCss}.
 * @returns The concatenated stylesheet string.
 */
export function composeStylesheet(
    vscodeCssText:      string,
    highlightCssText:   string,
    indentSections      = false,
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


/**
 * Returns the CSS rule that indents each `.md-section`'s non-heading children,
 * creating a visual nesting hierarchy that mirrors heading depth.
 */
function sectionIndentCss(): string {
    return [
        "",
        ".markdown-body .md-section > :not(:first-child) {",
        "  margin-inline-start: 1.5em;",
        "}",
        ""
    ].join("\n");
}


/**
 * Returns the CSS rules for the sticky toolbar, collapsible-section toggle
 * behaviour (hiding `.md-section-body` when collapsed), and heading cursor
 * affordance.
 */
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


/**
 * Rewrites relative asset URLs in markdown text so they point to copies inside
 * the output directory, then copies each referenced file there.
 *
 * Only rewrites local, relative paths — absolute URLs, data URIs, and
 * fragment-only references are left unchanged.
 *
 * @param markdownText - Raw markdown source.
 * @param sourceFile   - Absolute path of the markdown file (used to resolve
 *                       relative asset references).
 * @param outputDir    - Absolute path of the output directory to copy assets into.
 * @returns The markdown text with asset URLs rewritten to relative paths under
 *          `outputDir`.
 */
export async function rewriteAndCopyAssets(
    markdownText: string,
    sourceFile:   string,
    outputDir:    string
): Promise<string> {
    const sourceDir = path.dirname(sourceFile);

    const markdownLinkRegex = /(?<prefix>!?\[[^\]]*\]\()(?<target>[^)]+)(?<suffix>\))/g;
    const htmlAttrRegex = /(?<prefix><(?:img|a)\b[^>]*?\s(?:src|href)=")(?<target>[^"]+)(?<suffix>"[^>]*>)/g;

    let updated = markdownText;
    updated = await rewriteMatches(updated, markdownLinkRegex, sourceDir, outputDir);
    updated = await rewriteMatches(updated, htmlAttrRegex, sourceDir, outputDir);
    return updated;
}


/**
 * Applies {@link resolveRewrittenTarget} to every match of `regex` in `text`,
 * replacing each matched target URL in place.
 *
 * The regex must contain named capture groups `prefix`, `target`, and `suffix`.
 *
 * @param text      - Source text to process.
 * @param regex     - A global regex with `prefix`/`target`/`suffix` groups.
 * @param sourceDir - Directory of the source markdown file.
 * @param outputDir - Destination directory for copied assets.
 * @returns The text with all rewritten target URLs substituted.
 */
async function rewriteMatches(
    text:      string,
    regex:     RegExp,
    sourceDir: string,
    outputDir: string
): Promise<string> {
    const matches = Array.from(text.matchAll(regex));
    let result = text;

    for (const match of matches) {
        const full   = match[0];
        const prefix = match.groups?.prefix;
        const target = match.groups?.target;
        const suffix = match.groups?.suffix;

        if (!full || !prefix || !target || !suffix) {
            continue;
        }

        const replacementTarget = await resolveRewrittenTarget(target, sourceDir, outputDir);
        const replacement = `${prefix}${replacementTarget}${suffix}`;
        result = result.replace(full, replacement);
    }

    return result;
}


/**
 * Resolves a single asset reference from the markdown source, copies the file
 * into `outputDir`, and returns the rewritten relative path.
 *
 * Returns the original `target` unchanged when it is an absolute URL, fragment,
 * or when the referenced file cannot be found.
 *
 * @param target    - The original URL/path as it appears in the markdown.
 * @param sourceDir - Directory of the markdown source file.
 * @param outputDir - Destination directory for the copied asset.
 * @returns The path the browser should use to load the asset.
 */
async function resolveRewrittenTarget(target: string, sourceDir: string, outputDir: string): Promise<string> {
    if (isAbsoluteUrlOrFragment(target)) {
        return target;
    }

    const sourceAssetPath   = path.resolve(sourceDir, target);
    const normalizedRelative = target.replaceAll("\\", "/").replace(/^\/+/, "");
    const destinationPath   = path.join(outputDir, normalizedRelative);

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


/**
 * Returns `true` when `target` is an absolute URL, a protocol-relative URL, a
 * data URI, a mailto link, a file URI, or a fragment-only reference (`#…`).
 *
 * Used to skip rewriting asset references that are not local relative paths.
 *
 * @param target - URL string to test.
 */
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


/**
 * Launches the default browser to open `url` using the platform-appropriate
 * shell command (`start` on Windows, `open` on macOS, `xdg-open` on Linux).
 *
 * Fire-and-forget: errors are silently ignored.
 *
 * @param url - URL to open.
 */
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


/**
 * Starts an HTTP file server that serves static files from `rootDir`.
 *
 * Features:
 * - Directory listing for paths that resolve to a directory.
 * - Content-type detection by file extension.
 * - Path traversal protection (requests outside `rootDir` receive 403).
 * - If `liveReloadEnabled`, requests to `LIVE_RELOAD_PATH` are handled as
 *   Server-Sent Event streams.
 *
 * Binds to a random available port on all interfaces (`0.0.0.0`).
 *
 * @param rootDir           - Directory to serve files from.
 * @param serverSockets     - Set to track open sockets for graceful shutdown.
 * @param reloadClients     - Set to track open SSE response streams.
 * @param liveReloadEnabled - Whether to handle SSE live-reload requests.
 * @returns The bound `http.Server` instance.
 */
export async function startServer(
    rootDir:           Directory,
    serverSockets:     Set<net.Socket>,
    reloadClients:     Set<http.ServerResponse>,
    liveReloadEnabled: boolean
): Promise<http.Server> {
    const rootDirPath = rootDir.absPath();

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
                const fsPath      = path.join(rootDirPath, decodedPath);

                const normalized = path.normalize(fsPath);
                if (!normalized.startsWith(path.normalize(rootDirPath))) {
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
                        const href   = path.posix.join(decodedPath.replaceAll("\\", "/"), entry.name) + suffix;
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

                const fileBuffer  = await fs.readFile(normalized);
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


/**
 * Maps a file extension to an HTTP `Content-Type` header value.
 *
 * @param filePath - Absolute or relative file path; only the extension is used.
 * @returns MIME type string, defaulting to `application/octet-stream`.
 */
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


/**
 * Gracefully tears down all live components: debouncer, file watchers, SSE
 * clients, HTTP server (with socket drain), and (if applicable) the temp output
 * directory.
 *
 * Idempotent — a second call while cleanup is in progress returns immediately.
 *
 * @param runtimeState - The runtime state to clean up.
 */
async function cleanupRuntime(runtimeState: IRuntimeState): Promise<void> {
    if (runtimeState.shuttingDown) {
        return;
    }
    runtimeState.shuttingDown = true;

    if (runtimeState.debouncer.isSome) {
        runtimeState.debouncer.value.cancel();
        runtimeState.debouncer = NoneOption.get();
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
        if (runtimeState.server.isSome) {
            const server = runtimeState.server.value;
            await new Promise<void>((resolve) => {
                let resolved = false;
                const finish = (): void => {
                    if (!resolved) {
                        resolved = true;
                        resolve();
                    }
                };

                server.close(() => {
                    finish();
                });

                if (typeof server.closeAllConnections === "function") {
                    server.closeAllConnections();
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
        console.log(`Cleanup: preserved output directory ${runtimeState.outputDir.toString()}`);
        return;
    }

    try {
        await runtimeState.outputDir.delete();
        console.log(`Cleanup: deleted temp directory ${runtimeState.outputDir.toString()}`);
    }
    catch (err) {
        console.warn(`Cleanup warning while deleting temp directory: ${formatError(err)}`);
    }
}


/**
 * Escapes the five HTML special characters (`&`, `<`, `>`, `"`, `'`) so that a
 * string can be safely embedded in an HTML attribute or text node.
 *
 * @param value - Plain-text string to escape.
 * @returns HTML-escaped string.
 */
function escapeHtml(value: string): string {
    return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}


/**
 * Converts an unknown thrown value to a human-readable string.
 *
 * @param err - Any thrown value.
 * @returns `"<name>: <message>"` for `Error` instances, or `String(err)` otherwise.
 */
function formatError(err: unknown): string {
    if (err instanceof Error) {
        return `${err.name}: ${err.message}`;
    }
    return String(err);
}
