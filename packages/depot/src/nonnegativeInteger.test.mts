import { NonnegativeInteger } from "./nonnegativeInteger.mjs";

describe("NonnegativeInteger namespace", () => {


    describe("tryCreate()", () => {

        it("fails when given a negative number", () => {
            expect(NonnegativeInteger.tryCreate(-1).failed).toBeTruthy();
        });


        it("fails when given a non-integer positive number", () => {
            expect(NonnegativeInteger.tryCreate(1.5).failed).toBeTruthy();
        });


        it("succeeds when given zero", () => {
            expect(NonnegativeInteger.tryCreate(0).succeeded).toBeTruthy();
        });


        it("succeeds when given a positive integer", () => {
            expect(NonnegativeInteger.tryCreate(1).succeeded).toBeTruthy();
        });

    });


    describe("create()", () => {

        it("throws when given a negative number", () => {
            expect(() => NonnegativeInteger.create(-1)).toThrow();
        });


        it("throws when given a non-integer positive number", () => {
            expect(() => NonnegativeInteger.create(1.5)).toThrow();
        });


        it("returns a NonnegativeInteger when given zero", () => {
            expect(NonnegativeInteger.create(0)).toBeDefined();
        });


        it("returns a NonnegativeInteger when given a positive integer", () => {
            expect(NonnegativeInteger.create(1)).toBeDefined();
        });


    });


});
