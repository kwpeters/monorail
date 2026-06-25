import * as os from "node:os";
import { SucceededResult } from "@repo/depot/result";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import {
    computeSlug,
    finalizeChapters,
    resolveChapters,
    sidecarFileFor,
    type IChapterMapEntry,
    type IResolveChaptersDeps
} from "./chapters.mjs";


describe("computeSlug()", () => {

    it("prefixes a 2-digit order and sanitizes the name", () => {
        expect(computeSlug("Chapter 1", 1)).toEqual("01_Chapter_1");
        expect(computeSlug("Chapter 5A", 9)).toEqual("09_Chapter_5A");
        expect(computeSlug("Subscription Terms & Conditions", 2)).toEqual("02_Subscription_Terms_Conditions");
    });

});


describe("finalizeChapters()", () => {

    it("sorts by start and computes ranges, orders and slugs", () => {
        const entries: Array<IChapterMapEntry> = [{ name: "B", start: 5 }, { name: "A", start: 1 }];
        const res = finalizeChapters(entries, 10);
        expect(res.succeeded).toBeTrue();
        expect(res.value).toEqual([
            { name: "A", order: 1, start: 1, end: 4, slug: "01_A" },
            { name: "B", order: 2, start: 5, end: 10, slug: "02_B" }
        ]);
    });

    it("sets the last chapter's end to the total page count", () => {
        const res = finalizeChapters([{ name: "Only", start: 1 }], 42);
        expect(res.value![0]!.end).toEqual(42);
    });

    it("fails when two chapters share a start page", () => {
        const res = finalizeChapters([{ name: "A", start: 1 }, { name: "B", start: 1 }], 10);
        expect(res.failed).toBeTrue();
    });

});


describe("resolveChapters()", () => {

    let tmpDir: Directory;

    beforeEach(async () => {
        tmpDir = new Directory(os.tmpdir(), `p2c-chapters-${Date.now()}-${Math.floor(Math.random() * 1e6)}`);
        await tmpDir.ensureExists();
    });

    afterEach(async () => {
        await tmpDir.delete();
    });


    it("prefers a sidecar map when present", async () => {
        const pdf = new File(tmpDir, "Doc.pdf");
        await sidecarFileFor(pdf).write(JSON.stringify([{ name: "Intro", start: 1 }]));
        const deps: IResolveChaptersDeps = {
            getBookmarkChapters: () => Promise.resolve(new SucceededResult([{ name: "FromBookmarks", start: 1 }]))
        };

        const res = await resolveChapters(pdf, 5, deps);
        expect(res.succeeded).toBeTrue();
        expect(res.value!.source).toEqual("sidecar");
        expect(res.value!.chapters[0]!.name).toEqual("Intro");
    });


    it("falls back to PDF bookmarks when there is no sidecar", async () => {
        const pdf = new File(tmpDir, "Doc.pdf");
        const deps: IResolveChaptersDeps = {
            getBookmarkChapters: () => Promise.resolve(new SucceededResult([{ name: "Ch1", start: 1 }]))
        };

        const res = await resolveChapters(pdf, 5, deps);
        expect(res.value!.source).toEqual("bookmarks");
        expect(res.value!.chapters[0]!.name).toEqual("Ch1");
    });


    it("falls back to a single 'Document' section when there are no bookmarks", async () => {
        const pdf = new File(tmpDir, "Doc.pdf");
        const deps: IResolveChaptersDeps = {
            getBookmarkChapters: () => Promise.resolve(new SucceededResult([]))
        };

        const res = await resolveChapters(pdf, 5, deps);
        expect(res.value!.source).toEqual("single");
        expect(res.value!.chapters).toEqual([
            { name: "Document", order: 1, start: 1, end: 5, slug: "01_Document" }
        ]);
    });

});
