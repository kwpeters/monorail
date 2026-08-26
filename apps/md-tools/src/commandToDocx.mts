import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as cp from "node:child_process";
import type { Argv, Arguments } from "yargs";
import { validateAndNormalizeInputs } from "./commandPreview.mjs";


const EXIT_SUCCESS        = 0;
const EXIT_INVALID_INPUT  = 1;
const EXIT_RUNTIME_FAILURE = 2;

export const command  = "to-docx [files...]";
export const describe = "Convert markdown files to Microsoft Word (.docx) format using pandoc";


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


export async function handler(args: Arguments): Promise<void> {
    const outputDir    = args.outputDir as string | undefined;
    const referenceDoc = args["reference-doc"] as string | undefined;
    const rawFiles     = args.files as Array<string> | string | undefined;
    const positional   = Array.isArray(rawFiles) ? rawFiles :
        typeof rawFiles === "string"             ? [rawFiles] :
        [];

    try {
        const exitCode = await toDocxImpl(positional, outputDir, referenceDoc);
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


async function toDocxImpl(
    positionalPaths: Array<string>,
    outputDir: string | undefined,
    referenceDoc: string | undefined
): Promise<number> {
    const pipedPaths = await readPipedPaths();

    const validation = await validateAndNormalizeInputs(positionalPaths, pipedPaths);
    if (!validation.succeeded) {
        return validation.exitCode;
    }
    const inputs = validation.inputs;

    // Verify pandoc is available before doing any work.
    const pandocAvailable = await isPandocAvailable();
    if (!pandocAvailable) {
        console.error("Error: pandoc is not installed or not on PATH.");
        console.error("Install it with: winget install pandoc");
        return EXIT_RUNTIME_FAILURE;
    }

    // Validate reference-doc if provided.
    if (referenceDoc !== undefined) {
        const refDocPath = path.resolve(referenceDoc);
        try {
            const stats = await fs.stat(refDocPath);
            if (!stats.isFile()) {
                console.error(`Error: --reference-doc is not a file: ${refDocPath}`);
                return EXIT_INVALID_INPUT;
            }
        }
        catch {
            console.error(`Error: --reference-doc file not found: ${refDocPath}`);
            return EXIT_INVALID_INPUT;
        }
    }

    // Prepare output directory if specified.
    if (outputDir !== undefined) {
        const resolvedOutputDir = path.resolve(outputDir);
        try {
            await fs.mkdir(resolvedOutputDir, { recursive: true });
        }
        catch (err) {
            console.error(`Error: could not create output directory: ${resolvedOutputDir}`);
            console.error(formatError(err));
            return EXIT_RUNTIME_FAILURE;
        }
    }

    let failureCount = 0;
    for (const input of inputs) {
        const destDir = outputDir !== undefined
            ? path.resolve(outputDir)
            : path.dirname(input.absolutePath);

        const outputPath = path.join(destDir, `${input.baseName}.docx`);
        const resourcePath = path.dirname(input.absolutePath);

        const pandocArgs = [
            input.absolutePath,
            "-o", outputPath,
            "--from", "markdown",
            "--to", "docx",
            "--resource-path", resourcePath
        ];

        if (referenceDoc !== undefined) {
            pandocArgs.push("--reference-doc", path.resolve(referenceDoc));
        }

        console.log(`Converting: ${input.absolutePath}`);
        const result = await runPandoc(pandocArgs);

        if (result.exitCode === 0) {
            if (result.stderr.length > 0) {
                for (const line of result.stderr.split(/\r?\n/).filter((l) => l.length > 0)) {
                    console.warn(`  [pandoc] ${line}`);
                }
            }
            console.log(`  -> ${outputPath}`);
        }
        else {
            console.error(`  Error converting ${input.absolutePath}:`);
            for (const line of result.stderr.split(/\r?\n/).filter((l) => l.length > 0)) {
                console.error(`  [pandoc] ${line}`);
            }
            failureCount++;
        }
    }

    if (failureCount > 0) {
        console.error(`\n${failureCount} of ${inputs.length} file(s) failed to convert.`);
        return EXIT_RUNTIME_FAILURE;
    }

    console.log(`\nConverted ${inputs.length} file(s) successfully.`);
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


function formatError(err: unknown): string {
    if (err instanceof Error) {
        return `${err.name}: ${err.message}`;
    }
    return String(err);
}
