import { Points } from "./points.mjs";


describe("points", () => {

    describe("Points.tryCreate()", () => {

        it("accepts non-negative integers and rejects the rest", () => {
            expect(Points.tryCreate(0).succeeded).toBeTrue();
            expect(Points.tryCreate(300).succeeded).toBeTrue();
            for (const bad of [-1, 1.5, NaN, Infinity]) {
                expect(Points.tryCreate(bad).failed).toBeTrue();
            }
        });

    });


    describe("Points.zero", () => {

        it("is 0", () => {
            expect(Points.zero as number).toBe(0);
        });

    });


    describe("Points.add()", () => {

        it("sums two values", () => {
            const a = Points.tryCreate(100).throwIfFailed();
            const b = Points.tryCreate(5).throwIfFailed();
            expect(Points.add(a, b) as number).toBe(105);
        });

    });

});
