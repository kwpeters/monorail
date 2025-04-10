import {FailedResult, Result, SucceededResult } from "@repo/depot/result";
import {padLeft} from "@repo/depot/stringHelpers";


/**
 * Represents a date.
 */
export class Datestamp {
    /**
     * Factory method for creating Datestamp instances from string values.
     * @param yearStr - The year for the resulting Datestamp
     * @param monthStr - The month for the resulting Datestamp
     * @param dayStr - The day for the resulting Datestamp
     * @return A result object that will yield the new Datestamp instance or a
     * failure describing why it could not be created.
     */
    public static fromStrings(yearStr: string, monthStr: string, dayStr: string): Result<Datestamp, string> {
        const year = parseInt(yearStr, 10);
        const month = parseInt(monthStr, 10);
        const day = parseInt(dayStr, 10);

        if (Number.isNaN(year)) {
            return new FailedResult(`${yearStr} is not a valid year string.`);
        }

        if (Number.isNaN(month)) {
            return new FailedResult(`${monthStr} is not a valid year string.`);
        }

        if (Number.isNaN(day)) {
            return new FailedResult(`${dayStr} is not a valid year string.`);
        }

        //
        // Do some reality checks on the date to make sure it is reasonable.
        //
        const now = new Date();
        const curYear = now.getFullYear();
        if (year < curYear - 100 || year > curYear) {
            return new FailedResult(`${year} is not a valid year.`);
        }

        if (month < 1 || month > 12) {
            return new FailedResult(`${month} is not a valid month.`);
        }

        if (day < 1 || day > 31) {
            return new FailedResult(`${day} is not a valid day.`);
        }

        return new SucceededResult(new Datestamp(year, month, day));
    }


    // #region Instance Data Members
    /// The year
    private readonly _year:  number;
    // The month as a 1-based integer 1 - 12 (unlike the JS Date which is 0 -
    // 11)
    private readonly _month: number;
    // The day of the month as an integer 1 - 31.
    private readonly _day:   number;
    // #endregion


    /**
     * Constructor.  Private to enforce factory method pattern.
     * @param year - The year for the resulting instance
     * @param month - The month for the resulting instance
     * @param day - The day for the resulting instance
     * @return Description
     */
    private constructor(year: number, month: number, day: number) {
        this._year = year;
        this._month = month;
        this._day = day;
    }


    /**
     * @return The year of this Datestamp
     */
    public get year(): number {
        return this._year;
    }


    /**
     * Compares two Datestamp instances.
     * @param other - The other Datestamp instance to compare to.
     * @return true if equal; false otherwise.
     */
    public equals(other: Datestamp): boolean {
        return this._year === other._year &&
            this._month === other._month &&
            this._day === other._day;
    }


    /**
     * Gets a string that represents this Datestamp.
     * @return A string representing this Datestamp.
     */
    public toString(): string {
        const yearStr = padLeft(this._year.toString(), "0", 4);
        const monthStr = padLeft(this._month.toString(), "0", 2);
        const dayStr = padLeft(this._day.toString(), "0", 2);

        return `${yearStr}_${monthStr}_${dayStr}`;
    }
}
