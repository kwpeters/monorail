import { pipe } from "./pipe2.mjs";
import { FailedResult, Result, SucceededResult } from "./result.mjs";
import { isNonBlankString } from "./stringHelpers.mjs";


export class Int8 {

    public static get dataTypeMin(): number {
        return Math.pow(-2, 7);        // -128
    }


    public static get dataTypeMax(): number {
        return Math.pow(2, 7) - 1;      // 127
    }


    public static fromString(str: string): Result<Int8, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid Int8 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return Int8.create(num);
            }, res)
        );
    }


    public static create(val: number): Result<Int8, string> {
        if (val < Int8.dataTypeMin || val > Int8.dataTypeMax) {
            return new FailedResult(`"${val}" is not a valid Int8 value.  Must be between ${Int8.dataTypeMin} and ${Int8.dataTypeMax}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid Int8 value.  Must be an integer.`);
        }

        return new SucceededResult(new Int8(val));
    }


    private readonly _val: number;


    public get static(): typeof Int8 {
        return Int8;
    }


    private constructor(val: number) {
        this._val = val;
    }


    public get value(): number {
        return this._val;
    }
}


export class UInt8 {

    public static get dataTypeMin(): number {
        return 0;
    }


    public static get dataTypeMax(): number {
        return Math.pow(2, 8) - 1;      // 255
    }


    public static fromString(str: string): Result<UInt8, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid UInt8 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return UInt8.create(num);
            }, res)
        );
    }


    public static create(val: number): Result<UInt8, string> {
        if (val < UInt8.dataTypeMin || val > UInt8.dataTypeMax) {
            return new FailedResult(`"${val}" is not a valid UInt8 value.  Must be between ${UInt8.dataTypeMin} and ${UInt8.dataTypeMax}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid UInt8 value.  Must be an integer.`);
        }

        return new SucceededResult(new UInt8(val));
    }


    private readonly _val: number;


    public get static(): typeof UInt8 {
        return UInt8;
    }


    private constructor(val: number) {
        this._val = val;
    }


    public get value(): number {
        return this._val;
    }
}


export class Int16 {

    public static get dataTypeMin(): number {
        return Math.pow(-2, 15);       // -32_768
    }


    public static get dataTypeMax(): number {
        return Math.pow(2, 15) - 1;      // 32_767
    }


    public static fromString(str: string): Result<Int16, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid Int16 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return Int16.create(num);
            }, res)
        );
    }


    public static create(val: number): Result<Int16, string> {
        if (val < Int16.dataTypeMin || val > Int16.dataTypeMax) {
            return new FailedResult(`"${val}" is not a valid Int16 value.  Must be between ${Int16.dataTypeMin} and ${Int16.dataTypeMax}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid Int16 value.  Must be an integer.`);
        }

        return new SucceededResult(new Int16(val));
    }


    private readonly _val: number;


    public get static(): typeof Int16 {
        return Int16;
    }


    private constructor(val: number) {
        this._val = val;
    }


    public get value(): number {
        return this._val;
    }
}


export class UInt16 {

    public static get dataTypeMin(): number {
        return 0;
    }


    public static get dataTypeMax(): number {
        return Math.pow(2, 16) - 1;      // 65_535
    }


    public static fromString(str: string): Result<UInt16, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid UInt16 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return UInt16.create(num);
            }, res)
        );
    }


    public static create(val: number): Result<UInt16, string> {
        if (val < UInt16.dataTypeMin || val > UInt16.dataTypeMax) {
            return new FailedResult(`"${val}" is not a valid UInt16 value.  Must be between ${UInt16.dataTypeMin} and ${UInt16.dataTypeMax}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid UInt16 value.  Must be an integer.`);
        }

        return new SucceededResult(new UInt16(val));
    }


    private readonly _val: number;


    public get static(): typeof UInt16 {
        return UInt16;
    }


    private constructor(val: number) {
        this._val = val;
    }


    public get value(): number {
        return this._val;
    }
}


export class Int32 {

    public static get dataTypeMin(): number {
        return Math.pow(-2, 31);        // -2_147_483_648
    }


    public static get dataTypeMax(): number {
        return Math.pow(2, 31) - 1;      // 2_147_483_647
    }


    public static fromString(str: string): Result<Int32, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid Int32 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return Int32.create(num);
            }, res)
        );
    }


    public static create(val: number): Result<Int32, string> {
        if (val < Int32.dataTypeMin || val > Int32.dataTypeMax) {
            return new FailedResult(`"${val}" is not a valid Int32 value.  Must be between ${Int32.dataTypeMin} and ${Int32.dataTypeMax}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid Int32 value.  Must be an integer.`);
        }

        return new SucceededResult(new Int32(val));
    }


    private readonly _val: number;


    public get static(): typeof Int32 {
        return Int32;
    }


    private constructor(val: number) {
        this._val = val;
    }


    public get value(): number {
        return this._val;
    }
}


export class UInt32 {

    public static get dataTypeMin(): number {
        return 0;
    }


    public static get dataTypeMax(): number {
        return Math.pow(2, 32) - 1;      // 4_294_967_295
    }


