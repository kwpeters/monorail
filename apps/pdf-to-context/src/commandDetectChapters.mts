import { type Argv, type Arguments } from "yargs";
import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { File } from "@repo/depot-node/file";
import { ensureToolsAvailable, popplerFns } from "./poppler.mjs";
import { parseOutlineChapters } from "./outline.mjs";
import { sidecarFileFor, type IChapterMapEntry } from "./chapters.mjs";


export const command = "detect-chapters <pdf>";
export const describe = "Generate an editable chapter-map sidecar (<pdf>.chapters.json) from the PDF's bookmarks";


export function builder(argv: Argv): Argv {
    return argv
    .positional("pdf", {
        describe: "Path to the input PDF",
        type:     "string"
    })
    .option("force", {
        type:     "boolean",
        default:  false,
        describe: "Overwrite an existing chapter map"
    })
    .check(
        (args: Arguments) => {
            const pdf = new File(args.pdf as string);
            if (!pdf.existsSync()) {
                throw new Error(`The PDF "${pdf.toString()}" does not exist.`);
            }
            return true;
        },
        false
    );
}


export async function handler(args: Arguments): Promise<void> {
    const res = await detectChapters(args.pdf as string, args.force as boolean);
    if (res.failed) {
        console.error(res.error);
        process.exit(1);
    }
}


/**
 * Core of the detect-chapters command: read the PDF's bookmark outline and write
 * an editable `<pdf-basename>.chapters.json` sidecar next to the PDF.
 */
async function detectChapters(pdfPath: string, force: boolean): Promise<Result<number, string>> {
    const pdf = new File(pdfPath);
    const sidecar = sidecarFileFor(pdf);

    return pipeAsync(
        ensureToolsAvailable(["pdftohtml"]),
        (r) => Result.bind(() => guardSidecar(sidecar, force), r),
        (r) => Result.bindAsync(() => popplerFns.dumpOutlineXml(pdf), r),
        (r) => Result.bindAsync(parseOutlineChapters, r),
        (r) => Result.bind(requireChapters, r),
        (r) => Result.bindAsync((entries) => writeSidecar(sidecar, entries), r),
        (r) => Result.mapSuccess(() => 0, r)
    );
}


function guardSidecar(sidecar: File, force: boolean): Result<void, string> {
    return sidecar.existsSync() && !force ?
        new FailedResult(`Chapter map "${sidecar.fileName}" already exists. Use --force to overwrite.`) :
        new SucceededResult(undefined);
}


function requireChapters(entries: Array<IChapterMapEntry>): Result<Array<IChapterMapEntry>, string> {
    return entries.length > 0 ?
        new SucceededResult(entries) :
        new FailedResult("No usable bookmarks/outline found in the PDF. Create the chapter map by hand.");
}


async function writeSidecar(sidecar: File, entries: Array<IChapterMapEntry>): Promise<Result<void, string>> {
    try {
        await sidecar.write(JSON.stringify(entries, undefined, 2) + "\n");
        console.log(`Wrote ${entries.length} section(s) -> ${sidecar.toString()}`);
        for (const entry of entries) {
            console.log(`  ${String(entry.start).padStart(6)}  ${entry.name}`);
        }
        return new SucceededResult(undefined);
    }
    catch (err) {
        return new FailedResult(`Failed to write chapter map "${sidecar.toString()}": ${(err as Error).message}`);
    }
}
