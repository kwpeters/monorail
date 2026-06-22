import { BufBuilder } from "./bufBuilder.mjs";
import { BufReader } from "./bufReader.mjs";


describe("BufBuilder", () => {

    describe("length", () => {

        it("tracks bytes appended from primitives and raw bytes", () => {
            const bb = new BufBuilder();

            expect(bb.length).toEqual(0);

            bb.appendUInt8(0x11)
            .appendUInt16(0x2233)
            .appendBytes(Uint8Array.from([0x44, 0x55]));

            expect(bb.length).toEqual(5);
        });

    });


    describe("appendUInt8()", () => {

        it("appends unsigned 8-bit values", () => {
            const bb = new BufBuilder();
            bb.appendUInt8(0xFF);

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0xFF);
        });


        it("returns this for method chaining", () => {
            const bb = new BufBuilder();
            const result = bb.appendUInt8(0x11);

            expect(result).toBe(bb);
        });

    });


    describe("appendInt8()", () => {

        it("appends signed 8-bit values", () => {
            const bb = new BufBuilder();
            bb.appendInt8(-42);

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readInt8().value).toEqual(-42);
        });

    });


    describe("appendUInt16()", () => {

        it("stores bytes in little-endian order by default", () => {
            const bb = new BufBuilder();
            bb.appendUInt16(0x1234);

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0x34);
            expect(bytes[1]).toEqual(0x12);
        });


        it("stores bytes in big-endian order when specified", () => {
            const bb = new BufBuilder();
            bb.appendUInt16(0x1234, "big-endian");

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0x12);
            expect(bytes[1]).toEqual(0x34);
        });

    });


    describe("appendInt16()", () => {

        it("stores bytes in little-endian order by default", () => {
            const bb = new BufBuilder();
            bb.appendInt16(-1000);

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0x18);
            expect(bytes[1]).toEqual(0xFC);
        });


        it("stores bytes in big-endian order when specified", () => {
            const bb = new BufBuilder();
            bb.appendInt16(-1000, "big-endian");

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0xFC);
            expect(bytes[1]).toEqual(0x18);
        });

    });


    describe("appendUInt32()", () => {

        it("stores bytes in little-endian order by default", () => {
            const bb = new BufBuilder();
            bb.appendUInt32(0x12345678);

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0x78);
            expect(bytes[1]).toEqual(0x56);
            expect(bytes[2]).toEqual(0x34);
            expect(bytes[3]).toEqual(0x12);
        });


        it("stores bytes in big-endian order when specified", () => {
            const bb = new BufBuilder();
            bb.appendUInt32(0x12345678, "big-endian");

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0x12);
            expect(bytes[1]).toEqual(0x34);
            expect(bytes[2]).toEqual(0x56);
            expect(bytes[3]).toEqual(0x78);
        });

    });


    describe("appendInt32()", () => {

        it("stores bytes in little-endian order by default", () => {
            const bb = new BufBuilder();
            bb.appendInt32(-123456);

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0xC0);
            expect(bytes[1]).toEqual(0x1D);
            expect(bytes[2]).toEqual(0xFE);
            expect(bytes[3]).toEqual(0xFF);
        });


        it("stores bytes in big-endian order when specified", () => {
            const bb = new BufBuilder();
            bb.appendInt32(-123456, "big-endian");

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0xFF);
            expect(bytes[1]).toEqual(0xFE);
            expect(bytes[2]).toEqual(0x1D);
            expect(bytes[3]).toEqual(0xC0);
        });

    });


    describe("appendBigUInt64()", () => {

        it("stores bytes in little-endian order by default", () => {
            const bb = new BufBuilder();
            bb.appendBigUInt64(0x0102030405060708n);

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0x08);
            expect(bytes[1]).toEqual(0x07);
            expect(bytes[2]).toEqual(0x06);
            expect(bytes[3]).toEqual(0x05);
            expect(bytes[4]).toEqual(0x04);
            expect(bytes[5]).toEqual(0x03);
            expect(bytes[6]).toEqual(0x02);
            expect(bytes[7]).toEqual(0x01);
        });


        it("stores bytes in big-endian order when specified", () => {
            const bb = new BufBuilder();
            bb.appendBigUInt64(0x0102030405060708n, "big-endian");

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0x01);
            expect(bytes[1]).toEqual(0x02);
            expect(bytes[2]).toEqual(0x03);
            expect(bytes[3]).toEqual(0x04);
            expect(bytes[4]).toEqual(0x05);
            expect(bytes[5]).toEqual(0x06);
            expect(bytes[6]).toEqual(0x07);
            expect(bytes[7]).toEqual(0x08);
        });

    });


    describe("appendBigInt64()", () => {

        it("stores bytes in little-endian order by default", () => {
            const bb = new BufBuilder();
            bb.appendBigInt64(-9223372036854775808n);

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0x00);
            expect(bytes[1]).toEqual(0x00);
            expect(bytes[2]).toEqual(0x00);
            expect(bytes[3]).toEqual(0x00);
            expect(bytes[4]).toEqual(0x00);
            expect(bytes[5]).toEqual(0x00);
            expect(bytes[6]).toEqual(0x00);
            expect(bytes[7]).toEqual(0x80);
        });


        it("stores bytes in big-endian order when specified", () => {
            const bb = new BufBuilder();
            bb.appendBigInt64(-9223372036854775808n, "big-endian");

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes[0]).toEqual(0x80);
            expect(bytes[1]).toEqual(0x00);
            expect(bytes[2]).toEqual(0x00);
            expect(bytes[3]).toEqual(0x00);
            expect(bytes[4]).toEqual(0x00);
            expect(bytes[5]).toEqual(0x00);
            expect(bytes[6]).toEqual(0x00);
            expect(bytes[7]).toEqual(0x00);
        });

    });


    describe("appendFloat32()", () => {

        it("stores bytes in little-endian order by default", () => {
            const bb = new BufBuilder();
            bb.appendFloat32(1.5);

            const buf = bb.toArrayBuffer();
            const view = new DataView(buf);
            const value = view.getFloat32(0, true);
            expect(value).toEqual(1.5);
        });


        it("stores bytes in big-endian order when specified", () => {
            const bb = new BufBuilder();
            bb.appendFloat32(1.5, "big-endian");

            const buf = bb.toArrayBuffer();
            const view = new DataView(buf);
            const value = view.getFloat32(0, false);
            expect(value).toEqual(1.5);
        });

    });


    describe("appendFloat64()", () => {

        it("stores bytes in little-endian order by default", () => {
            const bb = new BufBuilder();
            bb.appendFloat64(1.5);

            const buf = bb.toArrayBuffer();
            const view = new DataView(buf);
            const value = view.getFloat64(0, true);
            expect(value).toEqual(1.5);
        });


        it("stores bytes in big-endian order when specified", () => {
            const bb = new BufBuilder();
            bb.appendFloat64(2.71828, "big-endian");

            const buf = bb.toArrayBuffer();
            const view = new DataView(buf);
            const value = view.getFloat64(0, false);
            expect(value).toEqual(2.71828);
        });

    });


    describe("appendBytes()", () => {

        it("appends from ArrayBufferView", () => {
            const bb = new BufBuilder();
            bb.appendBytes(Uint8Array.from([0xAA, 0xBB]));

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0xAA);
            expect(reader.readUInt8().value).toEqual(0xBB);
        });


        it("appends from ArrayBuffer", () => {
            const buf = new ArrayBuffer(2);
            const view = new DataView(buf);
            view.setUint8(0, 0xCC);
            view.setUint8(1, 0xDD);

            const bb = new BufBuilder();
            bb.appendBytes(buf);

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0xCC);
            expect(reader.readUInt8().value).toEqual(0xDD);
        });


        it("copies input data", () => {
            const source = Uint8Array.from([0xAA, 0xBB]);
            const bb = new BufBuilder();
            bb.appendBytes(source);

            source[0] = 0x00;

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0xAA);
        });

    });


    describe("append()", () => {

        it("appends another BufBuilder", () => {
            const bb1 = new BufBuilder();
            bb1.appendUInt8(0x11).appendUInt8(0x22);

            const bb2 = new BufBuilder();
            bb2.appendUInt8(0x33).appendUInt8(0x44);

            bb1.append(bb2);

            const reader = new BufReader(bb1.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0x11);
            expect(reader.readUInt8().value).toEqual(0x22);
            expect(reader.readUInt8().value).toEqual(0x33);
            expect(reader.readUInt8().value).toEqual(0x44);
        });


        it("appends ArrayBufferView", () => {
            const source = Uint8Array.from([0xAA, 0xBB]);
            const bb = new BufBuilder();

            bb.append(source);
            source[0] = 0x00;

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0xAA);
            expect(reader.readUInt8().value).toEqual(0xBB);
        });


        it("appends ArrayBuffer", () => {
            const buf = new ArrayBuffer(2);
            const view = new DataView(buf);
            view.setUint8(0, 0xEE);
            view.setUint8(1, 0xFF);

            const bb = new BufBuilder();
            bb.append(buf);

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0xEE);
            expect(reader.readUInt8().value).toEqual(0xFF);
        });

    });


    describe("padTo16BitBoundary()", () => {

        it("appends a single zero byte when the length is odd", () => {
            const bb = new BufBuilder();
            bb.appendUInt8(0x11);

            bb.padTo16BitBoundary();

            const bytes = new Uint8Array(bb.toArrayBuffer());
            expect(bytes.length).toEqual(2);
            expect(bytes[0]).toEqual(0x11);
            expect(bytes[1]).toEqual(0x00);
        });


        it("does nothing when the length is already a multiple of 2", () => {
            const bb = new BufBuilder();
            bb.appendUInt16(0x1122);

            bb.padTo16BitBoundary();

            expect(bb.length).toEqual(2);
        });


        it("does nothing when the builder is empty", () => {
            const bb = new BufBuilder();

            bb.padTo16BitBoundary();

            expect(bb.length).toEqual(0);
        });


        it("appends at most one pad byte", () => {
            const bb = new BufBuilder();
            bb.appendBytes(Uint8Array.from([0x11, 0x22, 0x33]));

            bb.padTo16BitBoundary();

            expect(bb.length).toEqual(4);
        });


        it("is idempotent once aligned", () => {
            const bb = new BufBuilder();
            bb.appendUInt8(0x11);

            bb.padTo16BitBoundary();
            bb.padTo16BitBoundary();

            expect(bb.length).toEqual(2);
        });


        it("returns this for method chaining", () => {
            const bb = new BufBuilder();
            const result = bb.padTo16BitBoundary();

            expect(result).toBe(bb);
        });

    });


    describe("appendBool()", () => {

        it("encodes false as 0x00", () => {
            const bb = new BufBuilder();
            bb.appendBool(false);

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0x00);
        });


        it("encodes true as 0x01", () => {
            const bb = new BufBuilder();
            bb.appendBool(true);

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0x01);
        });


        it("encodes 0 as 0x00", () => {
            const bb = new BufBuilder();
            bb.appendBool(0);

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0x00);
        });


        it("encodes 1 as 0x01", () => {
            const bb = new BufBuilder();
            bb.appendBool(1);

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0x01);
        });

    });


    describe("toArrayBuffer()", () => {

        it("combines multiple parts into a single buffer", () => {
            const bb = new BufBuilder();
            bb.appendUInt8(0x11)
            .appendUInt16(0x2233)
            .appendUInt32(0x44556677);

            const buf = bb.toArrayBuffer();
            const reader = new BufReader(buf);

            expect(reader.readUInt8().value).toEqual(0x11);
            expect(reader.readUInt16().value).toEqual(0x2233);
            expect(reader.readUInt32().value).toEqual(0x44556677);
        });


        it("produces empty buffer when nothing appended", () => {
            const bb = new BufBuilder();
            const buf = bb.toArrayBuffer();

            expect(buf.byteLength).toEqual(0);
        });

    });


    describe("method chaining", () => {

        it("allows fluent API usage", () => {
            const bb = new BufBuilder();
            bb.appendUInt8(0x11)
            .appendUInt16(0x2233)
            .appendUInt32(0x44556677)
            .appendInt8(-1)
            .appendBool(true)
            .appendBytes(Uint8Array.from([0xAA]));

            const reader = new BufReader(bb.toArrayBuffer());
            expect(reader.readUInt8().value).toEqual(0x11);
            expect(reader.readUInt16().value).toEqual(0x2233);
            expect(reader.readUInt32().value).toEqual(0x44556677);
            expect(reader.readInt8().value).toEqual(-1);
            expect(reader.readUInt8().value).toEqual(0x01);
            expect(reader.readUInt8().value).toEqual(0xAA);
        });

    });

});
