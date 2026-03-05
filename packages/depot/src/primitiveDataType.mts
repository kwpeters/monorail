import { pipe } from "./pipe2.mjs";
import { FailedResult, Result, SucceededResult } from "./result.mjs";
import { isNonBlankString } from "./stringHelpers.mjs";
import { setBitInBigInt, setBitInNumber } from "./bitstringHelpers.mjs";


/**
 * Represents an integer that can be 0 or greater.
 */
export class NonNegativeInt {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static readonly DATA_TYPE_MIN: number = 0;


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static readonly DATA_TYPE_MAX: number = Math.pow(2, 53) - 1; // 9_007_199_254_740_991


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static readonly NUM_BITS: number = 64; // This type is based on Number which is a 64-bit floating point value.


    /**
     * Creates an instance from a string representation
     * @param str - The string to parse
     * @return A Result containing the new instance or an error message
     */
    public static fromString(str: string): Result<NonNegativeInt, string> {
        return pipe(
            isNonBlankString(str, "An empty string is not a valid NonNegativeInt value."),
            (res) => Result.bind((str) => {
                const num = Number(str);
                return NonNegativeInt.create(num);
            }, res)
        );
    }


    /**
     * Creates an instance from a number
     * @param val - The number to wrap
     * @return A Result containing the new instance or an error message
     */
    public static create(val: number): Result<NonNegativeInt, string> {
        if (val < NonNegativeInt.DATA_TYPE_MIN || val > NonNegativeInt.DATA_TYPE_MAX) {
            return new FailedResult(`"${val}" is not a valid NonNegativeInt value.  Must be between ${NonNegativeInt.DATA_TYPE_MIN} and ${NonNegativeInt.DATA_TYPE_MAX}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid NonNegativeInt value.  Must be an integer.`);
        }

        return new SucceededResult(new NonNegativeInt(val));
    }


    private readonly _val: number;


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public get static(): typeof NonNegativeInt {
        return NonNegativeInt;
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


/**
 * Represents an 8-bit signed integer value
 */
export class Int8 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static readonly DATA_TYPE_MIN: number = Math.pow(-2, 7); // -128


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static readonly DATA_TYPE_MAX: number = Math.pow(2, 7) - 1; // 127


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static readonly NUM_BITS: number = 8;


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static readonly MAX_BIT_INDEX: number = Int8.NUM_BITS - 1;


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
        if (val < Int8.DATA_TYPE_MIN || val > Int8.DATA_TYPE_MAX) {
            return new FailedResult(`"${val}" is not a valid Int8 value.  Must be between ${Int8.DATA_TYPE_MIN} and ${Int8.DATA_TYPE_MAX}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid Int8 value.  Must be an integer.`);
        }

        return new SucceededResult(new Int8(val));
    }


    private readonly _val: number;


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public readonly static: typeof Int8 = Int8;


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
        if (bitIndex < 0 || bitIndex > Int8.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int8.MAX_BIT_INDEX}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int8 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Returns a new instance with the specified bit set to the specified value
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<Int8, string> {
        if (bitIndex < 0 || bitIndex > Int8.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int8.MAX_BIT_INDEX}.`);
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


/**
 * Represents an 8-bit unsigned integer value
 */
export class UInt8 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static readonly DATA_TYPE_MIN: number = 0;


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static readonly DATA_TYPE_MAX: number = Math.pow(2, 8) - 1; // 255


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static readonly NUM_BITS: number = 8;


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static readonly MAX_BIT_INDEX: number = UInt8.NUM_BITS - 1;


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
        if (val < UInt8.DATA_TYPE_MIN || val > UInt8.DATA_TYPE_MAX) {
            return new FailedResult(`"${val}" is not a valid UInt8 value.  Must be between ${UInt8.DATA_TYPE_MIN} and ${UInt8.DATA_TYPE_MAX}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid UInt8 value.  Must be an integer.`);
        }

        return new SucceededResult(new UInt8(val));
    }


    private readonly _val: number;


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public readonly static: typeof UInt8 = UInt8;


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
        if (bitIndex < 0 || bitIndex > UInt8.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt8.MAX_BIT_INDEX}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt8 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Returns a new instance with the specified bit set to the specified value
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<UInt8, string> {
        if (bitIndex < 0 || bitIndex > UInt8.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt8.MAX_BIT_INDEX}.`);
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


/**
 * Represents a 16-bit signed integer value
 */
export class Int16 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static readonly DATA_TYPE_MIN: number = Math.pow(-2, 15); // -32_768


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static readonly DATA_TYPE_MAX: number = Math.pow(2, 15) - 1; // 32_767


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static readonly NUM_BITS: number = 16;


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static readonly MAX_BIT_INDEX: number = Int16.NUM_BITS - 1;


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
        if (val < Int16.DATA_TYPE_MIN || val > Int16.DATA_TYPE_MAX) {
            return new FailedResult(`"${val}" is not a valid Int16 value.  Must be between ${Int16.DATA_TYPE_MIN} and ${Int16.DATA_TYPE_MAX}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid Int16 value.  Must be an integer.`);
        }

