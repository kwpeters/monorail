import { Result } from "@repo/depot/result";
import { type Option, NoneOption, SomeOption } from "@repo/depot/option";
import { type File } from "@repo/depot-node/file";
import { type IResolvedChapter } from "./chapters.mjs";


/**
 * A line that is only a dash-wrapped page label, e.g. `  – 4-1 –  `.  The
 * capture group is the printed (spec) page number.  Ported from `build.ps1`.
 */
const printedPageRx = /^\s*[–—-]\s*(?<label>[A-Za-z0-9][\w-]*)\s*[–—-]\s*$/;


export interface ICleanedPage {
    /** The printed (spec) page label captured from the page, if any. */
    printed: Option<string>;
    /** The page body after noise removal and whitespace normalization. */
    body:    string;
}


/**
 * Cleans a single extracted page: removes the running header / license footer
 * (noise) lines, captures the printed page label, collapses runs of 3+ blank
 * lines to 2, and trims surrounding blank lines.
 */
export function cleanPage(pageText: string, noisePatterns: Array<RegExp>): ICleanedPage {
    let printed: Option<string> = NoneOption.get();
    const kept: Array<string> = [];

    for (const line of pageText.split("\n")) {
        const label = printedPageRx.exec(line)?.groups?.label;
        if (label !== undefined) {
            printed = new SomeOption(label);
            continue;
        }
        if (noisePatterns.some((rx) => rx.test(line))) {
            continue;
        }
        kept.push(line.replace(/\s+$/, ""));
    }

    const body = kept.join("\n")
    .replace(/(?:\r?\n){3,}/g, "\n\n")
    .replace(/^[\n \t]+/, "")
    .replace(/[\n \t]+$/, "");

    return { printed, body };
}


/**
 * Builds the per-page marker line.
 */
export function buildMarker(physicalPage: number, printed: Option<string>): string {
    return printed.isSome ?
        `[PDF p.${physicalPage} | printed ${printed.value}]` :
        `[PDF p.${physicalPage}]`;
}


/**
 * Assembles the full text of one chapter file from the raw `pdftotext` stdout
 * (pages separated by form-feed).  Emits the two header lines, then a marker +
 * body block per non-empty page.
 */
export function formatChapterText(
    chapter:       IResolvedChapter,
    pdfFileName:   string,
    rawStdout:     string,
    noisePatterns: Array<RegExp>
): string {
    const pages = rawStdout.split("\f");
    let out = `# ${chapter.name}\n# Source: ${pdfFileName}  |  PDF pages ${chapter.start}-${chapter.end}\n\n`;

    for (let p = 0; p < pages.length; p++) {
        const physicalPage = chapter.start + p;
        if (physicalPage > chapter.end) {
            break;
        }
        const cleaned = cleanPage(pages[p]!, noisePatterns);
        if (cleaned.body.length === 0) {
            continue;
        }
        out += `${buildMarker(physicalPage, cleaned.printed)}\n${cleaned.body}\n\n`;
    }

    return out;
}


/**
 * Extracts and formats the text for one chapter using the injected `extractText`
 * function (so callers/tests can supply a real or fake Poppler).
 */
export async function buildChapterText(
    extractText:   (pdf: File, first: number, last: number) => Promise<Result<string, string>>,
    pdf:           File,
    chapter:       IResolvedChapter,
    pdfFileName:   string,
    noisePatterns: Array<RegExp>
): Promise<Result<string, string>> {
    const res = await extractText(pdf, chapter.start, chapter.end);
    return Result.mapSuccess(
        (stdout) => formatChapterText(chapter, pdfFileName, stdout, noisePatterns),
        res
    );
}
