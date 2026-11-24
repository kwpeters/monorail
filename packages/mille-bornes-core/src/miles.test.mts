import { Miles } from "./miles.mjs";


describe("miles", () => {

    describe("Miles.tryCreate()", () => {

        it("accepts multiples of 25 and rejects the rest", () => {
            expect(Miles.tryCreate(75).succeeded).toBeTrue();
            expect(Miles.tryCreate(0).succeeded).toBeTrue();
            for (const bad of [-25, 30, 12.5, NaN, Infinity]) {
                expect(Miles.tryCreate(bad).failed).toBeTrue();
            }
        });

    });


    describe("Miles.zero", () => {

        it("is 0", () => {
            expect(Miles.zero as number).toBe(0);
        });

    });


    describe("Miles.add()", () => {

        it("sums two values", () => {
            const a = Miles.tryCreate(75).throwIfFailed();
            const b = Miles.tryCreate(200).throwIfFailed();
            expect(Miles.add(a, b) as number).toBe(275);
        });

    });

});
