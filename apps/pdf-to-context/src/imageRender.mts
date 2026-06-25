import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { File } from "@repo/depot-node/file";
import { Directory } from "@repo/depot-node/directory";
import { type IResolvedChapter } from "./chapters.mjs";


/** The signature of the injected `pdftoppm` wrapper. */
type RenderImagesFn = (
    pdf: File,
    first: number,
    last: number,
    dpi: number,
    prefixPath: string
) => Promise<Result<string, string>>;


/**
 * Normalizes the PNG filenames produced by `pdftoppm` to a stable, sortable
 * 4-digit form (`page-NNNN.png`).  `pdftoppm` zero-pads page numbers to a width
 * that varies with the page range, so this re-pads them uniformly.  Matches the
 * PowerShell normalization.
 */
export async function normalizeImageNames(imageDir: Directory): Promise<Result<void, string>> {
    try {
        const contents = await imageDir.contents(false);
        for (const file of contents.files) {
            const num = /-(?<num>\d+)\.png$/.exec(file.fileName)?.groups?.num;
            if (num === undefined) {
                continue;
            }
            const normalized = `page-${num.padStart(4, "0")}.png`;
            if (file.fileName !== normalized) {
                await file.move(imageDir, normalized);
            }
        }
        return new SucceededResult(undefined);
    }
    catch (err) {
        return new FailedResult(`Failed to normalize image names in "${imageDir.toString()}": ${(err as Error).message}`);
    }
}


/**
 * Renders the full-page PNG images for one chapter into `imageDir`, then
 * normalizes their filenames.  Uses the injected `renderImages` function.
 */
export async function renderChapterImages(
    renderImages: RenderImagesFn,
    pdf:          File,
    chapter:      IResolvedChapter,
    dpi:          number,
    imageDir:     Directory
): Promise<Result<void, string>> {
    await imageDir.ensureExists();
    const prefixPath = new File(imageDir, "page").absPath();

    const renderRes = await renderImages(pdf, chapter.start, chapter.end, dpi, prefixPath);
    if (renderRes.failed) {
        return renderRes;
    }

    return normalizeImageNames(imageDir);
}