        return new SucceededResult(new Int16(val));
    }


    private readonly _val: number;


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public readonly static: typeof Int16 = Int16;


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
        if (bitIndex < 0 || bitIndex > Int16.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int16.MAX_BIT_INDEX}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int16 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Returns a new instance with the specified bit set to the specified value
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<Int16, string> {
        if (bitIndex < 0 || bitIndex > Int16.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int16.MAX_BIT_INDEX}.`);
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


/**
 * Represents a 16-bit unsigned integer value
 */
export class UInt16 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static readonly DATA_TYPE_MIN: number = 0;


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static readonly DATA_TYPE_MAX: number = Math.pow(2, 16) - 1; // 65_535


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static readonly NUM_BITS: number = 16;


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static readonly MAX_BIT_INDEX: number = UInt16.NUM_BITS - 1;


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
        if (val < UInt16.DATA_TYPE_MIN || val > UInt16.DATA_TYPE_MAX) {
            return new FailedResult(`"${val}" is not a valid UInt16 value.  Must be between ${UInt16.DATA_TYPE_MIN} and ${UInt16.DATA_TYPE_MAX}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid UInt16 value.  Must be an integer.`);
        }

        return new SucceededResult(new UInt16(val));
    }


    private readonly _val: number;


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public readonly static: typeof UInt16 = UInt16;


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
        if (bitIndex < 0 || bitIndex > UInt16.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt16.MAX_BIT_INDEX}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt16 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Returns a new instance with the specified bit set to the specified value
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<UInt16, string> {
        if (bitIndex < 0 || bitIndex > UInt16.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt16.MAX_BIT_INDEX}.`);
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


/**
 * Represents a 32-bit signed integer value
 */
