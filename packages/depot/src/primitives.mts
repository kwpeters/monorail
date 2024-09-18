import { Result, SucceededResult, FailedResult } from "./result.mjs";

////////////////////////////////////////////////////////////////////////////////
// IHasToString
////////////////////////////////////////////////////////////////////////////////


export interface IHasToString {
    toString(): string;
}


export function isIToString(other: unknown): other is IHasToString {
    const otherAny = other as IHasToString;
    return otherAny.toString &&
           typeof otherAny.toString === "function";
}


////////////////////////////////////////////////////////////////////////////////
// IHasLength
////////////////////////////////////////////////////////////////////////////////


export interface IHasLength {
    length: number;
}


export function isIHasLength(other: unknown): other is IHasLength {
    const otherX = other as Partial<IHasLength>;
    return typeof otherX === "number" ||
        typeof otherX === "bigint";
}


/**
 * Validates a Buffer index.
 *
 * @param startIndex - The index into the buffer
 * @param itemsNeeded - The number of bytes to be read starting at _index_.
 * @param buf - The buffer to be read from
 * @return A successful Result containing the index if it is valid.  A failed
 * Result containing an error message otherwise.
 */
export function validateIndex(startIndex: number, itemsNeeded: number, container: IHasLength): Result<number, string> {

    if (startIndex < 0) {
        return new FailedResult(`Invalid starting index ${startIndex}.`);
    }
    else if (itemsNeeded < 0) {
        return new FailedResult(`Invalid number of items needed: ${itemsNeeded}`);
    }
    else if (itemsNeeded <= 0) {
        return new SucceededResult(startIndex);
    }

    const containerSize = container.length;
    const lastContainerIndex = containerSize - 1;

    const lastIndexNeeded = startIndex + itemsNeeded - 1;

    return lastIndexNeeded <= lastContainerIndex ?
        new SucceededResult(startIndex) :
        new FailedResult(`Invalid index ${startIndex} when reading ${itemsNeeded} items from container with length ${containerSize}`);
}
