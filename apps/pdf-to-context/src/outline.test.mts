import { parseOutlineChapters } from "./outline.mjs";


const outlineXml = `<?xml version="1.0" encoding="UTF-8"?>
<pdf2xml>
<outline>
<item page="1">Front Matter</item>
<item page="5">Chapter 1 Intro &amp; Overview</item>
<outline>
<item page="6">Nested child (should be ignored)</item>
</outline>
<item page="20">Chapter 2 Details</item>
</outline>
</pdf2xml>`;


describe("parseOutlineChapters()", () => {

    it("extracts only the top-level items, sorted, with entities decoded", async () => {
        const res = await parseOutlineChapters(outlineXml);
        expect(res.succeeded).toBeTrue();
        expect(res.value).toEqual([
            { name: "Front Matter", start: 1 },
            { name: "Chapter 1 Intro & Overview", start: 5 },
            { name: "Chapter 2 Details", start: 20 }
        ]);
    });


    it("returns an empty array when the PDF has no outline", async () => {
        const res = await parseOutlineChapters(`<?xml version="1.0"?><pdf2xml></pdf2xml>`);
        expect(res.succeeded).toBeTrue();
        expect(res.value).toEqual([]);
    });

});
