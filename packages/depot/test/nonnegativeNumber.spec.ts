import { NonnegativeNumber } from "../src/nonnegativeNumber.js";

fdescribe("NonnegativeNumber namespace", () => {


    describe("tryCreate()", () => {

        it("fails when given a negative number", () => {
            expect(NonnegativeNumber.tryCreate(-1).failed).toBeTruthy();
        });


        it("succeeds when given zero", () => {
            expect(NonnegativeNumber.tryCreate(0).succeeded).toBeTruthy();
        });


        it("succeeds when given a positive number", () => {
            expect(NonnegativeNumber.tryCreate(1).succeeded).toBeTruthy();
        });

    });


    describe("create()", () => {

        it("throws when given a negative number", () => {
            expect(() => NonnegativeNumber.create(-1)).toThrow();
        });


        it("returns a NonnegativeNumber when given zero", () => {
            expect(NonnegativeNumber.create(0)).toBeDefined();
        });


        it("returns a NonnegativeNumber when given a positive number", () => {
            expect(NonnegativeNumber.create(1)).toBeDefined();
        });


    });


});
