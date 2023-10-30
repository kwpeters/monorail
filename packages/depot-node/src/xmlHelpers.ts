import * as xmldom from "@xmldom/xmldom";
import * as xpath from "xpath";
import { Result } from "../../depot/src/result.js";
import { pipe } from "../../depot/src/pipe.js";
import { NoneOption, Option, SomeOption } from "../../depot/src/option.js";
import { assertNever } from "../../depot/src/never.js";
import { collapseWhitespace, tryParseInt } from "../../depot/src/stringHelpers.js";
import { File } from "../../depot-node/src/file.js";
import { PromiseResult } from "../../depot/src/promiseResult.js";


export async function fileToXmlDoc(src: File): Promise<Result<Document, string>> {

    const impl = async () => {
        const text = await src.read();
        const doc = new xmldom.DOMParser().parseFromString(text);
        return doc;
    };

    return PromiseResult.fromPromise(impl());
}

/**
 * Gets a normalized string representation of the first text node under the
 * first matching element or attribute.
 *
 * @param query - The query to run.  The text for the first matching Node is
 * returned.
 * @param contextNode - The context Node for the query
 * @return None if the query selected nothing.  Otherwise, you will get a Some
 * containing a string representation of the query's text.
 */
export function trySelectText(query: string, contextNode: Node): Option<string> {

    const xpathRes = xpath.select(query, contextNode, true);
    if (!xpathRes) {
        // Handle undefined and null.
        // Note: undefined is not a possibility according to the published types,
        // but I have run into cases where undefined is returned when there are no
        // results that match the query.
        return NoneOption.get();
    }

    let resultStr: string;

    if (isNode(xpathRes)) {
        if (isAttribute(xpathRes)) {
            resultStr = xpathRes.value;
        }
        else {
            // _xpathRes_ is an element.
            const textNodes =
                pipe(Array.from(xpathRes.childNodes))
                .pipe((childNodes) => childNodes.filter((n): n is Text => n.nodeType === n.TEXT_NODE))
                .end();
            resultStr = textNodes.length > 0 ? textNodes[0].data : "";
        }
    }
    else if (typeof xpathRes === "string") {
        resultStr = xpathRes;
    }
    else if (typeof xpathRes === "number") {
        resultStr = xpathRes.toString(10);
    }
    else if (typeof xpathRes === "boolean") {
        resultStr = xpathRes.toString();
    }
    else {
        assertNever(xpathRes);
    }

    return pipe(resultStr)
    .pipe(collapseWhitespace)
    .pipe((str) => str.trim())
    .pipe((str) => new SomeOption(str))
    .end();
}


export function selectText(query: string, contextNode: Node): string {
    return pipe(trySelectText(query, contextNode))
    .pipe((textOpt) => Option.throwIfNone(`Failed to get text for xpath query "${query}".`, textOpt))
    .end();
}


export function trySelectInteger(query: string, contextNode: Node): Result<number, string> {
    return pipe(trySelectText(query, contextNode))
    .pipe((strOpt) => Result.fromOption(strOpt, `Failed to read text for query "${query}".`))
    .pipe((strRes) => Result.bind(tryParseInt, strRes))
    .end();
}


export function selectInteger(query: string, contextNode: Node): number {
    const res = trySelectInteger(query, contextNode);
    if (res.succeeded) {
        return res.value;
    }
    else {
        throw new Error(`Failed to read integer for query "${query}".`);
    }
}


/**
 * User-defined type guard that tests whether the specified object is a Node
 *
 * @param o - The object to test
 * @return true if _o_ is a Node; false otherwise.
 */
export function isNode(o: unknown): o is Node {
    const subject = o as Node;
    return subject &&
        typeof subject === "object" &&
        typeof subject.nodeType === "number" &&
        typeof subject.nodeName === "string";
}


/**
 * User-defined type guard that tests whether the specified object is an Element
 * Node.
 *
 * @param o - The object to test
 * @return true if _o_ is an Element; false otherwise.
 */
export function isElement(o: unknown): o is Element {
    return isNode(o) &&
        o.nodeType === o.ELEMENT_NODE;
}


/**
 * User-defined type guard that tests whether the specified object is an
 * Attribute Node.
 *
 * @param o - The object to test
 * @return true if _o_ is an Attr; false otherwise.
 */
