import { validateIndex } from "./primitives.mjs";


describe("validateIndex()", () => {


    it("fails when given a negative starting index", () => {
        const arr = [0, 1, 2, 3];
        expect(validateIndex(-1, 0, arr).succeeded).toBeFalse();
    });


    it("fails when given a negative number of items needed", () => {
        const arr = [0, 1, 2, 3];
        expect(validateIndex(0, -1, arr).succeeded).toBeFalse();
    });


    it("succeeds when zero items are needed", () => {
        const arr = [] as number[];
        expect(validateIndex(0, 0, arr).succeeded).toBeTrue();
    });


    it("succeeds when the container has enough items", () => {
        const arr = [0, 1, 2, 3, 4];
        expect(validateIndex(2, 3, arr).succeeded).toBeTrue();
    });


    it("fails when the container does not have enough items", () => {
        const arr = [0, 1, 2, 3, 4];
        expect(validateIndex(2, 4, arr).succeeded).toBeFalse();
    });


});
