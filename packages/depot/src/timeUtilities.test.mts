import { civilFromDays, daysFromCivil, daysInMonth, isLeapYear } from "./timeUtilities.mjs";


describe("timeUtilities", () => {

    describe("isLeapYear", () => {

        it("returns true for years divisible by 400", () => {
            expect(isLeapYear(2000)).toBeTrue();
            expect(isLeapYear(2400)).toBeTrue();
        });


        it("returns false for years divisible by 100 but not 400", () => {
            expect(isLeapYear(1900)).toBeFalse();
            expect(isLeapYear(2100)).toBeFalse();
        });


        it("returns true for years divisible by 4 but not 100", () => {
            expect(isLeapYear(2024)).toBeTrue();
            expect(isLeapYear(1996)).toBeTrue();
        });


        it("returns false for years not divisible by 4", () => {
            expect(isLeapYear(2023)).toBeFalse();
            expect(isLeapYear(2025)).toBeFalse();
        });

    });


    describe("daysInMonth", () => {

        it("returns 29 for February in leap years", () => {
            expect(daysInMonth(2024, 2)).toEqual(29);
            expect(daysInMonth(2000, 2)).toEqual(29);
        });


        it("returns 28 for February in non-leap years", () => {
            expect(daysInMonth(2023, 2)).toEqual(28);
            expect(daysInMonth(1900, 2)).toEqual(28);
        });


        it("returns 30 for April, June, September, and November", () => {
            expect(daysInMonth(2023, 4)).toEqual(30);
            expect(daysInMonth(2023, 6)).toEqual(30);
            expect(daysInMonth(2023, 9)).toEqual(30);
            expect(daysInMonth(2023, 11)).toEqual(30);
        });


        it("returns 31 for January, March, May, July, August, October, and December", () => {
            expect(daysInMonth(2023, 1)).toEqual(31);
            expect(daysInMonth(2023, 3)).toEqual(31);
            expect(daysInMonth(2023, 5)).toEqual(31);
            expect(daysInMonth(2023, 7)).toEqual(31);
            expect(daysInMonth(2023, 8)).toEqual(31);
            expect(daysInMonth(2023, 10)).toEqual(31);
            expect(daysInMonth(2023, 12)).toEqual(31);
        });

    });


    describe("daysFromCivil() and civilFromDays()", () => {

        it("maps the Unix epoch date to day 0 and back", () => {
            expect(daysFromCivil(1970, 1, 1)).toEqual(0n);
            expect(civilFromDays(0n)).toEqual({ year: 1970, month: 1, day: 1 });
        });


        it("round-trips representative civil dates", () => {
            const samples = [
                { year: 1970, month: 1, day: 1 },
                { year: 2000, month: 2, day: 29 },
                { year: 2024, month: 2, day: 29 },
                { year: 2100, month: 3, day: 1 },
                { year: 2554, month: 7, day: 21 }
            ];

            for (const sample of samples) {
                const days = daysFromCivil(sample.year, sample.month, sample.day);
                expect(civilFromDays(days)).toEqual(sample);
            }
        });

    });

});
