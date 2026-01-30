import { PositiveInteger } from "./positiveInteger.mjs";

describe("PositiveInteger namespace", () => {


    describe("tryCreate()", () => {

        it("fails when given a negative number", () => {
            expect(PositiveInteger.tryCreate(-1).failed).toBeTruthy();
        });


        it("fails when given zero", () => {
            expect(PositiveInteger.tryCreate(0).failed).toBeTruthy();
        });


        it("fails when given a non-integer positive number", () => {
            expect(PositiveInteger.tryCreate(1.5).failed).toBeTruthy();
        });


        it("succeeds when given one", () => {
            expect(PositiveInteger.tryCreate(1).succeeded).toBeTruthy();
        });


        it("succeeds when given a positive integer greater than one", () => {
            expect(PositiveInteger.tryCreate(42).succeeded).toBeTruthy();
        });

    });


    describe("create()", () => {

        it("throws when given a negative number", () => {
            expect(() => PositiveInteger.create(-1)).toThrow();
        });


        it("throws when given zero", () => {
            expect(() => PositiveInteger.create(0)).toThrow();
        });


        it("throws when given a non-integer positive number", () => {
            expect(() => PositiveInteger.create(1.5)).toThrow();
        });


        it("returns a PositiveInteger when given one", () => {
            expect(PositiveInteger.create(1)).toBeDefined();
        });


        it("returns a PositiveInteger when given a positive integer greater than one", () => {
            expect(PositiveInteger.create(42)).toBeDefined();
        });


    });


});
