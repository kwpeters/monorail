import {Lint, Ulint} from "./lint.mjs";

/**
 * Used to dynamically build Buffers.
 */
export class BufBuilder {

    private readonly _parts: Array<Buffer> = [];

    public constructor() {
        Object.seal(this);
    }

    /**
     * Gets the number of bytes that have been stored.
     */
    public get length(): number {
        return this._parts.reduce((accum, cur) => accum + cur.length, 0);
    }

    /**
     * Appends a BOOL (8-bit) value.
     * @param value - The boolean value to be appended
     */
    public appendBOOL(value: boolean | 0 | 1): void {
        // CIP spec vol. 1 C-5.2.1 states that 0x00 is used for false and 0x01
        // is used for true.
        this.appendUInt8(value ? 0x01 : 0x00);
    }

    /**
     * Appends an unsigned 8-bit value.
     * @param value - The value to append
     */
    public appendUInt8(value: number): void {
        const buf = Buffer.alloc(1);
        buf.writeUInt8(value, 0);
        this._parts.push(buf);
    }

    public appendUSINT(value: number): void { this.appendUInt8(value); }
    public appendBYTE(value: number): void { this.appendUInt8(value); }

    /**
     * Appends a signed 8-bit value.
     * @param value - The value to append
     */
    public appendInt8(value: number): void {
        const buf = Buffer.alloc(1);
        buf.writeInt8(value, 0);
        this._parts.push(buf);
    }

    public appendSINT(value: number): void { this.appendInt8(value); }

    /**
     * Appends an unsigned 16-bit value.
     * @param value - The value to append
     */
    public appendUInt16(value: number): void {
        const buf = Buffer.alloc(2);
        buf.writeUInt16LE(value, 0);
        this._parts.push(buf);
    }

    public appendUINT(value: number): void { this.appendUInt16(value); }
    public appendWORD(value: number): void { this.appendUInt16(value); }

    /**
     * Appends a signed 16-bit value.
     * @param value - The value to append
     */
    public appendInt16(value: number): void {
        const buf = Buffer.alloc(2);
        buf.writeInt16LE(value, 0);
        this._parts.push(buf);
    }

    public appendINT(value: number): void { this.appendInt16(value); }

    /**
     * Appends an unsigned 32-bit value.
     * @param value - The value to append
     */
    public appendUInt32(value: number): void {
        const buf = Buffer.alloc(4);
        buf.writeUInt32LE(value, 0);
        this._parts.push(buf);
    }

    public appendUDINT(value: number): void { this.appendUInt32(value); }
    public appendDWORD(value: number): void { this.appendUInt32(value); }

    /**
     * Appends a signed 32-bit value.
     * @param value - The value to append
     */
    public appendInt32(value: number): void {
        const buf = Buffer.alloc(4);
        buf.writeInt32LE(value, 0);
        this._parts.push(buf);
    }

    public appendDINT(value: number): void { this.appendInt32(value); }


    public appendUInt64(value: Ulint): void {
        const buf = value.toBuffer();
        this._parts.push(buf);
    }

    public appendULINT(value: Ulint): void { this.appendUInt64(value); }


    public appendInt64(value: Lint): void {
        const buf = value.toBuffer();
        this._parts.push(buf);
    }

    public appendLINT(value: Lint): void { this.appendInt64(value); }


    /**
     * Appends a IEEE 754 format floating point value.
     * @param value - The value to append
     */
    public appendFloat(value: number): void {
        const buf = Buffer.alloc(4);
        buf.writeFloatLE(value, 0);
        this._parts.push(buf);
    }

    public appendREAL(value: number): void { this.appendFloat(value); }


    public appendDouble(value: number): void {
        const buf = Buffer.alloc(8);
        buf.writeDoubleLE(value, 0);
        this._parts.push(buf);
    }

    public appendLREAL(value: number): void { this.appendDouble(value); }


    /**
     * Appends the length and a string value.
     * @param value - The value to append
     */
    public appendString(value: string): void {
        const sizeBytes = 2;                // size of the string length field
        const neededBytes = sizeBytes + value.length;

        const buf = Buffer.alloc(neededBytes);
        buf.writeUInt16LE(value.length, 0);
        buf.write(value, sizeBytes, value.length, "ascii");
        this._parts.push(buf);
    }

    /**
     * Appends the specified Buffer onto the end of this BufBuilder's contents.
     * @param buffer - The Buffer to be appended
     */
    public appendBuffer(buffer: Buffer): void {
        const copied = Buffer.from(buffer);
        this._parts.push(copied);
    }

    /**
     * Appends the contents of the specified BufBuilder onto the end of this
     * BufBuilder's contents.
     * @param src - The data to be appended
     */
    public appendBufBuilder(src: BufBuilder): void {
        this._parts.push(src.toBuffer());
    }

    /**
     * Returns the contents of this BufBuilder as a Buffer.
     * @returns A Buffer containing the data from this BufBuilder.
     */
    public toBuffer(): Buffer {
        return Buffer.concat(this._parts);
    }

}
Object.freeze(BufBuilder.prototype);