export class Int32 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static readonly DATA_TYPE_MIN: number = Math.pow(-2, 31); // -2_147_483_648


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static readonly DATA_TYPE_MAX: number = Math.pow(2, 31) - 1; // 2_147_483_647


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static readonly NUM_BITS: number = 32;


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static readonly MAX_BIT_INDEX: number = Int32.NUM_BITS - 1;


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
        if (val < Int32.DATA_TYPE_MIN || val > Int32.DATA_TYPE_MAX) {
            return new FailedResult(`"${val}" is not a valid Int32 value.  Must be between ${Int32.DATA_TYPE_MIN} and ${Int32.DATA_TYPE_MAX}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid Int32 value.  Must be an integer.`);
        }

        return new SucceededResult(new Int32(val));
    }


    private readonly _val: number;


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public readonly static: typeof Int32 = Int32;


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
        if (bitIndex < 0 || bitIndex > Int32.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int32.MAX_BIT_INDEX}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int32 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Returns a new instance with the specified bit set to the specified value
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<Int32, string> {
        if (bitIndex < 0 || bitIndex > Int32.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int32.MAX_BIT_INDEX}.`);
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


/**
 * Represents a 32-bit unsigned integer value
 */
export class UInt32 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static readonly DATA_TYPE_MIN: number = 0;


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static readonly DATA_TYPE_MAX: number = Math.pow(2, 32) - 1; // 4_294_967_295


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static readonly NUM_BITS: number = 32;


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static readonly MAX_BIT_INDEX: number = UInt32.NUM_BITS - 1;


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
        if (val < UInt32.DATA_TYPE_MIN || val > UInt32.DATA_TYPE_MAX) {
            return new FailedResult(`"${val}" is not a valid UInt32 value.  Must be between ${UInt32.DATA_TYPE_MIN} and ${UInt32.DATA_TYPE_MAX}.`);
        }

        if (!Number.isInteger(val)) {
            return new FailedResult(`"${val}" is not a valid UInt32 value.  Must be an integer.`);
        }

        return new SucceededResult(new UInt32(val));
    }


    private readonly _val: number;


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public readonly static: typeof UInt32 = UInt32;


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
        if (bitIndex < 0 || bitIndex > UInt32.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt32.MAX_BIT_INDEX}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt32 bit index.  Must be an integer.`);
        }

        const mask = 1 << bitIndex;
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Returns a new instance with the specified bit set to the specified value
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<UInt32, string> {
        if (bitIndex < 0 || bitIndex > UInt32.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt32.MAX_BIT_INDEX}.`);
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


/**
 * Represents a 64-bit signed integer value
 */
export class Int64 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static readonly DATA_TYPE_MIN: bigint = BigInt(-2) ** BigInt(63); // -9_223_372_036_854_775_808n


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static readonly DATA_TYPE_MAX: bigint = BigInt(2) ** BigInt(63) - BigInt(1); // 9_223_372_036_854_775_807n


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static readonly NUM_BITS: number = 64;


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static readonly MAX_BIT_INDEX: number = Int64.NUM_BITS - 1;


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
        if (val < Int64.DATA_TYPE_MIN || val > Int64.DATA_TYPE_MAX) {
            return new FailedResult(`"${val}" is not a valid Int64 value.  Must be between ${Int64.DATA_TYPE_MIN} and ${Int64.DATA_TYPE_MAX}.`);
        }

        //
        // Unlike the other integer types which are based on Number, BigInt is
        // always an integer.  Therefore, there is no need to check for a
        // fractional part using Number.isInteger().
        //

        return new SucceededResult(new Int64(val));
    }


    private readonly _val: bigint;


    private constructor(val: bigint) {
        this._val = val;
    }


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public readonly static: typeof Int64 = Int64;


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
        if (bitIndex < 0 || bitIndex > Int64.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int64.MAX_BIT_INDEX}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int64 bit index.  Must be an integer.`);
        }

        const mask = BigInt(1) << BigInt(bitIndex);
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Returns a new instance with the specified bit set to the specified value
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<Int64, string> {
        if (bitIndex < 0 || bitIndex > Int64.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${Int64.MAX_BIT_INDEX}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid Int64 bit index.  Must be an integer.`);
        }

        return pipe(
            setBitInBigInt(this._val, bitIndex, newBitVal),
            (num) => Int64.create(num)
        );
    }
}


/**
 * Represents a 64-bit unsigned integer value
 */
export class UInt64 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static readonly DATA_TYPE_MIN: bigint = BigInt(0); // 0n


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static readonly DATA_TYPE_MAX: bigint = BigInt(2) ** BigInt(64) - BigInt(1); // 18_446_744_073_709_551_615n


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static readonly NUM_BITS: number = 64;


    /**
     * Gets the highest valid bit index for this data type
     * @return The maximum bit index
     */
    public static readonly MAX_BIT_INDEX: number = UInt64.NUM_BITS - 1;


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
        if (val < UInt64.DATA_TYPE_MIN || val > UInt64.DATA_TYPE_MAX) {
            return new FailedResult(`"${val}" is not a valid Uint64 value.  Must be between ${UInt64.DATA_TYPE_MIN} and ${UInt64.DATA_TYPE_MAX}.`);
        }

        //
        // Unlike the other integer types which are based on Number, BigInt is
        // always an integer.  Therefore, there is no need to check for a
        // fractional part using Number.isInteger().
        //

        return new SucceededResult(new UInt64(val));
    }


    private readonly _val: bigint;


    private constructor(val: bigint) {
        this._val = val;
    }


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public readonly static: typeof UInt64 = UInt64;


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
        if (bitIndex < 0 || bitIndex > UInt64.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt64.MAX_BIT_INDEX}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt64 bit index.  Must be an integer.`);
        }

        const mask = BigInt(1) << BigInt(bitIndex);
        return new SucceededResult((this._val & mask) === mask);
    }


    /**
     * Returns a new instance with the specified bit set to the specified value
     * @param bitIndex - Zero-based index of the bit to write
     * @param newBitVal - The value to write to the bit
     * @return A Result containing a new instance with the modified bit or an error message
     */
    public setBit(bitIndex: number, newBitVal: boolean): Result<UInt64, string> {
        if (bitIndex < 0 || bitIndex > UInt64.MAX_BIT_INDEX) {
            return new FailedResult(`"${bitIndex}" is not a valid bit index.  Must be between 0 and ${UInt64.MAX_BIT_INDEX}.`);
        }

        if (!Number.isInteger(bitIndex)) {
            return new FailedResult(`"${bitIndex}" is not a valid UInt64 bit index.  Must be an integer.`);
        }

        return pipe(
            setBitInBigInt(this._val, bitIndex, newBitVal),
            (num) => UInt64.create(num)
        );
    }
}


