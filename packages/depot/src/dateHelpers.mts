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


/**
 * Converts milliseconds to seconds.
 *
 * @param ms - The millisecond value to be converted.
 * @return The converted number of seconds
 */
export function msToSec(ms: number): number {
    return ms / 1000;
}


/**
 * Calculates the duration between to timestamps and returns it as a string.
 *
 * @param t1 - One of the timestamps (order does not matter)
 * @param t2 - One of the timestamps (order does not matter)
 * @return A string containing the duration between the two timestamps.
 */
export function durationString(t1: Date | number, t2: Date | number): string {

    const locale = "en-us";

    const msT1 = typeof t1 === "number" ? t1 : t1.valueOf();
    const msT2 = typeof t2 === "number" ? t2 : t2.valueOf();
    const tStart = msToSec(Math.min(msT1, msT2));
    const tEnd   = msToSec(Math.max(msT1, msT2));
    const durationSec = tEnd - tStart;

    const [delimiter] = new Date().toLocaleTimeString(locale).match(/\b[:.]\b/)!;

    const nonPaddedIntl = Intl.NumberFormat(locale, { minimumIntegerDigits: 1 });
    const paddedIntl = Intl.NumberFormat(locale, { minimumIntegerDigits: 2 });
    const hours = Math.floor(durationSec / 3600);
    const minutes = Math.floor(durationSec / 60) % 60;
    const seconds = durationSec % 60;
    const indexToPad = hours ? 0 : 1;
    const timeFormat =
        [hours, minutes, seconds]
        .map((val, i) => {
            return (val < 10 && i > indexToPad) ? paddedIntl.format(val) : nonPaddedIntl.format(val);
        })
        .filter((val, i) => {
            if (i === 0) {
                return !(val === "00" || val === "0");
            }

            return true;
        })
        .join(delimiter); // 4:32
    return timeFormat;
}
