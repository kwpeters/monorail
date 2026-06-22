import { BufReader } from "./bufReader.mjs";
import { SucceededResult } from "./result.mjs";


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


    describe("readTo16BitBoundary()", () => {

        it("does nothing when already aligned", () => {
            const reader = new BufReader(Uint8Array.from([0xAA, 0xBB]));

            const resPad = reader.readTo16BitBoundary();

            expect(resPad.succeeded).toBeTrue();
            expect(reader.currentOffset).toEqual(0);
            expect(reader.remainingBytes).toEqual(2);
        });


        it("consumes one byte when unaligned", () => {
            const reader = new BufReader(Uint8Array.from([0xAA, 0xBB, 0xCC]));
            reader.readUInt8();

            const resPad = reader.readTo16BitBoundary();

            expect(resPad.succeeded).toBeTrue();
            expect(reader.currentOffset).toEqual(2);
            expect(reader.remainingBytes).toEqual(1);
        });


        it("fails when unaligned and no bytes remain", () => {
            const reader = new BufReader(Uint8Array.from([0xAA]));
            reader.readUInt8();
            expect(reader.currentOffset).toEqual(1);

            const resPad = reader.readTo16BitBoundary();

            expect(resPad.failed).toBeTrue();
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


    describe("attempt()", () => {

        it("advances the cursor by bytes consumed when the callback succeeds", () => {
            const reader = new BufReader(Uint8Array.from([0xAA, 0xBB, 0xCC, 0xDD]));

            const result = reader.attempt((r) => {
                const a = r.readUInt8();
                const b = r.readUInt16();
                if (a.failed) { return a; }
                if (b.failed) { return b; }
                return new SucceededResult({ a: a.value, b: b.value });
            });

            expect(result.succeeded).toBeTrue();
            expect(reader.currentOffset).toEqual(3);
        });


        it("leaves the cursor unchanged when the callback fails", () => {
            const reader = new BufReader(Uint8Array.from([0xAA, 0xBB]));

            const result = reader.attempt((r) => {
                return r.readUInt32();  // needs 4 bytes, only 2 available
            });

            expect(result.failed).toBeTrue();
            expect(reader.currentOffset).toEqual(0);
        });


        it("returns the value produced by the callback on success", () => {
            const reader = new BufReader(Uint8Array.from([0x42]));

            const result = reader.attempt((r) => r.readUInt8());

            expect(result.succeeded).toBeTrue();
            expect(result.value).toEqual(0x42);
        });


        it("allows reading after a failed attempt", () => {
            const reader = new BufReader(Uint8Array.from([0xAA, 0xBB]));

            reader.attempt((r) => r.readUInt32());  // fails — cursor stays at 0

            const res = reader.readUInt8();
            expect(res.value).toEqual(0xAA);
        });


        it("composes: nested attempt advances outer cursor only on success", () => {
            const reader = new BufReader(Uint8Array.from([0x01, 0x02, 0x03]));

            reader.attempt((outer) => {
                const a = outer.readUInt8();
                if (a.failed) { return a; }

                const inner = outer.attempt((r) => r.readUInt16());
                if (inner.failed) { return inner; }

                return inner;
            });

            expect(reader.currentOffset).toEqual(3);
        });

    });


    describe("peek()", () => {

        it("returns a BufReader over the next n bytes without advancing the cursor", () => {
            const reader = new BufReader(Uint8Array.from([0xAA, 0xBB, 0xCC, 0xDD]));

            const resPeek = reader.peek(2);
            expect(resPeek.succeeded).toBeTrue();
            expect(reader.currentOffset).toEqual(0);

            const peeked = resPeek.value!;
            expect(peeked.readUInt8().value).toEqual(0xAA);
            expect(peeked.readUInt8().value).toEqual(0xBB);
        });


        it("does not affect the original reader's subsequent reads", () => {
            const reader = new BufReader(Uint8Array.from([0xAA, 0xBB, 0xCC]));

            reader.peek(2);

            const resRead = reader.readUInt8();
            expect(resRead.value).toEqual(0xAA);
        });


        it("respects the current cursor position when peeking", () => {
            const reader = new BufReader(Uint8Array.from([0xAA, 0xBB, 0xCC, 0xDD]));
            reader.readUInt8();  // advance past 0xAA

            const resPeek = reader.peek(2);
            expect(resPeek.succeeded).toBeTrue();

            const peeked = resPeek.value!;
            expect(peeked.readUInt8().value).toEqual(0xBB);
            expect(peeked.readUInt8().value).toEqual(0xCC);
        });


        it("succeeds when peeking zero bytes", () => {
            const reader = new BufReader(Uint8Array.from([0xAA]));

            const resPeek = reader.peek(0);
            expect(resPeek.succeeded).toBeTrue();
            expect(resPeek.value!.remainingBytes).toEqual(0);
        });


        it("fails when peeking more bytes than remain", () => {
            const reader = new BufReader(Uint8Array.from([0xAA, 0xBB]));

            const resPeek = reader.peek(3);
            expect(resPeek.failed).toBeTrue();
            expect(reader.currentOffset).toEqual(0);
        });


        it("fails when given a non-integer count", () => {
            const reader = new BufReader(Uint8Array.from([0xAA, 0xBB]));

            const resPeek = reader.peek(1.5);
            expect(resPeek.failed).toBeTrue();
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
