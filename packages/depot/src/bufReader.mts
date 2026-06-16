import { FailedResult, type Result, SucceededResult } from "./result.mjs";


/**
 * Endianness options for multi-byte reads.
 */
export type Endianness = "little-endian" | "big-endian";


/**
 * Reads elementary values from an in-memory byte buffer while managing an
 * internal cursor.
 */
export class BufReader {

    private _currentOffset = 0;
    private readonly _dataView: DataView;


    /**
     * Creates a new reader over the specified bytes.
     *
     * @param source - The underlying bytes to read from.
     */
    public constructor(source: ArrayBufferLike | ArrayBufferView) {
        this._dataView =
            source instanceof DataView ? source :
            ArrayBuffer.isView(source) ? new DataView(source.buffer, source.byteOffset, source.byteLength) :
            new DataView(source);
    }


    /**
     * The current cursor offset measured from the start of this reader's view.
     */
    public get currentOffset(): number {
        return this._currentOffset;
    }


    /**
     * The number of unread bytes remaining in this reader's view.
     */
    public get remainingBytes(): number {
        return this._dataView.byteLength - this._currentOffset;
    }


    /**
     * Moves the cursor to the specified absolute offset.
     */
    public seek(byteOffset: number): Result<void, string> {
        if (!Number.isInteger(byteOffset)) {
            return new FailedResult("Byte offset must be an integer.");
        }

        if (byteOffset < 0 || byteOffset > this._dataView.byteLength) {
            return new FailedResult(
                `Byte offset ${byteOffset} is out of range. ` +
                `Must be between 0 and ${this._dataView.byteLength}.`
            );
        }

        this._currentOffset = byteOffset;
        return new SucceededResult(undefined);
    }


    /**
     * Advances the cursor by the specified number of bytes.
     */
    public skip(numBytes: number): Result<void, string> {
        if (!Number.isInteger(numBytes)) {
            return new FailedResult("Number of bytes to skip must be an integer.");
        }

        return this.seek(this._currentOffset + numBytes);
    }


    /**
     * Reads a signed 8-bit integer.
     */
    public readInt8(): Result<number, string> {
        return this._readWith(1, (offset) => this._dataView.getInt8(offset));
    }


    /**
     * Reads an unsigned 8-bit integer.
     */
    public readUInt8(): Result<number, string> {
        return this._readWith(1, (offset) => this._dataView.getUint8(offset));
    }


    /**
     * Reads a signed 16-bit integer.
     */
    public readInt16(endianness: Endianness = "little-endian"): Result<number, string> {
        return this._readWith(2, (offset) => this._dataView.getInt16(offset, isLittleEndian(endianness)));
    }


    /**
     * Reads an unsigned 16-bit integer.
     */
    public readUInt16(endianness: Endianness = "little-endian"): Result<number, string> {
        return this._readWith(2, (offset) => this._dataView.getUint16(offset, isLittleEndian(endianness)));
    }


    /**
     * Reads a signed 32-bit integer.
     */
    public readInt32(endianness: Endianness = "little-endian"): Result<number, string> {
        return this._readWith(4, (offset) => this._dataView.getInt32(offset, isLittleEndian(endianness)));
    }


    /**
     * Reads an unsigned 32-bit integer.
     */
    public readUInt32(endianness: Endianness = "little-endian"): Result<number, string> {
        return this._readWith(4, (offset) => this._dataView.getUint32(offset, isLittleEndian(endianness)));
    }


    /**
     * Reads a signed 64-bit integer.
     */
    public readBigInt64(endianness: Endianness = "little-endian"): Result<bigint, string> {
        return this._readWith(8, (offset) => this._dataView.getBigInt64(offset, isLittleEndian(endianness)));
    }


    /**
     * Reads an unsigned 64-bit integer.
     */
    public readBigUInt64(endianness: Endianness = "little-endian"): Result<bigint, string> {
        return this._readWith(8, (offset) => this._dataView.getBigUint64(offset, isLittleEndian(endianness)));
    }


    /**
     * Reads a 32-bit floating-point value.
     */
    public readFloat32(endianness: Endianness = "little-endian"): Result<number, string> {
        return this._readWith(4, (offset) => this._dataView.getFloat32(offset, isLittleEndian(endianness)));
    }


    /**
     * Reads a 64-bit floating-point value.
     */
    public readFloat64(endianness: Endianness = "little-endian"): Result<number, string> {
        return this._readWith(8, (offset) => this._dataView.getFloat64(offset, isLittleEndian(endianness)));
    }


    /**
     * Reads raw bytes.
     */
    public readBytes(numBytes: number): Result<Uint8Array, string> {
        if (!Number.isInteger(numBytes)) {
            return new FailedResult("Number of bytes to read must be an integer.");
        }

        if (numBytes < 0) {
            return new FailedResult("Number of bytes to read must be non-negative.");
        }

        return this._readWith(numBytes, (offset) => {
            const bytes = new Uint8Array(
                this._dataView.buffer,
                this._dataView.byteOffset + offset,
                numBytes
            );
            return bytes.slice();
        });
    }


    private _readWith<TValue>(
        numBytes: number,
        readFn: (byteOffset: number) => TValue
    ): Result<TValue, string> {
        if (this.remainingBytes < numBytes) {
            return new FailedResult(
                `Cannot read ${numBytes} byte(s). ` +
                `${this.remainingBytes} byte(s) remain.`
            );
        }

        const value = readFn(this._currentOffset);
        this._currentOffset += numBytes;
        return new SucceededResult(value);
    }
}


function isLittleEndian(endianness: Endianness): boolean {
    return endianness === "little-endian";
}
