import * as path from "node:path";
import { type Argv, type Arguments } from "yargs";
import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { Option } from "@repo/depot/option";
import { pipe } from "@repo/depot/pipe2";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { File } from "@repo/depot-node/file";
import { Directory } from "@repo/depot-node/directory";
import { ensureToolsAvailable, popplerFns } from "./poppler.mjs";
import {
    resolveChapters,
    bookmarkChapterGetter,
    type IResolvedChapters,
    type IResolveChaptersDeps
} from "./chapters.mjs";
import { loadNoisePatterns } from "./noise.mjs";
import { buildChapterText } from "./textExtraction.mjs";
import { renderChapterImages } from "./imageRender.mjs";
import { buildMasterText, buildIndexEntries, buildReadmeText } from "./bundle.mjs";


export const command = "build <pdf> <outputDir>";
export const describe = "Convert a PDF into an AI-readable bundle (per-chapter text, master text, page images, index.json)";


export function builder(argv: Argv): Argv {
    return argv
    .positional("pdf", {
        describe: "Path to the input PDF",
        type:     "string"
    })
    .positional("outputDir", {
        describe: "Directory to write the bundle into (its contents are replaced on each build)",
        type:     "string"
    })
    .option("dpi", {
        type:     "number",
        default:  200,
        describe: "Resolution (DPI) for the full-page images"
    })
    .option("skip-images", {
        type:     "boolean",
        default:  false,
        describe: "Skip page-image rendering (text only)"
    })
    .option("noise-file", {
        type:     "string",
        describe: "File of regex overrides (one per line) for per-page noise removal; replaces the defaults"
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
    const noiseFileOpt = pipe(
        Option.fromNullable(args["noise-file"] as string | undefined),
        Option.mapSome((noisePath) => new File(noisePath))
    );

    const res = await buildBundle(
        args.pdf as string,
        args.outputDir as string,
        args.dpi as number,
        args["skip-images"] as boolean,
        noiseFileOpt
    );
    if (res.failed) {
        console.error(res.error);
        process.exit(1);
    }
}


interface IBuildContext {
    totalPages: number;
    chapters:   IResolvedChapters;
    noise:      Array<RegExp>;
}


/**
 * Core of the build command: resolve chapters, extract text, render images, and
 * write the bundle.
 */
async function buildBundle(
    pdfPath:       string,
    outputDirPath: string,
    dpi:           number,
    skipImages:    boolean,
    noiseFileOpt:  Option<File>
): Promise<Result<number, string>> {
    const pdf = new File(pdfPath);
    const outDir = new Directory(outputDirPath);

    const guardRes = guardOutputDir(pdf, outDir);
    if (guardRes.failed) {
        return guardRes;
    }

    const coreTools = skipImages ? ["pdfinfo", "pdftotext"] : ["pdfinfo", "pdftotext", "pdftoppm"];
    const deps: IResolveChaptersDeps = { getBookmarkChapters: bookmarkChapterGetter(popplerFns) };

    const ctxRes = await pipeAsync(
        ensureToolsAvailable(coreTools),
        (r) => Result.bindAsync(() => popplerFns.getPageCount(pdf), r),
        (r) => Result.mapSuccess((totalPages) => ({ totalPages }), r),
        (r) => Result.augmentAsync(
            async (ctx) => Result.mapSuccess(
                (chapters) => ({ chapters }),
                await resolveChapters(pdf, ctx.totalPages, deps)
            ),
            r
        ),
        (r) => Result.augmentAsync(
            async () => Result.mapSuccess(
                (noise) => ({ noise }),
                await loadNoisePatterns(noiseFileOpt)
            ),
            r
        )
    );
    if (ctxRes.failed) {
        return ctxRes;
    }

    return writeBundle(pdf, outDir, ctxRes.value, dpi, skipImages);
}


/**
 * Refuses to build into a directory that contains the input PDF, since the
 * output directory is emptied at the start of each build.
 */
function guardOutputDir(pdf: File, outDir: Directory): Result<void, string> {
    const outAbs = outDir.absPath();
    const pdfDirAbs = pdf.directory.absPath();
    return pdfDirAbs === outAbs || pdf.absPath().startsWith(outAbs + path.sep) ?
        new FailedResult("The output directory must not contain the input PDF (the output directory is emptied on each build).") :
        new SucceededResult(undefined);
}


async function writeBundle(
    pdf:        File,
    outDir:     Directory,
    ctx:        IBuildContext,
    dpi:        number,
    skipImages: boolean
): Promise<Result<number, string>> {
    const pdfFileName = pdf.fileName;
    try {
        console.log(`${pdfFileName}: ${ctx.totalPages} pages, ${ctx.chapters.chapters.length} section(s)  [source: ${ctx.chapters.source}]`);

        await outDir.empty();
        const textDir = await new Directory(outDir, "text").ensureExists();
        const imagesDir = new Directory(outDir, "images");
        const chapterTexts: Array<string> = [];

        for (const chap of ctx.chapters.chapters) {
            const textRes = await buildChapterText(popplerFns.extractText, pdf, chap, pdfFileName, ctx.noise);
            if (textRes.failed) {
                return textRes;
            }
            await new File(textDir, `${chap.slug}.txt`).write(textRes.value);
            chapterTexts.push(textRes.value);
            console.log(`  ${chap.name}  pages ${chap.start}-${chap.end}`);

            if (!skipImages) {
                const chapImageDir = new Directory(imagesDir, chap.slug);
                const imgRes = await renderChapterImages(popplerFns.renderImages, pdf, chap, dpi, chapImageDir);
                if (imgRes.failed) {
                    return imgRes;
                }
            }
        }

        const master = buildMasterText(pdfFileName, pdf.baseName, ctx.totalPages, ctx.chapters.chapters, chapterTexts);
        await new File(outDir, `${pdf.baseName}_MASTER.txt`).write(master);

        const index = buildIndexEntries(ctx.chapters.chapters, skipImages);
        await new File(outDir, "index.json").write(JSON.stringify(index, undefined, 2) + "\n");

        const readme = buildReadmeText(
            pdfFileName, pdf.baseName, ctx.totalPages, ctx.chapters.chapters, dpi, skipImages
        );
        await new File(outDir, "README.md").write(readme);

        console.log(`Done. Output: ${outDir.toString()}`);
        return new SucceededResult(0);
    }
    catch (err) {
        return new FailedResult(`Build failed: ${(err as Error).message}`);
    }
}
