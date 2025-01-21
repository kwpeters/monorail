import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { pipe } from "@repo/depot/pipe";
import { validateIndex } from "@repo/depot/primitives";
import {Lint, Ulint} from "./lint.mjs";


/**
 * Facilitates the reading of data from a Buffer.
 */
export class BufReader {

    private _curIndex:           number = 0;
    private readonly _theBuffer: Buffer;


    /**
     * Creates a new BufReader.
     * @param theBuffer - the Buffer to be read
     */
    public constructor(theBuffer: Buffer) {
        this._theBuffer = theBuffer;
        Object.seal(this);
    }


     /**
      * Reads a byte at the current read position within the Buffer without
      * advancing the read position.
      *
      * @return A successful Result containing the byte value or a failed Result
      * containing an error message
      */
    public peekByte(): Result<number, string> {
        return pipe(validateIndex(this._curIndex, 1, this._theBuffer))
        .pipe((res) => Result.mapSuccess((idx) => this._theBuffer[idx]!, res))
        .end();
    }


    /**
     * Reads the next byte of data and returns it as a 1 or 0.  This is how
     * Studio 5000 displays BOOL values.
     *
     * @return A successful Result containing the BOOL value or a failed Result
     * containing an error message
     */
    public readBOOL(): Result<0 | 1, string> {
        return pipe(this.readUInt8())
        .pipe((res) => Result.mapSuccess((byteVal) => byteVal === 0 ? 0 : 1, res))
        .end();
    }


    /**
     * Reads the next byte of data from the Buffer as an unsigned 8-bit value.
     *
     * @return A successful Result containing the UInt8 value or a failed Result
     * containing an error message
     */
    public readUInt8(): Result<number, string> {
        return pipe(validateIndex(this._curIndex, 1, this._theBuffer))
        .pipe((res) => Result.mapSuccess(
            (idx) => {
                this._curIndex += 1;
                return this._theBuffer.readUInt8(idx);
            },
            res
        ))
        .end();
    }


    /**
     * Reads the next byte of data from the Buffer as an unsigned 8-bit value.
     *
     * @return A successful Result containing the SINT value or a failed Result
     * containing an error message
     */
    public readUSINT(): Result<number, string> { return this.readUInt8(); }


    /**
     * Reads the next byte of data from the Buffer as an unsigned 8-bit value.
     *
     * @return A successful Result containing the BYTE value or a failed Result
     * containing an error message
     */
    public readBYTE(): Result<number, string> { return this.readUInt8(); }


    /**
     * Reads the next byte of data from the Buffer as an signed 8-bit value.
     *
     * @return A successful Result containing the Int8 value or a failed Result
     * containing an error message
     */
    public readInt8(): Result<number, string> {

        return pipe(validateIndex(this._curIndex, 1, this._theBuffer))
        .pipe((res) => Result.mapSuccess((idx) => {
            this._curIndex += 1;
            return this._theBuffer.readInt8(idx);
        }, res))
        .end();
    }


    /**
     * Reads the next byte of data from the Buffer as an signed 8-bit value.
     *
     * @return A successful Result containing the SINT value or a failed Result
     * containing an error message
     */
    public readSINT(): Result<number, string> { return this.readInt8(); }


    /**
     * Reads the next two bytes of data from the Buffer as an unsigned 16-bit
     * value.
     *
     * @returns A successful Result containing the UInt16 value or a failed
     * Result containing an error message.
     */
    public readUInt16(): Result<number, string> {

        return pipe(validateIndex(this._curIndex, 2, this._theBuffer))
        .pipe((res) => Result.mapSuccess((idx) => {
            this._curIndex += 2;
            return this._theBuffer.readUInt16LE(idx);
        }, res))
        .end();
    }


    /**
     * Reads the next two bytes of data from the Buffer as an unsigned 16-bit
     * value.
     *
     * @returns A successful Result containing the UINT value or a failed
     * Result containing an error message.
     */
    public readUINT(): Result<number, string> { return this.readUInt16(); }


    /**
     * Reads the next two bytes of data from the Buffer as an unsigned 16-bit
     * value.
     *
     * @returns A successful Result containing the WORD value or a failed
     * Result containing an error message.
     */
    public readWORD(): Result<number, string> { return this.readUInt16(); }


    /**
     * Reads the next two bytes of data from the Buffer as an unsigned 16-bit
     * big endian value.
     *
     * @returns A successful Result containing the UInt16 BE value or a failed
     * Result containing an error message
     */
    public readUInt16BE(): Result<number, string> {
        return pipe(validateIndex(this._curIndex, 2, this._theBuffer))
        .pipe((res) => Result.mapSuccess((idx) => {
            this._curIndex += 2;
            return this._theBuffer.readUInt16BE(idx);
        }, res))
        .end();
    }


    /**
     * Reads the next two bytes of data from the Buffer as a signed 16-bit
     * value.
     *
     * @returns A successful Result containing the Int16 value or a failed
     * Result containing an error message
     */
    public readInt16(): Result<number, string> {
        return pipe(validateIndex(this._curIndex, 2, this._theBuffer))
        .pipe((res) => Result.mapSuccess((idx) => {
            this._curIndex += 2;
            return this._theBuffer.readInt16LE(idx);
        }, res))
        .end();
    }


