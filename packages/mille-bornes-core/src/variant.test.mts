import { type TeamIndex } from "./ids.mjs";
import { type Miles } from "./miles.mjs";
import {
    EXTENSION_MILES, FULL_TRIP_MILES, initialExtension, tripDistance, variantForSeatCount, type RaceVariant
} from "./variant.mjs";


describe("variant", () => {

    describe("variantForSeatCount()", () => {

        it("gives the rulebook variant for each supported seat count", () => {
            const expected: ReadonlyArray<[number, RaceVariant]> = [
                [2, { teamCount: 2, teamSize: 1, tripDistance: 700 as Miles, extension: true, deck: "Reduced" }],
                [3, { teamCount: 3, teamSize: 1, tripDistance: 700 as Miles, extension: true, deck: "Reduced" }],
                [4, { teamCount: 2, teamSize: 2, tripDistance: 1000 as Miles, extension: false, deck: "Standard" }],
                [6, { teamCount: 3, teamSize: 2, tripDistance: 700 as Miles, extension: true, deck: "Standard" }],
            ];
            for (const [seats, variant] of expected) {
                expect(variantForSeatCount(seats).throwIfFailed()).toEqual(variant);
            }
        });


        it("rejects every other seat count", () => {
            for (const count of [0, 1, 5, 7]) {
                expect(variantForSeatCount(count).throwIfSucceeded())
                .toEqual({ reason: "UnsupportedPlayerCount", count });
            }
        });

    });


    describe("constants", () => {

        it("are 700 and 1,000 miles", () => {
            expect(EXTENSION_MILES).toBe(700 as Miles);
            expect(FULL_TRIP_MILES).toBe(1000 as Miles);
        });

    });


    describe("initialExtension()", () => {

        it("is Available when the variant has Extension", () => {
            expect(initialExtension(variantForSeatCount(2).throwIfFailed())).toEqual({ kind: "Available" });
            expect(initialExtension(variantForSeatCount(6).throwIfFailed())).toEqual({ kind: "Available" });
        });


        it("is NotApplicable when the variant has no Extension", () => {
            expect(initialExtension(variantForSeatCount(4).throwIfFailed())).toEqual({ kind: "NotApplicable" });
        });

    });


    describe("tripDistance()", () => {

        it("is 700 while Extension is Available", () => {
            expect(tripDistance({ kind: "Available" })).toBe(700 as Miles);
        });


        it("is 1,000 when Extension does not apply or has been called", () => {
            expect(tripDistance({ kind: "NotApplicable" })).toBe(1000 as Miles);
            expect(tripDistance({ kind: "Called", caller: 0 as TeamIndex })).toBe(1000 as Miles);
        });

    });

});
