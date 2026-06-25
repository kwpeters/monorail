// The index.json manifest uses snake_case keys (an external contract), so relax
// the camelCase naming convention in this test.
/* eslint-disable @typescript-eslint/naming-convention */
import { buildIndexEntries, buildMasterText, buildReadmeText } from "./bundle.mjs";
import { type IResolvedChapter } from "./chapters.mjs";


const chapters: Array<IResolvedChapter> = [
    { name: "Chapter 1", order: 1, start: 1, end: 4, slug: "01_Chapter_1" },
    { name: "Chapter 2", order: 2, start: 5, end: 10, slug: "02_Chapter_2" }
];


describe("buildIndexEntries()", () => {

    it("maps chapters to manifest entries", () => {
        const entries = buildIndexEntries(chapters, false);
        expect(entries[0]).toEqual({
            chapter:   "Chapter 1",
            order:     "01",
            pdf_start: 1,
            pdf_end:   4,
            text_file: "text/01_Chapter_1.txt",
            image_dir: "images/01_Chapter_1"
        });
    });

    it("sets image_dir to null when images are skipped", () => {
        const entries = buildIndexEntries(chapters, true);
        expect(entries[0]!.image_dir).toBeNull();
    });

});


describe("buildMasterText()", () => {

    it("includes a sections TOC and per-chapter banners, with chapter headers stripped", () => {
        const chapterTexts = [
            "# Chapter 1\n# Source: Doc.pdf  |  PDF pages 1-4\n\n[PDF p.1]\nBody one\n",
            "# Chapter 2\n# Source: Doc.pdf  |  PDF pages 5-10\n\n[PDF p.5]\nBody two\n"
        ];
        const master = buildMasterText("Doc.pdf", "Doc", 10, chapters, chapterTexts);
        expect(master).toContain("# Doc - combined master");
        expect(master).toContain("## Sections");
        expect(master).toContain("=== Chapter 1  (PDF pages 1-4) ===");
        expect(master).toContain("[PDF p.1]\nBody one");
        // The per-chapter header lines must not be duplicated into the master body.
        expect(master).not.toContain("# Source: Doc.pdf  |  PDF pages 1-4");
    });

});


describe("buildReadmeText()", () => {

    it("documents the layout and lists the sections", () => {
        const readme = buildReadmeText("Doc.pdf", "Doc", 10, chapters, 200, false);
        expect(readme).toContain("# Doc — AI-readable extraction");
        expect(readme).toContain("images/<section>/page-NNNN.png");
        expect(readme).toContain("- **Chapter 1** — PDF pages 1-4 — `text/01_Chapter_1.txt`");
    });

    it("omits the images line when images are skipped", () => {
        const readme = buildReadmeText("Doc.pdf", "Doc", 10, chapters, 200, true);
        expect(readme).not.toContain("images/<section>/page-NNNN.png");
    });

});
