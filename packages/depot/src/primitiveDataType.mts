import { pipe } from "./pipe2.mjs";
import { FailedResult, Result, SucceededResult } from "./result.mjs";
import { isNonBlankString } from "./stringHelpers.mjs";
import { setBitInBigInt, setBitInNumber } from "./bitstringHelpers.mjs";


export class Int8 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static get dataTypeMin(): number {
        return Math.pow(-2, 7);        // -128
    }


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static get dataTypeMax(): number {
        return Math.pow(2, 7) - 1;      // 127
    }


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static get numBits(): number {
        return 8;
    }


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static get maxBitIndex(): number {
        return Int8.numBits - 1;
    }


    /**
     * Creates an instance from a string representation
     * @param str - The string to parse
     * @return A Result containing the new instance or an error message
     */
    public static fromString(str: string): Result<Int8, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid Int8 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return Int8.create(num);
            }, res)
        );
    }


    /**
     * Creates an instance from a number
     * @param val - The number to wrap
     * @return A Result containing the new instance or an error message
     */
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


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public get static(): typeof Int8 {
        return Int8;
    }


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): number {
        return this._val;
    }


    /**
     * Gets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to read
     * @return A Result containing the bit value or an error message
     */
    public getBit(bitIndex: number): Result<boolean, string> {
        if (bitIndex < 0 || bitIndex > Int8.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int8.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int8 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Sets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<Int8, string> {
        if (bitIndex < 0 || bitIndex > Int8.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int8.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int8 bit index.  Must be an integer.`);
        }

        return pipe(
            setBitInNumber(this._val, bitIndex, newBitVal),
            (num) => Int8.create(num)
        );
    }
}


export class UInt8 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static get dataTypeMin(): number {
        return 0;
    }


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static get dataTypeMax(): number {
        return Math.pow(2, 8) - 1;      // 255
    }


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static get numBits(): number {
        return 8;
    }


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static get maxBitIndex(): number {
        return UInt8.numBits - 1;
    }


    /**
     * Creates an instance from a string representation
     * @param str - The string to parse
     * @return A Result containing the new instance or an error message
     */
    public static fromString(str: string): Result<UInt8, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid UInt8 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return UInt8.create(num);
            }, res)
        );
    }


    /**
     * Creates an instance from a number
     * @param val - The number to wrap
     * @return A Result containing the new instance or an error message
     */
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


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public get static(): typeof UInt8 {
        return UInt8;
    }


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): number {
        return this._val;
    }


    /**
     * Gets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to read
     * @return A Result containing the bit value or an error message
     */
    public getBit(bitIndex: number): Result<boolean, string> {
        if (bitIndex < 0 || bitIndex > UInt8.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt8.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt8 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Sets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<UInt8, string> {
        if (bitIndex < 0 || bitIndex > UInt8.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt8.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt8 bit index.  Must be an integer.`);
        }

        return pipe(
            setBitInNumber(this._val, bitIndex, newBitVal),
            (num) => UInt8.create(num)
        );
    }
}


