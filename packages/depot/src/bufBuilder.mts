import type { Endianness } from "./bufReader.mjs";


/**
 * Used to dynamically build ArrayBuffers in a platform-neutral way.
 */
export class BufBuilder {

    private readonly _parts: Array<Uint8Array> = [];


    /**
     * Gets the number of bytes that have been stored.
     */
    public get length(): number {
        return this._parts.reduce((acc, cur) => acc + cur.byteLength, 0);
    }


    /**
     * Appends a BOOL value encoded as 0x00 (false) or 0x01 (true).
     */
    public appendBool(value: boolean | 0 | 1): this {
        return this.appendUInt8(value ? 0x01 : 0x00);
    }


    /**
     * Appends an unsigned 8-bit value.
     */
    public appendUInt8(value: number): this {
        const buf = new ArrayBuffer(1);
        new DataView(buf).setUint8(0, value);
        this._parts.push(new Uint8Array(buf));
        return this;
    }


    /**
     * Appends a signed 8-bit value.
     */
    public appendInt8(value: number): this {
        const buf = new ArrayBuffer(1);
        new DataView(buf).setInt8(0, value);
        this._parts.push(new Uint8Array(buf));
        return this;
    }


    /**
     * Appends an unsigned 16-bit value.
     */
    public appendUInt16(value: number, endianness: Endianness = "little-endian"): this {
        const buf = new ArrayBuffer(2);
        new DataView(buf).setUint16(0, value, endianness === "little-endian");
        this._parts.push(new Uint8Array(buf));
        return this;
    }


    /**
     * Appends a signed 16-bit value.
     */
    public appendInt16(value: number, endianness: Endianness = "little-endian"): this {
        const buf = new ArrayBuffer(2);
        new DataView(buf).setInt16(0, value, endianness === "little-endian");
        this._parts.push(new Uint8Array(buf));
        return this;
    }


    /**
     * Appends an unsigned 32-bit value.
     */
    public appendUInt32(value: number, endianness: Endianness = "little-endian"): this {
        const buf = new ArrayBuffer(4);
        new DataView(buf).setUint32(0, value, endianness === "little-endian");
        this._parts.push(new Uint8Array(buf));
        return this;
    }


    /**
     * Appends a signed 32-bit value.
     */
    public appendInt32(value: number, endianness: Endianness = "little-endian"): this {
        const buf = new ArrayBuffer(4);
        new DataView(buf).setInt32(0, value, endianness === "little-endian");
        this._parts.push(new Uint8Array(buf));
        return this;
    }


    /**
     * Appends an unsigned 64-bit value.
     */
    public appendBigUInt64(value: bigint, endianness: Endianness = "little-endian"): this {
        const buf = new ArrayBuffer(8);
        new DataView(buf).setBigUint64(0, value, endianness === "little-endian");
        this._parts.push(new Uint8Array(buf));
        return this;
    }


    /**
     * Appends a signed 64-bit value.
     */
    public appendBigInt64(value: bigint, endianness: Endianness = "little-endian"): this {
        const buf = new ArrayBuffer(8);
        new DataView(buf).setBigInt64(0, value, endianness === "little-endian");
        this._parts.push(new Uint8Array(buf));
        return this;
    }


    /**
     * Appends a 32-bit floating-point value.
     */
    public appendFloat32(value: number, endianness: Endianness = "little-endian"): this {
        const buf = new ArrayBuffer(4);
        new DataView(buf).setFloat32(0, value, endianness === "little-endian");
        this._parts.push(new Uint8Array(buf));
        return this;
    }


    /**
     * Appends a 64-bit floating-point value.
     */
    public appendFloat64(value: number, endianness: Endianness = "little-endian"): this {
        const buf = new ArrayBuffer(8);
        new DataView(buf).setFloat64(0, value, endianness === "little-endian");
        this._parts.push(new Uint8Array(buf));
        return this;
    }


    /**
     * Appends raw bytes by copying them into this builder.
     */
    public appendBytes(source: ArrayBufferLike | ArrayBufferView): this {
        const copied =
            ArrayBuffer.isView(source) ?
                new Uint8Array(source.buffer, source.byteOffset, source.byteLength).slice() :
                new Uint8Array(source).slice();

        this._parts.push(copied);
        return this;
    }


    /**
     * Appends data from another source.
     */
    public append(source: ArrayBufferLike | ArrayBufferView | BufBuilder): this {
        if (source instanceof BufBuilder) {
            return this.appendBytes(source.toArrayBuffer());
        }

        return this.appendBytes(source);
    }


    /**
     * Appends zero-valued pad bytes until the length is a multiple of 2 bytes
     * (a 16-bit word boundary).  At most one pad byte is appended; if the
     * length is already aligned, nothing is appended.
     */
    public padTo16BitBoundary(): this {
        if (this.length % 2 !== 0) {
            this.appendUInt8(0x00);
        }
        return this;
    }


    /**
     * Returns the contents of this builder as an ArrayBuffer.
     */
    public toArrayBuffer(): ArrayBuffer {
        const totalLength = this.length;
        const dest = new Uint8Array(totalLength);
        let writeOffset = 0;

        for (const part of this._parts) {
            dest.set(part, writeOffset);
            writeOffset += part.byteLength;
        }

        return dest.buffer;
    }

}
