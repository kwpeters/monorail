import type { BufReader } from "./bufReader.mjs";
import type { Result } from "./result.mjs";


/**
 * Static interface for types that can decode an instance from a buffer reader.
 */
export interface IDecoderStatic<TDecoded> {

    /**
     * Decodes a value from the specified buffer reader.
     *
     * @param reader - The buffer reader to read from
     * @return A Result containing the decoded value or an error message
     */
    decode(reader: BufReader): Result<TDecoded, string>;
}


/**
 * Instance interface for values that can encode themselves.
 */
export interface IEncoderInstance {

    /**
     * Encodes this instance into an ArrayBuffer.
     *
     * @return An ArrayBuffer containing the encoded value
     */
    encode(): ArrayBuffer;
}
