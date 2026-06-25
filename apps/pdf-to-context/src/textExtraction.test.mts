import { NoneOption, SomeOption } from "@repo/depot/option";
import { cleanPage, buildMarker, formatChapterText } from "./textExtraction.mjs";
import { defaultNoisePatterns } from "./noise.mjs";
import { type IResolvedChapter } from "./chapters.mjs";


describe("cleanPage()", () => {

    it("captures the printed page label and removes that line", () => {
        const res = cleanPage("Body line one\n     – 4-1 –   \nBody line two", []);
        expect(res.printed.isSome).toBeTrue();
        expect(res.printed.value).toEqual("4-1");
        expect(res.body).toEqual("Body line one\nBody line two");
    });

    it("strips noise lines and collapses runs of blank lines", () => {
        const page = "Volume 1: Common Industrial Protocol Specification, Chapter 3 Foo\n" +
                     "Real content\n\n\n\nMore content\n" +
                     "Edition 3.40";
        const res = cleanPage(page, defaultNoisePatterns);
        expect(res.body).toEqual("Real content\n\nMore content");
        expect(res.printed.isNone).toBeTrue();
    });

});


describe("buildMarker()", () => {

    it("includes the printed label when present", () => {
        expect(buildMarker(215, new SomeOption("4-1"))).toEqual("[PDF p.215 | printed 4-1]");
    });

    it("omits the printed label when absent", () => {
        expect(buildMarker(215, NoneOption.get())).toEqual("[PDF p.215]");
    });

});


describe("formatChapterText()", () => {

    const chapter: IResolvedChapter = { name: "Chapter 4", order: 4, start: 215, end: 216, slug: "04_Chapter_4" };

    it("emits header lines and a marker+body block per non-empty page", () => {
        const raw = "Page A content\n     – 4-1 –   \f   – 4-2 –\nPage B content";
        const out = formatChapterText(chapter, "Doc.pdf", raw, []);
        expect(out).toContain("# Chapter 4");
        expect(out).toContain("# Source: Doc.pdf  |  PDF pages 215-216");
        expect(out).toContain("[PDF p.215 | printed 4-1]\nPage A content");
        expect(out).toContain("[PDF p.216 | printed 4-2]\nPage B content");
    });

    it("stops at the chapter's end page and skips empty pages", () => {
        const raw = "Only page\f\fextra page beyond end";
        const out = formatChapterText({ ...chapter, start: 215, end: 215 }, "Doc.pdf", raw, []);
        expect(out).toContain("[PDF p.215]");
        expect(out).not.toContain("[PDF p.216]");
    });

});
