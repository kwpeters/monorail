import { CompareResult, compareStrI } from "./compare.mjs";
import { type IEquatable } from "./equate.mjs";
import { type HashString, hashSync } from "./hash.mjs";
import { type IHashable } from "./hashable.mjs";


/**
 * A string type that only performs case-insensitive comparisons.
 */
export class StringI implements IEquatable<StringI>,
                                IEquatable<string>,
                                IHashable {

    private readonly _strVal: string;


    public constructor(str: string) {
        this._strVal = str;
    }


    public toString(): string {
        return this._strVal;
    }


    /**
     * Compares this StringI to another StringI in a case-insensitive manner.
     *
     * @param other - The other instance
     * @return true if the instances are equal (case-insensitive); false otherwise.
     */
    public equals(other: StringI): boolean;
    /**
     * Compares this StringI to a string in a case-insensitive manner.
     *
     * @param other - The string to compare against.
     * @return true if the instances are equal (case-insensitive); false otherwise.
     */
    public equals(other: string): boolean;
    public equals(other: StringI | string): boolean {
        if (other instanceof StringI) {
            return compareStrI(this._strVal, other._strVal) === CompareResult.EQUAL;
        }
        else {
            return compareStrI(this._strVal, other) === CompareResult.EQUAL;
        }
    }


    /**
     * Calculates the hash for this string.  Equal StringI instances will
     * produce the same hash.
     *
     * @return This instance's hash
     */
    public getHash(): HashString {
        const intrinsics = {
            stringI: this._strVal.toLocaleLowerCase()
        };

        return hashSync(JSON.stringify(intrinsics));
    }


}
