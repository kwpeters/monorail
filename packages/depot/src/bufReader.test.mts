import { BufReader } from "./bufReader.mjs";


describe("BufReader", () => {

    describe("currentOffset and remainingBytes", () => {

        it("tracks cursor position as values are read", () => {
            const reader = new BufReader(Uint8Array.from([0x01, 0x02, 0x03]));

            expect(reader.currentOffset).toEqual(0);
            expect(reader.remainingBytes).toEqual(3);

            const resRead = reader.readUInt8();
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(0x01);
            expect(reader.currentOffset).toEqual(1);
            expect(reader.remainingBytes).toEqual(2);
        });

    });


    describe("seek() and skip()", () => {

        it("moves the cursor within range", () => {
            const reader = new BufReader(Uint8Array.from([0x10, 0x20, 0x30]));

            expect(reader.seek(2).succeeded).toBeTrue();
            expect(reader.currentOffset).toEqual(2);

            expect(reader.skip(-1).succeeded).toBeTrue();
            expect(reader.currentOffset).toEqual(1);
        });


        it("fails when seeking out of range", () => {
            const reader = new BufReader(Uint8Array.from([0x10, 0x20, 0x30]));

            const resRead = reader.seek(4);
            expect(resRead.failed).toBeTrue();
            expect(reader.currentOffset).toEqual(0);
        });

    });


    describe("readUInt8()", () => {

        it("reads an unsigned byte", () => {
            const reader = new BufReader(Uint8Array.from([0xFE]));

            const resRead = reader.readUInt8();
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(0xFE);
        });

    });


    describe("readInt8()", () => {

        it("reads a signed byte", () => {
            const reader = new BufReader(Uint8Array.from([0xFE]));

            const resRead = reader.readInt8();
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(-2);
        });

    });


    describe("readInt16()", () => {

        it("defaults to little-endian", () => {
            const reader = new BufReader(Uint8Array.from([0x34, 0x12]));

            const resRead = reader.readInt16();
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(0x1234);
        });


        it("supports big-endian", () => {
            const reader = new BufReader(Uint8Array.from([0x12, 0x34]));

            const resRead = reader.readInt16("big-endian");
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(0x1234);
        });

    });


    describe("readUInt16()", () => {

        it("defaults to little-endian", () => {
            const reader = new BufReader(Uint8Array.from([0x34, 0x12]));

            const resRead = reader.readUInt16();
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(0x1234);
        });


        it("supports big-endian", () => {
            const reader = new BufReader(Uint8Array.from([0x12, 0x34]));

            const resRead = reader.readUInt16("big-endian");
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(0x1234);
        });

    });


    describe("readInt32()", () => {

        it("reads a signed 32-bit integer", () => {
            const reader = new BufReader(Uint8Array.from([0xFC, 0xFF, 0xFF, 0xFF]));

            const resRead = reader.readInt32();
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(-4);
        });

    });


    describe("readUInt32()", () => {

        it("reads an unsigned 32-bit integer", () => {
            const reader = new BufReader(Uint8Array.from([0x78, 0x56, 0x34, 0x12]));

            const resRead = reader.readUInt32();
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(0x12345678);
        });

    });


    describe("readFloat32()", () => {

        it("reads a 32-bit float", () => {
            const reader = new BufReader(Uint8Array.from([0x00, 0x00, 0xC0, 0x3F]));

            const resRead = reader.readFloat32();
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(1.5);
        });


        it("supports big-endian", () => {
            const reader = new BufReader(Uint8Array.from([0x3F, 0xC0, 0x00, 0x00]));

            const resRead = reader.readFloat32("big-endian");
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(1.5);
        });

    });


    describe("readFloat64()", () => {

        it("reads a 64-bit float", () => {
            const reader = new BufReader(Uint8Array.from([
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0xF8, 0x3F
            ]));

            const resRead = reader.readFloat64();
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(1.5);
        });


        it("supports big-endian", () => {
            const reader = new BufReader(Uint8Array.from([
                0x3F, 0xF8, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00
            ]));

            const resRead = reader.readFloat64("big-endian");
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(1.5);
        });

    });


    describe("readBigInt64()", () => {

        it("reads a signed 64-bit integer", () => {
            const reader = new BufReader(Uint8Array.from([
                0xFE, 0xFF, 0xFF, 0xFF,
                0xFF, 0xFF, 0xFF, 0xFF
            ]));

            const resRead = reader.readBigInt64();
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(-2n);
        });

    });


    describe("readBigUInt64()", () => {

        it("reads an unsigned 64-bit integer", () => {
            const reader = new BufReader(Uint8Array.from([
                0x08, 0x07, 0x06, 0x05,
                0x04, 0x03, 0x02, 0x01
            ]));

            const resRead = reader.readBigUInt64();
            expect(resRead.succeeded).toBeTrue();
            expect(resRead.value).toEqual(0x0102030405060708n);
        });

    });


    describe("readBytes()", () => {

        it("returns a copy of the requested bytes", () => {
            const source = Uint8Array.from([0xAA, 0xBB, 0xCC]);
            const reader = new BufReader(source);

            const resRead = reader.readBytes(2);
            expect(resRead.succeeded).toBeTrue();
            expect(Array.from(resRead.value!)).toEqual([0xAA, 0xBB]);

            source[0] = 0x00;
            expect(Array.from(resRead.value!)).toEqual([0xAA, 0xBB]);
        });

    });


    describe("bounds checking", () => {

        it("fails when reading beyond the end of the buffer", () => {
            const reader = new BufReader(Uint8Array.from([0x01]));

            const resRead = reader.readUInt16();
            expect(resRead.failed).toBeTrue();
            expect(reader.currentOffset).toEqual(0);
        });

    });

});