/**
 * Represents a 32-bit floating point value
 */
export class Float32 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static readonly DATA_TYPE_MIN: number = -3.4028235e38;

    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static readonly DATA_TYPE_MAX: number = 3.4028235e38;


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static readonly NUM_BITS: number = 32;


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
        if (val < Float32.DATA_TYPE_MIN || val > Float32.DATA_TYPE_MAX) {
            return new FailedResult(`"${val}" is not a valid Float32 value.  Must be between ${Float32.DATA_TYPE_MIN} and ${Float32.DATA_TYPE_MAX}.`);
        }

        if (!Number.isFinite(val)) {
            return new FailedResult(`"${val}" is not a valid Float32 value.  Must be a finite number.`);
        }

        return new SucceededResult(new Float32(val));
    }


    private readonly _val: number;


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public readonly static: typeof Float32 = Float32;


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): number {
        return this._val;
    }
}


/**
 * Represents a 64-bit floating point value
 */
export class Float64 {
    /**
     * Gets the minimum value for this data type
     * @return The minimum value that can be stored
     */
    public static readonly DATA_TYPE_MIN: number = -1 * Number.MAX_VALUE;


    /**
     * Gets the maximum value for this data type
     * @return The maximum value that can be stored
     */
    public static readonly DATA_TYPE_MAX: number = Number.MAX_VALUE;


    /**
     * Gets the number of bits used by this data type
     * @return The number of bits used
     */
    public static readonly NUM_BITS: number = 64;


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
        if (val < Float64.DATA_TYPE_MIN || val > Float64.DATA_TYPE_MAX) {
            return new FailedResult(`"${val}" is not a valid Float64 value.  Must be between ${Float64.DATA_TYPE_MIN} and ${Float64.DATA_TYPE_MAX}.`);
        }

        if (!Number.isFinite(val)) {
            return new FailedResult(`"${val}" is not a valid Float64 value.  Must be a finite number.`);
        }

        return new SucceededResult(new Float64(val));
    }


    private readonly _val: number;


    private constructor(val: number) {
        this._val = val;
    }


    /**
     * Gets a reference to this class's type
     * @return The class type
     */
    public readonly static: typeof Float64 = Float64;


    /**
     * Gets the wrapped value
     * @return The stored value
     */
    public get value(): number {
        return this._val;
    }
}