    /**
     * Reads the next two bytes of data from the Buffer as a signed 16-bit
     * value.
     *
     * @returns A successful Result containing the INT value or a failed
     * Result containing an error message
     */
    public readINT(): Result<number, string> { return this.readInt16(); }


    /**
     * Reads the next four bytes of data from the Buffer as an unsigned 32-bit
     * value
     *
     * @returns A successful Result containing the UInt32 value or a failed
     * Result containing an error message
     */
    public readUInt32(): Result<number, string> {
        return pipe(validateIndex(this._curIndex, 4, this._theBuffer))
        .pipe((res) => Result.mapSuccess((idx) => {
            this._curIndex += 4;
            return this._theBuffer.readUInt32LE(idx);
        }, res))
        .end();
    }


    /**
     * Reads the next four bytes of data from the Buffer as an unsigned 32-bit
     * value
     *
     * @returns A successful Result containing the UDINT value or a failed
     * Result containing an error message
     */
    public readUDINT(): Result<number, string> { return this.readUInt32(); }


    /**
     * Reads the next four bytes of data from the Buffer as an unsigned 32-bit
     * value
     *
     * @returns A successful Result containing the DWORD value or a failed
     * Result containing an error message
     */
    public readDWORD(): Result<number, string> { return this.readUInt32(); }


    /**
     * Reads the next four bytes of data from the Buffer as an unsigned 32-bit
     * big endian value
     *
     * @returns A successful Result containing the UInt32 BE value or a failed
     * Result containing an error message.
     */
    public readUInt32BE(): Result<number, string> {
        return pipe(validateIndex(this._curIndex, 4, this._theBuffer))
        .pipe((res) => Result.mapSuccess((idx) => {
            this._curIndex += 4;
            return this._theBuffer.readUInt32BE(idx);
        }, res))
        .end();
    }


    /**
     * Reads the next four bytes of data from the Buffer as a signed 32-bit
     * value
     *
     * @returns A successful Result containing the Int32 value or a failed
     * Result containing an error message
     */
    public readInt32(): Result<number, string> {
        return pipe(validateIndex(this._curIndex, 4, this._theBuffer))
        .pipe((res) => Result.mapSuccess((idx) => {
            this._curIndex += 4;
            return this._theBuffer.readInt32LE(idx);
        }, res))
        .end();
    }


    /**
     * Reads the next four bytes of data from the Buffer as a signed 32-bit
     * value
     *
     * @returns A successful Result containing the DINT value or a failed
     * Result containing an error message
     */
    public readDINT(): Result<number, string> { return this.readInt32(); }


    /**
     * Reads the next 8 bytes of data from the Buffer as an unsigned 64-bit
     * value.
     *
     * @returns A successful Result containing the UInt64 value or a failed
     * Result containing an error message
     */
    public readUInt64(): Result<Ulint, string> {
        return pipe(Ulint.fromBuffer(this._theBuffer, this._curIndex))
        .pipe((res) => Result.tapSuccess(() => this._curIndex += 8, res))
        .end();
    }


    /**
     * Reads the next 8 bytes of data from the Buffer as an unsigned 64-bit
     * value.
     *
     * @returns A successful Result containing the ULINT value or a failed
     * Result containing an error message
     */
    public readULINT(): Result<Ulint, string> { return this.readUInt64(); }


    /**
     * Reads the next 8 bytes of data from the Buffer as a signed 64-bit value.
     *
     * @returns A successful Result containing the Int64 value or a failed
     * Result containing an error message.
     */
    public readInt64(): Result<Lint, string> {
        return pipe(Lint.fromBuffer(this._theBuffer, this._curIndex))
        .pipe((res) => Result.tapSuccess(() => this._curIndex += 8, res))
        .end();
    }


    /**
     * Reads the next 8 bytes of data from the Buffer as a signed 64-bit value.
     *
     * @returns A successful Result containing the LINT value or a failed
     * Result containing an error message.
     */
    public readLINT(): Result<Lint, string> { return this.readInt64(); }


    /**
     * Reads the next 4 bytes of data from the Buffer as a single precision
     * (32-bit) floating point number
     *
     * @return A successful Result containing the float value or a failed Result
     * containing an error message
     */
    public readFloat(): Result<number, string> {
        return pipe(validateIndex(this._curIndex, 4, this._theBuffer))
        .pipe((res) => Result.mapSuccess((idx) => {
            this._curIndex += 4;
            return this._theBuffer.readFloatLE(idx);
        }, res))
        .end();
    }


    /**
     * Reads the next 4 bytes of data from the Buffer as a single precision
     * (32-bit) floating point number
     *
     * @return A successful Result containing the REAL value or a failed Result
     * containing an error message
     */
    public readREAL(): Result<number, string> { return this.readFloat(); }


