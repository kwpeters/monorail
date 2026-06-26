import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { File } from "@repo/depot-node/file";
import { Directory } from "@repo/depot-node/directory";
import { TaskQueue } from "@repo/depot-node/taskQueue";
import { type IResolvedChapter } from "./chapters.mjs";


/** The signature of the injected `pdftoppm` wrapper. */
type RenderImagesFn = (
    pdf: File,
    first: number,
    last: number,
    dpi: number,
    prefixPath: string
) => Promise<Result<string, string>>;


/** Progress reported as page images are rendered. */
export interface IImageRenderProgress {
    /** Number of pages rendered so far. */
    completed:   number;
    /** Total number of pages to render across all chapters. */
    total:       number;
    /** The maximum number of page renders running concurrently. */
    concurrency: number;
}


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
 * Renders the full-page PNG images for every chapter, one task per page, running
 * up to `concurrency` page renders at a time via a {@link TaskQueue}.  Each
 * chapter's pages are written into `<imagesDir>/<chapter.slug>` and that
 * directory's filenames are normalized once all pages have rendered.
 *
 * Page rasterization is CPU-bound and embarrassingly parallel, so this is the
 * principal speed-up over rendering each chapter's range in a single serial
 * `pdftoppm` invocation.
 *
 * Rendering is fail-fast: the first page failure cancels any not-yet-started
 * pages and the failure is returned (pages already in flight are allowed to
 * finish).
 *
 * @param renderImages - The injected `pdftoppm` wrapper
 * @param pdf - The input PDF
 * @param chapters - The resolved chapters whose pages to render
 * @param dpi - The render resolution
 * @param imagesDir - The parent directory that holds the per-chapter image dirs
 * @param concurrency - The maximum number of pages to render concurrently
 * @param onProgress - Invoked after each page renders, for progress reporting
 * @returns A successful Result once all pages have rendered and been
 *     normalized, or the first failure encountered
 */
export async function renderAllChapterImages(
    renderImages: RenderImagesFn,
    pdf:          File,
    chapters:     ReadonlyArray<IResolvedChapter>,
    dpi:          number,
    imagesDir:    Directory,
    concurrency:  number,
    onProgress?:  (progress: IImageRenderProgress) => void
): Promise<Result<void, string>> {
    const total = chapters.reduce((sum, chap) => sum + (chap.end - chap.start + 1), 0);
    if (total === 0) {
        return new SucceededResult(undefined);
    }

    // Build the flat list of per-page render jobs across all chapters, ensuring
    // each chapter's image directory exists up front.
    const jobs: Array<{ page: number; prefixPath: string; }> = [];
    for (const chapter of chapters) {
        const chapImageDir = new Directory(imagesDir, chapter.slug);
        await chapImageDir.ensureExists();
        const prefixPath = new File(chapImageDir, "page").absPath();

        for (let page = chapter.start; page <= chapter.end; page++) {
            jobs.push({ page, prefixPath });
        }
    }

    // Queue one render task per page so that concurrency is global, not limited
    // by (or skewed across) individual chapters.
    const queue = new TaskQueue(concurrency);
    let completed = 0;
    const taskPromises = jobs.map((job) => queue.push(async () => {
        const renderRes = await renderImages(pdf, job.page, job.page, dpi, job.prefixPath);
        if (renderRes.failed) {
            throw new Error(renderRes.error);
        }
        completed++;
        onProgress?.({ completed, total, concurrency });
    }));

    try {
        await Promise.all(taskPromises);
    }
    catch (err) {
        // Fail fast: stop launching any pages that have not yet started.
        queue.cancelAllPending();
        return new FailedResult(`Failed to render page images: ${(err as Error).message}`);
    }

    // Re-pad the per-page filenames (whose widths vary with page number) to the
    // stable page-NNNN.png form, one chapter directory at a time.
    for (const chapter of chapters) {
        const chapImageDir = new Directory(imagesDir, chapter.slug);
        const normRes = await normalizeImageNames(chapImageDir);
        if (normRes.failed) {
            return normRes;
        }
    }

    return new SucceededResult(undefined);
}
