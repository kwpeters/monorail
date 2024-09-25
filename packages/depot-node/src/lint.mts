// eslint-disable-next-line @typescript-eslint/naming-convention
import Long from "long";
import { IntRange } from "@repo/depot/intRange";
import { Result } from "@repo/depot/result";
import { pipe } from "@repo/depot/pipe";
import { validateIndex } from "@repo/depot/primitives";
// TODO: Remove the following dependency and this file can move to depot.
import { BufReader } from "./bufReader.mjs";


/**
 * @classdesc A class for representing signed long (64-bit) integers
 *
 * This class uses the "long" npm library.  It is wrapped here to
 * differentiate between signed and unsigned values.
 */
export class Lint {

    public static minValue: Lint = new Lint(Long.MIN_VALUE);
    public static maxValue: Lint = new Lint(Long.MAX_VALUE);


    public static fromBuffer(buf: Buffer, offset: number = 0): Result<Lint, string> {
        return pipe(validateIndex(offset, 8, buf))
        .pipe((res) => Result.mapSuccess((idx) => {
            const littleEndianBytes = Array.from(new IntRange(0, 8)).map((curIndex) => {
                return buf.readUInt8(idx + curIndex);
            });

            const val = Long.fromBytesLE(littleEndianBytes, false);
            return new Lint(val);
        }, res))
        .end();
    }


    public static fromBufReader(reader: BufReader): Result<Lint, string> {
        return pipe(reader.numBytesRemaining())
        .pipe((bytesRemaining) => Result.fromBool(
            bytesRemaining >= 8,
            undefined,
            `Cannot read Lint from BufReader that only has ${bytesRemaining} remaining bytes`
        ))
        .pipe((res) => Result.bind(() => {
            return pipe(Array.from(new IntRange(0, 8)).map(() => reader.readUInt8()))
            .pipe(Result.allArrayM)
            .end();
        }, res))
        .pipe((res) => Result.mapSuccess((bytes) => new Lint(Long.fromBytesLE(bytes, false)), res))
        .end();
    }


    public static fromBytesLE(bytes: Array<number>): Result<Lint, string> {
        return pipe(validateIndex(0, 8, bytes))
        .pipe((res) => Result.mapSuccess(() => new Lint(Long.fromBytesLE(bytes, false)), res))
        .end();
    }


    // region Data Members
    private readonly _value: Long;
    // endregion


    private constructor(value: Long) {
        if (value.unsigned) {
            throw new Error("Lint internal error.  Attempted to construct with an unsigned value.");
        }

        this._value = value;

        // Make this instance immutable.
        Object.freeze(this);
    }


    public toString(radix: number = 10): string {
        return this._value.toString(radix);
    }

    public toNumber(): number {
        return this._value.toNumber();
    }


    public toBuffer(): Buffer {
        const bytes = this._value.toBytesLE();
        return Buffer.from(bytes);
    }


}

Object.freeze(Lint.prototype);
Object.freeze(Lint);


/**
 * @classdesc A class for representing unsigned long (64-bit) integers
 *
 * This class uses the "long" npm library.  It is wrapped here to
 * differentiate between signed and unsigned values.
 */
export class Ulint {

    public static minValue: Ulint = new Ulint(Long.UZERO);
    public static maxValue: Ulint = new Ulint(Long.MAX_UNSIGNED_VALUE);


    public static fromBuffer(buf: Buffer, offset: number = 0): Result<Ulint, string> {
        return pipe(validateIndex(offset, 8, buf))
        .pipe((res) => Result.mapSuccess((idx) => {
            const littleEndianBytes = Array.from(new IntRange(0, 8)).map((curIndex) => {
                return buf.readUInt8(idx + curIndex);
            });

            const val = Long.fromBytesLE(littleEndianBytes, true);
            return new Ulint(val);
        }, res))
        .end();
    }


    public static fromBufReader(reader: BufReader): Result<Ulint, string> {
        return pipe(reader.numBytesRemaining())
        .pipe((bytesRemaining) => Result.fromBool(
            bytesRemaining >= 8,
            undefined,
            `Cannot read Ulint from BufReader that only has ${bytesRemaining} remaining bytes`
        ))
        .pipe((res) => Result.bind(() => {
            return pipe(Array.from(new IntRange(0, 8)).map(() => reader.readUInt8()))
            .pipe(Result.allArrayM)
            .end();
        }, res))
        .pipe((res) => Result.mapSuccess((bytes) => new Ulint(Long.fromBytesLE(bytes, true)), res))
        .end();
    }


    public static fromBytesLE(bytes: Array<number>): Result<Ulint, string> {
        return pipe(validateIndex(0, 8, bytes))
        .pipe((res) => Result.mapSuccess(() => new Ulint(Long.fromBytesLE(bytes, true)), res))
        .end();
    }


    // region Data Members
    private readonly _value: Long;
    // endregion


    private constructor(value: Long) {
        if (!value.unsigned) {
            throw new Error("Ulint internal error.  Attempted to construct with a signed value.");
        }

        this._value = value;

        // Make this instance immutable.
        Object.freeze(this);
    }


    public toString(radix: number = 10): string {
        return this._value.toString(radix);
    }


    public toBuffer(): Buffer {
        const bytes = this._value.toBytesLE();
        return Buffer.from(bytes);
    }

}

Object.freeze(Ulint.prototype);
Object.freeze(Ulint);
