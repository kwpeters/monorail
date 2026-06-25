// The index.json manifest uses snake_case keys for parity with the original
// PowerShell output (an external contract for AI agents), so relax the
// camelCase naming convention in this file.
/* eslint-disable @typescript-eslint/naming-convention */
import { type IResolvedChapter } from "./chapters.mjs";


/** One entry in the generated `index.json` manifest. */
export interface IIndexEntry {
    chapter:   string;
    order:     string;
    pdf_start: number;
    pdf_end:   number;
    text_file: string;
    image_dir: string | null;
}


const BANNER = "=".repeat(80);


/**
 * Builds the `index.json` entries that let an AI agent discover the bundle's
 * structure (section → page range → text file → image folder).
 */
export function buildIndexEntries(
    chapters:   Array<IResolvedChapter>,
    skipImages: boolean
): Array<IIndexEntry> {
    return chapters.map((chap) => ({
        chapter:   chap.name,
        order:     chap.slug.substring(0, 2),
        pdf_start: chap.start,
        pdf_end:   chap.end,
        text_file: `text/${chap.slug}.txt`,
        image_dir: skipImages ? null : `images/${chap.slug}`
    }));
}


/**
 * Strips the two header lines (and the following blank line) that
 * `formatChapterText` prepends, leaving just the chapter body for the master
 * file.
 */
function chapterBodyOnly(chapterText: string): string {
    return chapterText.split("\n").slice(3).join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
}


/**
 * Builds the combined master text file: a header, a "Sections" table of
 * contents, then every chapter's body under a banner.  `chapterTexts[i]` must
 * correspond to `chapters[i]` (the full per-chapter file text).
 */
export function buildMasterText(
    pdfFileName:  string,
    pdfBaseName:  string,
    totalPages:   number,
    chapters:     Array<IResolvedChapter>,
    chapterTexts: Array<string>
): string {
    const lines: Array<string> = [];

    lines.push(`# ${pdfBaseName} - combined master`);
    lines.push(`# Source: ${pdfFileName} (${totalPages} pages). Per-section files live in text/.`);
    lines.push("# Page markers: [PDF p.<physical> | printed <spec page>].");
    lines.push("");
    lines.push("## Sections");
    for (const chap of chapters) {
        lines.push(`  ${chap.name.padEnd(14)} PDF pages ${chap.start}-${chap.end}`);
    }
    lines.push("");

    for (let i = 0; i < chapters.length; i++) {
        const chap = chapters[i]!;
        lines.push(BANNER);
        lines.push(`=== ${chap.name}  (PDF pages ${chap.start}-${chap.end}) ===`);
        lines.push(BANNER);
        lines.push("");
        lines.push(chapterBodyOnly(chapterTexts[i] ?? ""));
        lines.push("");
        lines.push("");
    }

    return lines.join("\n");
}


/**
 * Builds the per-bundle README that documents the conventions for an AI agent.
 */
export function buildReadmeText(
    pdfFileName: string,
    pdfBaseName: string,
    totalPages:  number,
    chapters:    Array<IResolvedChapter>,
    dpi:         number,
    skipImages:  boolean
): string {
    const lines: Array<string> = [];

    lines.push(`# ${pdfBaseName} — AI-readable extraction`);
    lines.push("");
    lines.push(`Generated from \`${pdfFileName}\` (${totalPages} pages) by \`pdf-to-context build\` using Poppler.`);
    lines.push("");
    lines.push("## Layout");
    lines.push("- `text/` — one UTF-8 text file per section (`pdftotext -layout`; tables kept aligned).");
    lines.push(`- \`${pdfBaseName}_MASTER.txt\` — all sections concatenated into one file.`);
    if (!skipImages) {
        lines.push(`- \`images/<section>/page-NNNN.png\` — ${dpi} dpi full-page renders (NNNN = physical PDF page).`);
    }
    lines.push("- `index.json` — machine-readable section map.");
    lines.push("");
    lines.push("## Conventions");
    lines.push("- Each page starts with `[PDF p.<physical> | printed <spec page>]`.");
    lines.push("- **Cite using the spec section number** (e.g. `4-8.1`); the printed page is a fallback.");
    lines.push("- Repeating license footer / running header removed.");
    lines.push("");
    lines.push("## Sections");
    for (const chap of chapters) {
        lines.push(`- **${chap.name}** — PDF pages ${chap.start}-${chap.end} — \`text/${chap.slug}.txt\``);
    }
    lines.push("");

    return lines.join("\n");
}
