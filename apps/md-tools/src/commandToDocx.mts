import * as cp from "node:child_process";
import type { Argv, Arguments } from "yargs";
import { Result, SucceededResult, FailedResult } from "@repo/depot/result";
import { Option, SomeOption, NoneOption } from "@repo/depot/option";
import { File } from "@repo/depot-node/file";
import { Directory } from "@repo/depot-node/directory";
import { getStdinPipedLines } from "@repo/depot-node/ttyHelpers";
import { validateAndNormalizeInputs } from "./commandPreview.mjs";


const EXIT_SUCCESS         = 0;
const EXIT_RUNTIME_FAILURE = 2;


export const command  = "to-docx [files...]";
export const describe = "Convert markdown files to Microsoft Word (.docx) format using pandoc";


/**
 * Registers yargs positional arguments and options for the `to-docx` sub-command.
 *
 * @param argv - The yargs instance provided by the parent command.
 * @returns The yargs instance with to-docx-specific options attached.
 */
export function builder(argv: Argv): Argv {
    return argv
    .positional("files", {
        type:     "string",
        describe: "Markdown files to convert"
    })
    .option("outputDir", {
        type:     "string",
        describe: "Write generated .docx files to this directory (default: same directory as each source file)"
    })
    .option("reference-doc", {
        type:     "string",
        describe: "Path to a .docx file whose styles pandoc will use as a template"
    });
}


interface IToDocxConfig {
    inputFiles:   Array<File>;
    outputDir:    Option<Directory>;
    referenceDoc: Option<File>;
}


async function getConfiguration(args: Arguments): Promise<Result<IToDocxConfig, string>> {
    const rawFiles     = args.files as Array<string> | string | undefined;
    const positional   = Array.isArray(rawFiles) ? rawFiles :
        typeof rawFiles === "string"             ? [rawFiles] :
        [];

    const stdinLines  = await getStdinPipedLines();
    const mergedPaths = [...positional, ...stdinLines];

    const filesRes = await validateAndNormalizeInputs(mergedPaths);
    if (filesRes.failed) {
        return filesRes;
    }

    const rawOutputDir = args.outputDir as string | undefined;
    const outputDir: Option<Directory> = rawOutputDir !== undefined ?
        new SomeOption(new Directory(rawOutputDir)) :
        NoneOption.get();

    const rawReferenceDoc = args["reference-doc"] as string | undefined;
    if (rawReferenceDoc !== undefined) {
        const refDocFile = new File(rawReferenceDoc);
        const stats = await refDocFile.exists();
        if (!stats?.isFile()) {
            console.error(
                `Error: --reference-doc file not found or is not a file: ${refDocFile.absPath()}`
            );
            return new FailedResult(`--reference-doc file not found: ${refDocFile.absPath()}`);
        }
        return new SucceededResult({
            inputFiles:   filesRes.value,
            outputDir,
            referenceDoc: new SomeOption(refDocFile)
        });
    }

    return new SucceededResult({
        inputFiles:   filesRes.value,
        outputDir,
        referenceDoc: NoneOption.get()
    });
}


/**
 * Yargs command handler for the `to-docx` sub-command.
 *
 * Calls {@link getConfiguration}, then delegates to {@link toDocxImpl}. Exits
 * the process with a non-zero code on validation or runtime failure.
 *
 * @param args - Raw yargs argument map.
 */
export async function handler(args: Arguments): Promise<void> {
    try {
        const configRes = await getConfiguration(args);
        if (configRes.failed) {
            process.exit(EXIT_RUNTIME_FAILURE);
        }

        const exitCode = await toDocxImpl(configRes.value);
        if (exitCode !== EXIT_SUCCESS) {
            process.exit(exitCode);
        }
    }
    catch (err) {
        console.error("Fatal error while running md-tools to-docx.");
        console.error(formatError(err));
        process.exit(EXIT_RUNTIME_FAILURE);
    }
}


async function toDocxImpl(config: IToDocxConfig): Promise<number> {
    const pandocAvailable = await isPandocAvailable();
    if (!pandocAvailable) {
        console.error("Error: pandoc is not installed or not on PATH.");
        console.error("Install it with: winget install pandoc");
        return EXIT_RUNTIME_FAILURE;
    }

    if (config.outputDir.isSome) {
        await config.outputDir.value.ensureExists();
    }

    let failureCount = 0;
    for (const input of config.inputFiles) {
        const destDir  = config.outputDir.isSome ?
            config.outputDir.value :
            input.directory;
        const outFile  = new File(destDir, `${input.baseName}.docx`);

        const pandocArgs = [
            input.absPath(),
            "-o", outFile.absPath(),
            "--from", "markdown",
            "--to", "docx",
            "--resource-path", input.directory.absPath()
        ];

        if (config.referenceDoc.isSome) {
            pandocArgs.push("--reference-doc", config.referenceDoc.value.absPath());
        }

        console.log(`Converting: ${input.absPath()}`);
        const result = await runPandoc(pandocArgs);

        if (result.exitCode === 0) {
            if (result.stderr.length > 0) {
                for (const line of result.stderr.split(/\r?\n/).filter((l) => l.length > 0)) {
                    console.warn(`  [pandoc] ${line}`);
                }
            }
            console.log(`  -> ${outFile.absPath()}`);
        }
        else {
            console.error(`  Error converting ${input.absPath()}:`);
            for (const line of result.stderr.split(/\r?\n/).filter((l) => l.length > 0)) {
                console.error(`  [pandoc] ${line}`);
            }
            failureCount++;
        }
    }

    if (failureCount > 0) {
        console.error(`\n${failureCount} of ${config.inputFiles.length} file(s) failed to convert.`);
        return EXIT_RUNTIME_FAILURE;
    }

    console.log(`\nConverted ${config.inputFiles.length} file(s) successfully.`);
    return EXIT_SUCCESS;
}


async function isPandocAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
        cp.exec("pandoc --version", (err) => resolve(err === null));
    });
}


interface IPandocResult {
    exitCode: number;
    stderr:   string;
}


function runPandoc(args: Array<string>): Promise<IPandocResult> {
    return new Promise((resolve) => {
        const stderrChunks: Array<Buffer> = [];
        const child = cp.spawn("pandoc", args, { stdio: ["ignore", "ignore", "pipe"] });

        child.stderr.on("data", (chunk: Buffer) => stderrChunks.push(chunk));

        child.once("error", () => {
            resolve({ exitCode: 1, stderr: Buffer.concat(stderrChunks).toString("utf8") });
        });

        child.once("close", (code) => {
            resolve({
                exitCode: code ?? 1,
                stderr:   Buffer.concat(stderrChunks).toString("utf8")
            });
        });
    });
}


function formatError(err: unknown): string {
    if (err instanceof Error) {
        return `${err.name}: ${err.message}`;
    }
    return String(err);
}
