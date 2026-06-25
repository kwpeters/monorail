import { Result, SucceededResult } from "@repo/depot/result";
import { Option, NoneOption, SomeOption } from "@repo/depot/option";
import { pipe } from "@repo/depot/pipe2";
import { tryParseInt } from "@repo/depot/stringHelpers";
import { toXmlDoc, isElement, getAttr } from "@repo/depot-node/xmlHelpers";
import { type IChapterMapEntry } from "./chapters.mjs";


/**
 * Parses the XML produced by `pdftohtml -xml` and extracts the document's
 * top-level bookmark entries (the direct `<item>` children of the first
 * `<outline>` element).  This reproduces the PowerShell detection logic and is
 * not specific to any one PDF: any PDF that ships a bookmark outline works.
 *
 * @param xml - The XML text emitted by `pdftohtml -xml`
 * @return On success, the top-level chapter entries sorted by start page (an
 * empty array if the PDF has no usable outline).  On failure, a parse-error
 * message.
 */
export async function parseOutlineChapters(xml: string): Promise<Result<Array<IChapterMapEntry>, string>> {
    const docRes = await toXmlDoc(xml);
    if (docRes.failed) {
        return docRes;
    }

    const firstOutline = docRes.value.getElementsByTagName("outline").item(0);
    if (!firstOutline) {
        // No bookmark outline present.  Let the caller fall back.
        return new SucceededResult([]);
    }

    const entries = pipe(
        Array.from(firstOutline.childNodes),
        (nodes) => nodes.filter((n): n is Element => isElement(n) && n.nodeName === "item"),
        (items) => Option.choose(itemToEntry, items)
    );

    const sorted = [...entries].sort((a, b) => a.start - b.start);
    return new SucceededResult(sorted);
}


/**
 * Converts a single top-level `<item>` element into a chapter entry, or None if
 * it lacks a usable title or `page` attribute.
 */
function itemToEntry(item: Element): Option<IChapterMapEntry> {
    const name = item.textContent.trim();
    const startRes = pipe(
        getAttr(item, "page"),
        Result.bind(tryParseInt)
    );

    return name.length === 0 || startRes.failed ?
        NoneOption.get() :
        new SomeOption({ name, start: startRes.value });
}