    /**
     * Reads the next 8 bytes of data from the Buffer as a double precision
     * (64-bit) floating point number
     *
     * @return A successful Result containing the double value or a failed Result
     * containing an error message
     */
    public readDouble(): Result<number, string> {
        return pipe(validateIndex(this._curIndex, 8, this._theBuffer))
        .pipe((res) => Result.mapSuccess((idx) => {
            this._curIndex += 8;
            return this._theBuffer.readDoubleLE(idx);
        }, res))
        .end();
    }


    /**
     * Reads the next 8 bytes of data from the Buffer as a double precision
     * (64-bit) floating point number
     *
     * @return A successful Result containing the LREAL value or a failed Result
     * containing an error message
     */
    public readLREAL(): Result<number, string> { return this.readDouble(); }


    /**
     * Reads a short string from the current location in the Buffer. A short
     * string contains an unsigned 8-bit character count followed by the
     * specified number of ASCII characters.
     *
     * @returns A successful Result containing the short string value or a
     * failed Result containing an error message
     */
    public readShortString(): Result<string, string> {
        // Read the character count.
        return pipe(this.readUInt8())
        // Map to an object with a numChars property.
        .pipe((res) => Result.mapSuccess((numChars) => ({ numChars }), res))
        // If the specified number of characters can be read from the buffer,
        // augment the object with the current read index.
        .pipe((res) => Result.augment(({numChars}) => {
            return pipe(validateIndex(this._curIndex, numChars, this._theBuffer))
            .pipe((res) => Result.mapSuccess(() => ({idx: res.value!}), res))
            .end();
        }, res))
        .pipe((res) => Result.mapSuccess(({numChars, idx}) => {
            const str: string = this._theBuffer.toString("ascii", idx, idx + numChars);
            this._curIndex += numChars;
            return str;
        }, res))
        .end();
    }


    /**
     * Reads a string from the current location in the Buffer.  A string
     * contains an unsigned 16-bit character count followed by the specified
     * number of ASCII characters.
     *
     * @returns A successful Result containing the string value or a failed
     * Result containing an error message
     */
    public readString(): Result<string, string> {
        return pipe(this.readUInt16())
        // Map to an object with a numChars property.
        .pipe((res) => Result.mapSuccess((numChars) => ({numChars}), res))
        // If the specified number of characters can be read from the buffer,
        // augment the object with the current read index.
        .pipe((res) => Result.augment(({numChars}) => {
            return pipe(validateIndex(this._curIndex, numChars, this._theBuffer))
            .pipe((res) => Result.mapSuccess(() => ({idx: res.value!}), res))
            .end();
        }, res))
        .pipe((res) => Result.mapSuccess(({numChars, idx}) => {
            const str: string = this._theBuffer.toString("ascii", idx, idx + numChars);
            this._curIndex += numChars;
            return str;
        }, res))
        .end();
    }


    /**
     * Reads the specified number of characters from the Buffer.
     *
     * @param numChars - Number of characters to read
     * @returns A successful Result containing the string value or a failed
     * Result containing an error message
     */
    public readFixedLengthString(numChars: number): Result<string, string> {
        return pipe(validateIndex(this._curIndex, numChars, this._theBuffer))
        .pipe((res) => Result.mapSuccess((idx) => {
            const str: string = this._theBuffer.toString("ascii", idx, idx + numChars);
            this._curIndex += numChars;
            return str;
        }, res))
        .end();
    }


    /**
     * Reads the specified number of bytes (or all remaining bytes) at the
     * current location in the Buffer.
     *
     * @param numBytes - The number of bytes to read.  If undefined, all
     * remaining bytes will be read.  If greater than the number of bytes
     * remaining, only the remaining bytes will be read.
     * @return A successful Result containing a Buffer.  If there is an error, a
     * failed Result with an error message will be returned.  If numBytes was
     * specified and there are not that many bytes left be read from the Buffer,
     * a failed Result will be returned.
     */
    public readBytes(numBytes?: number): Result<Buffer, string> {

        // If not specified, the number of bytes to read will be the number of
        // bytes left in the source buffer.
        if (numBytes === undefined) {
            numBytes = this._theBuffer.length - this._curIndex;
        }
        const endIndex = this._curIndex + numBytes;

        // If the caller has specified that we read more bytes than what
        // remains, return an error.
        if (endIndex > this._theBuffer.length) {
            return new FailedResult(`Cannot read ${numBytes} bytes from buffer starting at index ${this._curIndex}`);
        }

        const readBuf = this._theBuffer.subarray(this._curIndex, endIndex);
        this._curIndex = endIndex;
        return new SucceededResult(readBuf);
    }


    /**
     * Returns the number of bytes that have not been read.
     * @returns The number of bytes that have not been read.
     */
    public numBytesRemaining(): number {
        return this._theBuffer.length - this._curIndex;
    }


    /**
     * Tells the caller whether all data has been read out of the source buffer.
     * @returns true if all data has been read out of the source buffer.  false
     *     if there is still data to be read.
     */
    public atEnd(): boolean {
        return this._curIndex >= this._theBuffer.length;
    }

}
Object.freeze(BufReader.prototype);