export class Int16 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static get dataTypeMin(): number {
        return Math.pow(-2, 15);       // -32_768
    }


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static get dataTypeMax(): number {
        return Math.pow(2, 15) - 1;      // 32_767
    }


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static get numBits(): number {
        return 16;
    }


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static get maxBitIndex(): number {
        return Int16.numBits - 1;
    }


    /**
     * Creates an instance from a string representation
     * @param str - The string to parse
     * @return A Result containing the new instance or an error message
     */
    public static fromString(str: string): Result<Int16, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid Int16 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return Int16.create(num);
            }, res)
        );
    }


    /**
     * Creates an instance from a number
     * @param val - The number to wrap
     * @return A Result containing the new instance or an error message
     */
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


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public get static(): typeof Int16 {
        return Int16;
    }


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): number {
        return this._val;
    }


    /**
     * Gets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to read
     * @return A Result containing the bit value or an error message
     */
    public getBit(bitIndex: number): Result<boolean, string> {
        if (bitIndex < 0 || bitIndex > Int16.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int16.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int16 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Sets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<Int16, string> {
        if (bitIndex < 0 || bitIndex > Int16.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int16.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int16 bit index.  Must be an integer.`);
        }

        return pipe(
            setBitInNumber(this._val, bitIndex, newBitVal),
            (num) => Int16.create(num)
        );
    }
}


export class UInt16 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static get dataTypeMin(): number {
        return 0;
    }


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static get dataTypeMax(): number {
        return Math.pow(2, 16) - 1;      // 65_535
    }


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static get numBits(): number {
        return 16;
    }


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static get maxBitIndex(): number {
        return UInt16.numBits - 1;
    }


    /**
     * Creates an instance from a string representation
     * @param str - The string to parse
     * @return A Result containing the new instance or an error message
     */
    public static fromString(str: string): Result<UInt16, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid UInt16 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return UInt16.create(num);
            }, res)
        );
    }


    /**
     * Creates an instance from a number
     * @param val - The number to wrap
     * @return A Result containing the new instance or an error message
     */
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


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public get static(): typeof UInt16 {
        return UInt16;
    }


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): number {
        return this._val;
    }


    /**
     * Gets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to read
     * @return A Result containing the bit value or an error message
     */
    public getBit(bitIndex: number): Result<boolean, string> {
        if (bitIndex < 0 || bitIndex > UInt16.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt16.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt16 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Sets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<UInt16, string> {
        if (bitIndex < 0 || bitIndex > UInt16.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt16.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt16 bit index.  Must be an integer.`);
        }

        return pipe(
            setBitInNumber(this._val, bitIndex, newBitVal),
            (num) => UInt16.create(num)
        );
    }
}


export class Int32 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static get dataTypeMin(): number {
        return Math.pow(-2, 31);        // -2_147_483_648
    }


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static get dataTypeMax(): number {
        return Math.pow(2, 31) - 1;      // 2_147_483_647
    }


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static get numBits(): number {
        return 32;
    }


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static get maxBitIndex(): number {
        return Int32.numBits - 1;
    }


    /**
     * Creates an instance from a string representation
     * @param str - The string to parse
     * @return A Result containing the new instance or an error message
     */
    public static fromString(str: string): Result<Int32, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid Int32 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return Int32.create(num);
            }, res)
        );
    }


    /**
     * Creates an instance from a number
     * @param val - The number to wrap
     * @return A Result containing the new instance or an error message
     */
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


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public get static(): typeof Int32 {
        return Int32;
    }


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): number {
        return this._val;
    }


    /**
     * Gets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to read
     * @return A Result containing the bit value or an error message
     */
    public getBit(bitIndex: number): Result<boolean, string> {
        if (bitIndex < 0 || bitIndex > Int32.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int32.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int32 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Sets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<Int32, string> {
        if (bitIndex < 0 || bitIndex > Int32.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int32.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int32 bit index.  Must be an integer.`);
        }

        return pipe(
            setBitInNumber(this._val, bitIndex, newBitVal),
            (num) => Int32.create(num)
        );
    }
}


export class UInt32 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static get dataTypeMin(): number {
        return 0;
    }


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static get dataTypeMax(): number {
        return Math.pow(2, 32) - 1;      // 4_294_967_295
    }


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static get numBits(): number {
        return 32;
    }


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static get maxBitIndex(): number {
        return UInt32.numBits - 1;
    }


    /**
     * Creates an instance from a string representation
     * @param str - The string to parse
     * @return A Result containing the new instance or an error message
     */
    public static fromString(str: string): Result<UInt32, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid UInt32 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return UInt32.create(num);
            }, res)
        );
    }


    /**
     * Creates an instance from a number
     * @param val - The number to wrap
     * @return A Result containing the new instance or an error message
     */
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


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public get static(): typeof UInt32 {
        return UInt32;
    }


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): number {
        return this._val;
    }


    /**
     * Gets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to read
     * @return A Result containing the bit value or an error message
     */
    public getBit(bitIndex: number): Result<boolean, string> {
        if (bitIndex < 0 || bitIndex > UInt32.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt32.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt32 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Sets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<UInt32, string> {
        if (bitIndex < 0 || bitIndex > UInt32.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt32.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt32 bit index.  Must be an integer.`);
        }

        return pipe(
            setBitInNumber(this._val, bitIndex, newBitVal),
            (num) => UInt32.create(num)
        );
    }
}


