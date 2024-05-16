/**
 * Gets the day of the week for the given Date.
 *
 * @param date - The input Date
 * @returns The (English) day of the week for the given Date
 */
export function dayOfWeek(date: Date): string {
    let dayName: string;
    switch (date.getDay()) {
        case 0:
            dayName = "Sunday";
            break;

        case 1:
            dayName = "Monday";
            break;

        case 2:
            dayName = "Tuesday";
            break;

        case 3:
            dayName = "Wednesday";
            break;

        case 4:
            dayName = "Thursday";
            break;

        case 5:
            dayName = "Friday";
            break;

        case 6:
            dayName = "Saturday";
            break;

        default:
            throw new Error("Invalid day number");
    }

    return dayName;
}


/**
 * Generator that produces dates within the specified range.
 *
 * @param startInclusive - The starting Date (inclusive)
 * @param endExclusive - The ending date (exclusive)
 * @returns An iterator for the Dates within the range.
 */
export function* dateRange(startInclusive: Date, endExclusive: Date): Generator<Date, void, unknown> {
    let curDate = startInclusive;
    while (curDate < endExclusive) {
        yield curDate;
        curDate = new Date(curDate.getFullYear(), curDate.getMonth(), curDate.getDate() + 1);
    }
}


/**
 * Converts a month number (1 - 12) to a month index (0 - 11).
 *
 * @param month - The month number to be converted
 * @return Converts a month number as it is typically displayed for users to
 *      a month index that is used by the Date constructor.
 */
export function monthToMonthIndex(month: number): number {
    return month - 1;
}


/**
 * Converts a month index (0 - 11) to a month number (1 - 12).
 *
 * @param monthIndex - The month index to be converted
 * @return Converts a month index (used by Date class) to a month number that is
 *      typically displayed for users.
 */
export function monthIndexToMonth(monthIndex: number): number {
    return monthIndex + 1;
}
