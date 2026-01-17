import * as xmldom from "@xmldom/xmldom";
import * as xpath from "xpath";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { pipe } from "@repo/depot/pipe2";
import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { assertNever } from "@repo/depot/never";
import { boolStrToBool, collapseWhitespace, tryParseInt } from "@repo/depot/stringHelpers";
import { File } from "./file.mjs";


/**
 * Converts a File or XML string into an XML Document.
 *
 * @param arg - The input to convert. Can be a File or a string containing XML.
 * @return A Result containing the parsed XML Document if successful, or an
 * error message if parsing fails.
 */
export async function toXmlDoc(file: File): Promise<Result<Document, string>>;
export async function toXmlDoc(xmlStr: string): Promise<Result<Document, string>>;
export async function toXmlDoc(fileOrString: File | string): Promise<Result<Document, string>>;
export async function toXmlDoc(arg: File | string): Promise<Result<Document, string>> {

    const xmlStr     = typeof arg === "string" ? arg          : await arg.read();
    const sourceName = typeof arg === "string" ? "XML string" : arg.toString();
    let errorMsg: string | undefined;
    const parser = new xmldom.DOMParser({
        errorHandler: {
            warning:    (msg) => {},
            error:      (msg) => { errorMsg = JSON.stringify(msg); },
            fatalError: (msg) => { errorMsg = JSON.stringify(msg); }
        }
    });

    const doc = parser.parseFromString(xmlStr, "text/xml");

    // The @xmldoom/xmldom package is very lenient and will do almost anything
    // to successfully parse the text and convert it into a DOM.  When this
    // happens, documentElement will be null or there will be error
    // elements in the DOM.
    if (!doc.documentElement || doc.getElementsByTagName("parsererror").length > 0) {
        return new FailedResult(`Failed to parse ${sourceName}.`);
    }

    return errorMsg ?
        new FailedResult(`Failed to parse ${sourceName}.  ${errorMsg}`) :
        new SucceededResult(doc);
}


/**
 * Checks if the root element of an XML document matches the specified name.
 *
 * @param arg - The input to check. Can be a File, Document, or a string
 * containing XML.
 * @param rootElemName - The name of the root element to check for.
 * @return A boolean indicating whether the root element matches the specified
 * name.
 */
export async function hasRootElem(file: File, rootElemName: string): Promise<boolean>;
export async function hasRootElem(doc: Document, rootElemName: string): Promise<boolean>;
export async function hasRootElem(xmlStr: string, rootElemName: string): Promise<boolean>;
export async function hasRootElem(fileOrString: File | Document | string, rootElemName: string): Promise<boolean>;
export async function hasRootElem(arg: File | Document | string, rootElemName: string): Promise<boolean> {
    const resDoc = isDocument(arg) ?
        new SucceededResult(arg) :
        await toXmlDoc(arg);
    if (resDoc.failed) {
        return false;
    }

    const rootElementName = resDoc.value.documentElement.nodeName;
    return rootElementName === rootElemName;
}


export async function fileToXmlDoc(src: File): Promise<Result<Document, string>> {
    //
    // TODO: Replace all calls to this function with the above toXmlDoc() function.
    //
    return toXmlDoc(src);
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
            const textNodes = pipe(
                Array.from(xpathRes.childNodes),
                (childNodes) => childNodes.filter((n): n is Text => n.nodeType === n.TEXT_NODE)
            );
            resultStr = textNodes.length > 0 ? textNodes[0]!.data : "";
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

    return pipe(
        resultStr,
        collapseWhitespace,
        (str) => str.trim(),
        (str) => new SomeOption(str)
    );
}


export function selectText(query: string, contextNode: Node): string {
    return pipe(
        trySelectText(query, contextNode),
        (textOpt) => Option.throwIfNoneWith(`Failed to get text for xpath query "${query}".`, textOpt)
    );
}


