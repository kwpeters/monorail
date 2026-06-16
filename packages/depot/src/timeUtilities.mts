////////////////////////////////////////////////////////////////////////////////
// Shared Time Unit Constants (number)
////////////////////////////////////////////////////////////////////////////////

export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;

export const MILLISECONDS_PER_SECOND = 1_000;
export const MICROSECONDS_PER_SECOND = 1_000_000;
export const NANOSECONDS_PER_SECOND = 1_000_000_000;

export const MILLISECONDS_PER_MINUTE = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
export const MICROSECONDS_PER_MINUTE = SECONDS_PER_MINUTE * MICROSECONDS_PER_SECOND;
export const NANOSECONDS_PER_MINUTE = SECONDS_PER_MINUTE * NANOSECONDS_PER_SECOND;

export const MILLISECONDS_PER_HOUR = MINUTES_PER_HOUR * MILLISECONDS_PER_MINUTE;
export const MICROSECONDS_PER_HOUR = MINUTES_PER_HOUR * MICROSECONDS_PER_MINUTE;
export const NANOSECONDS_PER_HOUR = MINUTES_PER_HOUR * NANOSECONDS_PER_MINUTE;

export const MILLISECONDS_PER_DAY =
    HOURS_PER_DAY * MILLISECONDS_PER_HOUR;


////////////////////////////////////////////////////////////////////////////////
// Shared Time Unit Constants (bigint)
////////////////////////////////////////////////////////////////////////////////

export const SECONDS_PER_MINUTE_BIGINT = 60n;
export const MINUTES_PER_HOUR_BIGINT = 60n;
export const HOURS_PER_DAY_BIGINT = 24n;

export const MILLISECONDS_PER_SECOND_BIGINT = 1_000n;
export const MICROSECONDS_PER_SECOND_BIGINT = 1_000_000n;
export const NANOSECONDS_PER_SECOND_BIGINT = 1_000_000_000n;

export const MILLISECONDS_PER_MINUTE_BIGINT =
    SECONDS_PER_MINUTE_BIGINT * MILLISECONDS_PER_SECOND_BIGINT;
export const MICROSECONDS_PER_MINUTE_BIGINT =
    SECONDS_PER_MINUTE_BIGINT * MICROSECONDS_PER_SECOND_BIGINT;
export const NANOSECONDS_PER_MINUTE_BIGINT =
    SECONDS_PER_MINUTE_BIGINT * NANOSECONDS_PER_SECOND_BIGINT;

export const MILLISECONDS_PER_HOUR_BIGINT =
    MINUTES_PER_HOUR_BIGINT * MILLISECONDS_PER_MINUTE_BIGINT;
export const MICROSECONDS_PER_HOUR_BIGINT =
    MINUTES_PER_HOUR_BIGINT * MICROSECONDS_PER_MINUTE_BIGINT;
export const NANOSECONDS_PER_HOUR_BIGINT =
    MINUTES_PER_HOUR_BIGINT * NANOSECONDS_PER_MINUTE_BIGINT;

export const MICROSECONDS_PER_DAY_BIGINT =
    HOURS_PER_DAY_BIGINT * MICROSECONDS_PER_HOUR_BIGINT;

export const NANOSECONDS_PER_DAY_BIGINT =
    HOURS_PER_DAY_BIGINT * NANOSECONDS_PER_HOUR_BIGINT;


////////////////////////////////////////////////////////////////////////////////
// Shared Calendar Helpers
////////////////////////////////////////////////////////////////////////////////

/**
 * Returns whether a Gregorian calendar year is a leap year.
 *
 * @param year - Year number in the proleptic Gregorian calendar.
 * @return True when the year has 366 days; otherwise false.
 */
export function isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}


/**
 * Returns the number of days in a month for the specified year.
 *
 * The month argument is 1-based (January = 1, December = 12).
 *
 * @param year - Year number in the proleptic Gregorian calendar.
 * @param month - Month number in the range 1-12.
 * @return Number of days in the requested month.
 */
export function daysInMonth(year: number, month: number): number {
    switch (month) {
        case 2:
            return isLeapYear(year) ? 29 : 28;
        case 4:
        case 6:
        case 9:
        case 11:
            return 30;
        default:
            return 31;
    }
}


/**
 * Converts a civil calendar date to a signed day offset from the Unix epoch
 * (1970-01-01).
 *
 * Uses Howard Hinnant's civil-date algorithm, which is timezone-independent
 * and works across a wide range of years.
 *
 * This helper is Unix-epoch-specific and should not be used with alternate
 * date epochs.
 *
 * @param year - Full year in proleptic Gregorian calendar.
 * @param month - Month number in the range 1-12.
 * @param day - Day number in the range 1-31 (already calendar-validated).
 * @return Number of days since 1970-01-01, where 1970-01-01 is 0.
 */
export function daysFromCivil(year: number, month: number, day: number): bigint {
    // Treat Jan/Feb as months 13/14 of the previous year.
    const yAdj = month <= 2 ? year - 1 : year;

    // Split into 400-year era plus year-of-era.
    const era = Math.floor(yAdj / 400);
    const yoe = yAdj - era * 400;

    // Month index with March as month 0.
    const mp = month > 2 ? month - 3 : month + 9;

    // Day-of-year and day-of-era.
    const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
    const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;

    // 719468 is the civil-date offset that maps 1970-01-01 to day 0.
    return BigInt(era * 146097 + doe - 719468);
}


/**
 * Converts a signed day offset from the Unix epoch (1970-01-01) to civil
 * year/month/day components.
 *
 * This is the inverse of {@link daysFromCivil} and uses the same
 * timezone-independent Gregorian arithmetic.
 *
 * This helper is Unix-epoch-specific and should not be used with alternate
 * date epochs.
 *
 * @param daysFromEpoch - Number of days since 1970-01-01.
 * @return Civil date components in the proleptic Gregorian calendar.
 */
export function civilFromDays(daysFromEpoch: bigint): { year: number, month: number, day: number } {
    // Shift to civil-date epoch expected by the algorithm.
    const z = daysFromEpoch + 719468n;

    // Split into 400-year era and day-of-era.
    const era = z / 146097n;
    const doe = z - era * 146097n;

    // Compute year-of-era and day-of-year.
    const yoe = (doe - doe / 1460n + doe / 36524n - doe / 146096n) / 365n;
    const y = yoe + era * 400n;
    const doy = doe - (365n * yoe + yoe / 4n - yoe / 100n);

    // Convert March-based month/day back to civil month/day.
    const mp = (5n * doy + 2n) / 153n;
    const d = doy - (153n * mp + 2n) / 5n + 1n;
    const m = mp + (mp < 10n ? 3n : -9n);
    const year = Number(y + (m <= 2n ? 1n : 0n));
    const month = Number(m);
    const day = Number(d);
    return { year, month, day };
}