export class Int64 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static get dataTypeMin(): bigint {
        return BigInt(-2) ** BigInt(63);        // -9_223_372_036_854_775_808n
    }


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static get dataTypeMax(): bigint {
        return BigInt(2) ** BigInt(63) - BigInt(1);      // 9_223_372_036_854_775_807n
    }


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static get numBits(): number {
        return 64;
    }


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static get maxBitIndex(): number {
        return Int64.numBits - 1;
    }


    /**
     * Creates an instance from a string representation
     * @param str - The string to parse
     * @return A Result containing the new instance or an error message
     */
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


    /**
     * Creates an instance from a number
     * @param val - The number to wrap
     * @return A Result containing the new instance or an error message
     */
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


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public get static(): typeof Int64 {
        return Int64;
    }


    private constructor(val: bigint) {
        this._val = val;
    }


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): bigint {
        return this._val;
    }


    /**
     * Gets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to read
     * @return A Result containing the bit value or an error message
     */
    public getBit(bitIndex: number): Result<boolean, string> {
        if (bitIndex < 0 || bitIndex > Int64.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int64.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int64 bit index.  Must be an integer.`);
        }

        const mask = BigInt(1) << BigInt(bitIndex);
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Sets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<Int64, string> {
        if (bitIndex < 0 || bitIndex > Int64.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int64.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int64 bit index.  Must be an integer.`);
        }

        return pipe(
            setBitInBigInt(this._val, bitIndex, newBitVal),
            (num) => Int64.create(BigInt(num))
        );
    }
}


export class UInt64 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static get dataTypeMin(): bigint {
        return BigInt(0);
    }


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static get dataTypeMax(): bigint {
        return BigInt(2) ** BigInt(64) - BigInt(1);     // 18_446_744_073_709_551_615n
    }


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static get numBits(): number {
        return 64;
    }


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static get maxBitIndex(): number {
        return UInt64.numBits - 1;
    }


    /**
     * Creates an instance from a string representation
     * @param str - The string to parse
     * @return A Result containing the new instance or an error message
     */
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


    /**
     * Creates an instance from a number
     * @param val - The number to wrap
     * @return A Result containing the new instance or an error message
     */
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


    public get static(): typeof UInt64 {
        return UInt64;
    }


    private readonly _val: bigint;


    private constructor(val: bigint) {
        this._val = val;
    }


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): bigint {
        return this._val;
    }


    /**
     * Gets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to read
     * @return A Result containing the bit value or an error message
     */
    public getBit(bitIndex: number): Result<boolean, string> {
        if (bitIndex < 0 || bitIndex > UInt64.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt64.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt64 bit index.  Must be an integer.`);
        }

        const mask = BigInt(1) << BigInt(bitIndex);
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Sets the value of a specific bit
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<UInt64, string> {
        if (bitIndex < 0 || bitIndex > UInt64.maxBitIndex) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt64.maxBitIndex}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt64 bit index.  Must be an integer.`);
        }

        return pipe(
            setBitInBigInt(this._val, bitIndex, newBitVal),
            (num) => UInt64.create(BigInt(num))
        );
    }
}


export class Float32 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static get dataTypeMin(): number {
        return -3.4028235e38;
    }


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static get dataTypeMax(): number {
        return 3.4028235e38;
    }


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static get numBits(): number {
        return 32;
    }


    /**
     * Creates an instance from a string representation
     * @param str - The string to parse
     * @return A Result containing the new instance or an error message
     */
    public static fromString(str: string): Result<Float32, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid Float32 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return Float32.create(num);
            }, res)
        );
    }


    /**
     * Creates an instance from a number
     * @param val - The number to wrap
     * @return A Result containing the new instance or an error message
     */
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


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public get static(): typeof Float32 {
        return Float32;
    }


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): number {
        return this._val;
    }
}


export class Float64 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static get dataTypeMin(): number {
        return -1 * Number.MAX_VALUE;
    }


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static get dataTypeMax(): number {
        return Number.MAX_VALUE;
    }


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static get numBits(): number {
        return 64;
    }


    /**
     * Creates an instance from a string representation
     * @param str - The string to parse
     * @return A Result containing the new instance or an error message
     */
    public static fromString(str: string): Result<Float64, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid Float64 value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return Float64.create(num);
            }, res)
        );
    }


    /**
     * Creates an instance from a number
     * @param val - The number to wrap
     * @return A Result containing the new instance or an error message
     */
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


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public get static(): typeof Float64 {
        return Float64;
    }


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): number {
        return this._val;
    }
}