export function isAttribute(o: unknown): o is Attr {
    return isNode(o) &&
        o.nodeType === o.ATTRIBUTE_NODE;
}


/**
 * User-defined type guard that tests whether the specified object is a Text
 * Node.
 *
 * @param o - The object to test
 * @return true if _o_ is a Text Node; false otherwise.
 */
export function isText(o: unknown): o is Text {
    return isNode(o) &&
        o.nodeType === o.TEXT_NODE;
}



/**
 * Attempts to convert a selection result containing either a single Node or an
 * Array of Nodes to an array of Nodes.
 *
 * @param selectRetVal - The selection result that will be converted
 * @return If successful, a Some containing the array of Nodes.  Otherwise, a
 * None.
 */
export function tryToNodeArray(selectRetVal: xpath.SelectReturnType): Option<Array<Node>> {

    if (Array.isArray(selectRetVal)) {
        // The only kind of array is a Node array.  Just return it.
        return new SomeOption(selectRetVal);
    }
    else if (isNode(selectRetVal)) {
        // If it's a single node, put it in an array and return it.
        return new SomeOption([selectRetVal]);
    }
    else {
        return NoneOption.get();
    }
}


export function toNodeArray(selectRetVal: xpath.SelectReturnType): Array<Node> {
    const opt = tryToNodeArray(selectRetVal);
    if (opt.isSome) {
        return opt.value;
    }
    else {
        throw new Error("Failed to convert xpath selection to a Node array.");
    }
}



export function tryToNode(subject: Node | null): Option<Node>;
export function tryToNode(subject: xpath.SelectReturnType): Option<Node>;
export function tryToNode(subject: null | xpath.SelectReturnType): Option<Node> {

    if (!subject) {
        return NoneOption.get();
    }
    else if (isNode(subject)) {
        return new SomeOption(subject);
    }
    else {
        return NoneOption.get();
    }
}


export function toNode(subject: Node | null): Node;
export function toNode(subject: xpath.SelectReturnType): Node;
export function toNode(subject: null | xpath.SelectReturnType): Node {
    const opt = tryToNode(subject);
    if (opt.isSome) {
        return opt.value;
    }
    else {
        throw new Error("Failed to convert xpath selection to a Node.");
    }
}


/**
 * Attempts to convert a selection result to an array of Elements.
 *
 * @param selectRetVal - The selection result that will be converted
 * @return If successful, a Some containing the array of Elements.  Otherwise, a
 * None.
 */
export function tryToElementArray(selectRetVal: xpath.SelectReturnType): Option<Array<Element>> {
    const nodesOpt = tryToNodeArray(selectRetVal);
    if (nodesOpt.isNone) {
        return nodesOpt;
    }

    const elems = Option.choose(
        (curNode) => isElement(curNode) ? new SomeOption(curNode) : NoneOption.get(),
        nodesOpt.value
    );

    return elems.length === nodesOpt.value.length ? new SomeOption(elems) : NoneOption.get();
}


/**
 * Converts a selection result to an array of Elements.  Throws an Error if the
 * selection result did not include Elements.
 *
 * @param selectRetVal - The selection result that will be converted
 * @return The array of Elements.
 */
export function toElementArray(selectRetVal: xpath.SelectReturnType): Array<Element> {
    const opt = tryToElementArray(selectRetVal);
    if (opt.isSome) {
        return opt.value;
    }
    else {
        throw new Error("Failed to convert xpath selection to an element array.");
    }
}


/**
 * Attempts to convert a selection result to a string.
 *
 * @param param - The selection result that will be converted
 * @return If successful, a Some containing string.  Otherwise, a None.
 */
export function tryToString(selectRetVal: xpath.SelectReturnType): Option<string> {
    return typeof selectRetVal === "string" ?
        new SomeOption(selectRetVal) :
        NoneOption.get();
}


/**
 * Converts a selection result to a string.  Throws an Error if the selection
 * result was not a string.
 *
 * @param selectRetVal - The selection result that will be converted
 * @return The string
 */
export function toString(selectRetVal: xpath.SelectReturnType): string {
    const opt = tryToString(selectRetVal);
    if (opt.isSome) {
        return opt.value;
    }
    else {
        throw new Error("Failed to convert xpath selection to a string.");
    }
}