export function trySelectInteger(query: string, contextNode: Node): Result<number, string> {
    return pipe(
        trySelectText(query, contextNode),
        (strOpt) => Result.fromOption(strOpt, `Failed to read text for query "${query}".`),
        (strRes) => Result.bind(tryParseInt, strRes)
    );
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
 * User-defined type guard that tests whether the specified value is a DOM
 * document.
 *
 * @param val - The value to be tested
 * @return true if _val_ is a Document; false otherwise.
 */
export function isDocument(val: unknown): val is Document {
    return (
        val !== null &&
        typeof val === "object" &&
        "nodeType" in val &&
        (val as Document).nodeType === 9 && // DOCUMENT_NODE is 9
        "documentElement" in val
    );
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


export function tryToElement<TElem extends Element = Element>(subject: Node | null): Option<TElem>;
export function tryToElement<TElem extends Element = Element>(subject: xpath.SelectReturnType): Option<TElem>;
export function tryToElement<TElem extends Element = Element>(subject: null | xpath.SelectReturnType): Option<TElem> {
    if (!subject) {
        return NoneOption.get();
    }
    else if (isElement(subject)) {
        return new SomeOption(subject as TElem);
    }
    else {
        return NoneOption.get();
    }
}


export function toElement<TElem extends Element = Element>(subject: Node | null): TElem;
export function toElement<TElem extends Element = Element>(subject: xpath.SelectReturnType): TElem;
export function toElement<TElem extends Element = Element>(subject: null | xpath.SelectReturnType): TElem {
    const opt = tryToElement(subject);
    if (opt.isSome) {
        return opt.value as TElem;
    }
    else {
        throw new Error(`Failed to convert xpath selection to an Element.`);
    }
}


/**
 * Attempts to convert a selection result to an array of Elements.
 *
 * @param selectRetVal - The selection result that will be converted
 * @return If successful, a Some containing the array of Elements.  Otherwise, a
 * None.
 */
export function tryToElementArray<TElem extends Element = Element>(
    selectRetVal: xpath.SelectReturnType
): Option<Array<TElem>> {
    const nodesOpt = tryToNodeArray(selectRetVal);
    if (nodesOpt.isNone) {
        return nodesOpt;
    }

    const elems = Option.choose(
        (curNode) => isElement(curNode) ? new SomeOption(curNode) : NoneOption.get(),
        nodesOpt.value
    );

    return elems.length === nodesOpt.value.length ?
        new SomeOption(elems as Array<TElem>) :
        NoneOption.get();
}


/**
 * Converts a selection result to an array of Elements.  Throws an Error if the
 * selection result did not include Elements.
 *
 * @param selectRetVal - The selection result that will be converted
 * @return The array of Elements.
 */
export function toElementArray<TElem extends Element = Element>(
    selectRetVal: xpath.SelectReturnType
): Array<TElem> {
    const opt = tryToElementArray(selectRetVal);
    if (opt.isSome) {
        return opt.value as Array<TElem>;
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


/**
 * Tries to read the value of the specified attribute.
 *
 * @param elem - The element containing the attribute to be read
 * @param attrName - The name of the attribute to be read
 * @return If the attribute exists, a successful Result containing its value;
 * otherwise a failed Result containing an error message.
 */
export function getAttr(elem: Element, attrName: string): Result<string, string> {

    // The DOM specification states that getAttribute() returns an empty string
    // for nonexistent attributes.  Therefore, we will first test to see if it
    // exists.
    if (!elem.hasAttribute(attrName)) {
        return new FailedResult(`Element ${elem.tagName} does not have a ${attrName} attribute.`);
    }

    return pipe(
        elem.getAttribute(attrName),
        (strOrNull) => Result.fromNullable(strOrNull, `Element "${elem.tagName}" does not have an attribute named "${attrName}".`)
    );
}


/**
 * Gets the boolean value of the specified attribute from the specified element.
 * If the attribute is not present, it is treated as false.  The attribute value
 * is expected to be "true" or "false" (ignoring case and leading and trailing
 * whitespace).
 *
 * @param elem - The element to get the attribute from
 * @param attrName - The name of the attribute to get
 * @return The boolean value
 */
export function getBoolAttr(elem: Element, attrName: string): boolean {
    const boolVal = pipe(
        getAttr(elem, attrName),
        Result.toOption,
        (optStr) => Option.mapSome(boolStrToBool, optStr),
        (optBool) => optBool.isNone ? false : optBool.value
    );
    return boolVal;
}


/**
 * Gets the preceding XML comment for the specified element by traversing
 * backwards through siblings until a Comment node is found.
 * @param element - The element to find the preceding comment for
 * @return A Some Option containing the comment text if found, otherwise None
 */
export function getPrecedingXmlComment(element: Element): Option<string> {
    let currentNode: Node | null = element.previousSibling;

    while (currentNode !== null) {
        if (currentNode.nodeType === currentNode.COMMENT_NODE) {
            const commentNode = currentNode as Comment;
            return new SomeOption(commentNode.textContent?.trim() || "");
        }
        else if (currentNode.nodeType === currentNode.ELEMENT_NODE) {
            // If we encounter another element before finding a comment,
            // then there's no immediate preceding comment.
            return NoneOption.get();
        }
        // Skip text nodes (typically whitespace) and continue searching
        currentNode = currentNode.previousSibling;
    }

    return NoneOption.get();
}
