import { z } from "zod";
import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { pipe } from "@repo/depot/pipe2";
import { findFirstDuplicateBy } from "@repo/depot/iterableHelpers";
import { safeParse } from "@repo/depot/zodHelpers";
import { File } from "@repo/depot-node/file";
import { parseOutlineChapters } from "./outline.mjs";
import { type IPopplerFns } from "./poppler.mjs";


/**
 * The schema of a single chapter-map entry.
 */
export const chapterMapEntrySchema = z.object({
    name:  z.string(),
    start: z.number()
});

/**
 * The schema of a `<pdf-basename>.chapters.json` sidecar: an array of entries.
 */
export const chapterMapSchema = z.array(chapterMapEntrySchema);


/**
 * One entry of a chapter map: a section name and the 1-based physical PDF page
 * on which it starts.  This is the shape of each object in a
 * `<pdf-basename>.chapters.json` sidecar.
 */
export type IChapterMapEntry = z.infer<typeof chapterMapEntrySchema>;


/**
 * A fully resolved chapter, with its computed page range, 1-based order, and
 * filesystem-safe slug.
 */
export interface IResolvedChapter {
    name:  string;
    order: number;
    start: number;
    end:   number;
    slug:  string;
}


/** Where a resolved chapter list came from. */
export type ChapterSource = "sidecar" | "bookmarks" | "single";


export interface IResolvedChapters {
    source:   ChapterSource;
    chapters: Array<IResolvedChapter>;
}


/**
 * Computes the filesystem slug for a chapter: a 2-digit order prefix followed by
 * the sanitized name (non-word runs collapsed to underscores).  Matches the
 * PowerShell `'{0:D2}_{slug}'` rule.
 */
export function computeSlug(name: string, order: number): string {
    const sanitized = name.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "");
    return `${String(order).padStart(2, "0")}_${sanitized}`;
}


/**
 * Returns the sidecar chapter-map file that would sit next to the given PDF.
 */
export function sidecarFileFor(pdf: File): File {
    return new File(pdf.directory, `${pdf.baseName}.chapters.json`);
}


/**
 * Turns a list of chapter-map entries into fully resolved chapters: sorted by
 * start page, with each `end` set to one page before the next chapter's start
 * (the last chapter ends on the final page), plus order and slug.  Fails if two
 * chapters would produce the same slug.
 */
export function finalizeChapters(
    entries:    Array<IChapterMapEntry>,
    totalPages: number
): Result<Array<IResolvedChapter>, string> {
    const sorted = [...entries].sort((a, b) => a.start - b.start);

    // Two chapters that start on the same page would produce an invalid
    // (negative-width) range, so reject that up front.
    const dupOpt = findFirstDuplicateBy(sorted, (entry) => entry.start);
    if (dupOpt.isSome) {
        return new FailedResult(`Two chapters share the same start page (${dupOpt.value.criterion}). Each chapter must start on a distinct page.`);
    }

    const resolved = sorted.map((entry, idx): IResolvedChapter => {
        const order = idx + 1;
        const end = idx < sorted.length - 1 ? sorted[idx + 1]!.start - 1 : totalPages;
        return {
            name:  entry.name,
            order: order,
            start: entry.start,
            end:   end,
            slug:  computeSlug(entry.name, order)
        };
    });

    return new SucceededResult(resolved);
}


/**
 * Reads and validates a `*.chapters.json` sidecar file.
 */
export async function parseSidecar(file: File): Promise<Result<Array<IChapterMapEntry>, string>> {
    let parsed: unknown;
    try {
        parsed = await file.readJson<unknown>();
    }
    catch (err) {
        return new FailedResult(`Failed to read chapter map "${file.toString()}": ${(err as Error).message}`);
    }

    return pipe(
        safeParse(chapterMapSchema, parsed),
        Result.mapError((err) => `Invalid chapter map "${file.toString()}": ${err}`),
        Result.mapSuccess((entries) => entries.map((entry) => ({ name: entry.name.trim(), start: entry.start })))
    );
}


/**
 * Builds a function that retrieves a PDF's chapters from its bookmark outline,
 * by composing the injected Poppler `dumpOutlineXml` with the outline parser.
 */
export function bookmarkChapterGetter(
    poppler: IPopplerFns
): (pdf: File) => Promise<Result<Array<IChapterMapEntry>, string>> {
    return async (pdf: File) => {
        const xmlRes = await poppler.dumpOutlineXml(pdf);
        return Result.bindAsync(parseOutlineChapters, xmlRes);
    };
}


export interface IResolveChaptersDeps {
    /** Retrieves chapters from the PDF's bookmark outline. */
    getBookmarkChapters: (pdf: File) => Promise<Result<Array<IChapterMapEntry>, string>>;
}


/**
 * Resolves the chapters for a PDF using the precedence: sidecar map > PDF
 * bookmarks > a single "Document" section spanning the whole file.
 */
export async function resolveChapters(
    pdf:        File,
    totalPages: number,
    deps:       IResolveChaptersDeps
): Promise<Result<IResolvedChapters, string>> {

    // 1. Sidecar map next to the PDF, if present.
    const sidecar = sidecarFileFor(pdf);
    if (sidecar.existsSync()) {
        const sidecarRes = await parseSidecar(sidecar);
        if (sidecarRes.failed) {
            return sidecarRes;
        }
        if (sidecarRes.value.length > 0) {
            return finalize(sidecarRes.value, totalPages, "sidecar");
        }
    }

    // 2. PDF bookmarks.
    const bookmarkRes = await deps.getBookmarkChapters(pdf);
    if (bookmarkRes.failed) {
        return bookmarkRes;
    }
    if (bookmarkRes.value.length > 0) {
        return finalize(bookmarkRes.value, totalPages, "bookmarks");
    }

    // 3. Whole document as a single section.
    return finalize([{ name: "Document", start: 1 }], totalPages, "single");
}


function finalize(
    entries:    Array<IChapterMapEntry>,
    totalPages: number,
    source:     ChapterSource
): Result<IResolvedChapters, string> {
    return pipe(
        finalizeChapters(entries, totalPages),
        Result.mapSuccess((chapters): IResolvedChapters => ({ source, chapters }))
    );
}
