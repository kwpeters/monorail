import nacl from "tweetnacl";
import { type Brand } from "./brand.mjs";


/**
 * A hash value in string form.
 */
export type HashString = Brand<string, "HashString">;


////////////////////////////////////////////////////////////////////////////////
// Asynchronous hash()
////////////////////////////////////////////////////////////////////////////////

/**
 * Hashing algorithms supported by the ECMAScript Web Crypto API SubtleCrypto
 * interface.
 * See: https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest
 */
export const hashAlgorithms = {
    sha1:   "SHA-1",
    sha256: "SHA-256",
    sha384: "SHA-384",
    sha512: "SHA-512"
} as const;
export type HashAlgorithm = typeof hashAlgorithms[keyof typeof hashAlgorithms];


/**
 * Hashes the specified string.  Works in both browsers and Node.js.
 *
 * @param message - The text to be encrypted
 * @return Description
 */
export async function hash(
    message: string
): Promise<HashString> {

    // Convert the message string to a byte array.
    const msgUint8 = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest(hashAlgorithms.sha256, msgUint8);

    // Convert the digest to a byte array.
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    // Convert the digest byte array to a string containing the hex bytes.
    const hashHex =
        hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    return hashHex as HashString;
}


////////////////////////////////////////////////////////////////////////////////
// Synchronous hash()
////////////////////////////////////////////////////////////////////////////////


/**
 * A function that takes a value and returns its hash.
 */
export type HashFn<T> = (val: T) => HashString;


/**
 * Hashes the specified string.  Works in both browsers and Node.js.
 * @param str - The string to be hashed
 * @param encoding - The encoding used in the returned string ("base64" or
 * "hex")
 * @returns The hashed value of the string
 */
export function hashSync(
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