    public static fromString(str: string): Result<UInt32, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid UInt32 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return UInt32.create(num);
            }, res)
        );
    }


    public static create(val: number): Result<UInt32, string> {
        if (val < UInt32.dataTypeMin || val > UInt32.dataTypeMax) {
            return new FailedResult(`"${val}" is not a valid UInt32 value.  Must be between ${UInt32.dataTypeMin} and ${UInt32.dataTypeMax}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid UInt32 value.  Must be an integer.`);
        }

        return new SucceededResult(new UInt32(val));
    }


    private readonly _val: number;


    public get static(): typeof UInt32 {
        return UInt32;
    }


    private constructor(val: number) {
        this._val = val;
    }


    public get value(): number {
        return this._val;
    }
}


export class Int64 {

    public static get dataTypeMin(): bigint {
        return BigInt(-2) ** BigInt(63);        // -9_223_372_036_854_775_808n
    }


    public static get dataTypeMax(): bigint {
        return BigInt(2) ** BigInt(63) - BigInt(1);      // 9_223_372_036_854_775_807n
    }


    public static fromString(str: string): Result<Int64, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid INT value."),
            (res) => Result.bind(
                (str) => {
                    try {
                        const num = BigInt(str);
                        return Int64.create(num);
                    }
                    catch (err) {
                        return new FailedResult(`"${str}" is not a valid LINT value.  Must be an integer.`);
                    }
                },
                res
            )
        );
    }


    public static create(val: bigint): Result<Int64, string> {
        if (val < Int64.dataTypeMin || val > Int64.dataTypeMax) {
            return new FailedResult(`"${val}" is not a valid Int64 value.  Must be between ${Int64.dataTypeMin} and ${Int64.dataTypeMax}.`);
        }

        //
        // Unlike the other integer types which are based on Number, BigInt is
        // always an integer.  Therefore, there is no need to check for a
        // fractional part using Number.isInteger().
        //

        return new SucceededResult(new Int64(val));
    }


    private readonly _val: bigint;


    public get static(): typeof Int64 {
        return Int64;
    }


    private constructor(val: bigint) {
        this._val = val;
    }


    public get value(): bigint {
        return this._val;
    }
}


export class UInt64 {

    public static get dataTypeMin(): bigint {
        return BigInt(0);
    }


    public static get dataTypeMax(): bigint {
        return BigInt(2) ** BigInt(64) - BigInt(1);     // 18_446_744_073_709_551_615n
    }


    public static fromString(str: string): Result<UInt64, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid UInt64 value."),
            (res) => Result.bind(
                (str) => {

                    try {
                        const num = BigInt(str);
                        return UInt64.create(num);
                    }
                    catch (err) {
                        return new FailedResult(`"${str}" is not a valid UInt64 value.  Must be an integer.`);
                    }
                },
                res
            )
        );
    }


    public static create(val: bigint): Result<UInt64, string> {
        if (val < UInt64.dataTypeMin || val > UInt64.dataTypeMax) {
            return new FailedResult(`"${val}" is not a valid Uint64 value.  Must be between ${UInt64.dataTypeMin} and ${UInt64.dataTypeMax}.`);
        }

        //
        // Unlike the other integer types which are based on Number, BigInt is
        // always an integer.  Therefore, there is no need to check for a
        // fractional part using Number.isInteger().
        //

        return new SucceededResult(new UInt64(val));
    }


    private readonly _val: bigint;

    public get static(): typeof UInt64 {
        return UInt64;
    }


    private constructor(val: bigint) {
        this._val = val;
    }


    public get value(): bigint {
        return this._val;
    }
}


export class Float32 {

    public static get dataTypeMin(): number {
        return -3.4028235e38;
    }


    public static get dataTypeMax(): number {
        return 3.4028235e38;
    }


    public static fromString(str: string): Result<Float32, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid Float32 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return Float32.create(num);
            }, res)
        );
    }


    public static create(val: number): Result<Float32, string> {
        if (val < Float32.dataTypeMin || val > Float32.dataTypeMax) {
            return new FailedResult(`"${val}" is not a valid Float32 value.  Must be between ${Float32.dataTypeMin} and ${Float32.dataTypeMax}.`);
        }

        if (!Number.isFinite(val)) {
            return new FailedResult(`"${val}" is not a valid Float32 value.  Must be a finite number.`);
        }

        return new SucceededResult(new Float32(val));
    }


    private readonly _val: number;


    public get static(): typeof Float32 {
        return Float32;
    }


    private constructor(val: number) {
        this._val = val;
    }


    public get value(): number {
        return this._val;
    }
}


export class Float64 {

    public static get dataTypeMin(): number {
        return -1 * Number.MAX_VALUE;
    }


    public static get dataTypeMax(): number {
        return Number.MAX_VALUE;
    }


    public static fromString(str: string): Result<Float64, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid Float64 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return Float64.create(num);
            }, res)
        );
    }


    public static create(val: number): Result<Float64, string> {
        if (val < Float64.dataTypeMin || val > Float64.dataTypeMax) {
            return new FailedResult(`"${val}" is not a valid Float64 value.  Must be between ${Float64.dataTypeMin} and ${Float64.dataTypeMax}.`);
        }

        if (!Number.isFinite(val)) {
            return new FailedResult(`"${val}" is not a valid Float64 value.  Must be a finite number.`);
        }

        return new SucceededResult(new Float64(val));
    }


    private readonly _val: number;


    public get static(): typeof Float64 {
        return Float64;
    }


    private constructor(val: number) {
        this._val = val;
    }


    public get value(): number {
        return this._val;
    }
}
