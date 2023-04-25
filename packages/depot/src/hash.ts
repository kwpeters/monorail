import nacl from "tweetnacl";
import { Brand } from "./brand.js";


/**
 * A hash value in string form.
 */
export type HashString = Brand<string, "HashString">;


/**
 * A function that takes a value and returns its hash.
 */
export type HashFn<T> = (val: T) => HashString;


/**
 * Hashes the specified string
 * @param str - The string to be hashed
 * @param encoding - The encoding used in the returned string ("base64" or
 * "hex")
 * @returns The hashed value of the string
 */
export function hash(
    str: string,
    encoding: "hex" | "base64" = "hex"
): HashString {
    const encoder = new TextEncoder();
    const strBuf = encoder.encode(str);
    const hashUInt8Arr = nacl.hash(strBuf);
    const hashBuf = Buffer.from(hashUInt8Arr);
    const hashStr = hashBuf.toString(encoding);
    return hashStr as HashString;
}


// Node.js implementation
//
// export function hash(
//     str: string,
//     algorithm: string = "sha256",
//     encoding: crypto.BinaryToTextEncoding = "hex"
// ): HashString {
//     const hash = crypto.createHash(algorithm).update(str).digest(encoding);
//     return hash as HashString;
// }
