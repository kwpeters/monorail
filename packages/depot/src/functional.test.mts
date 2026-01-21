import { applyMappers, applyMappersAsync } from "./functional.mjs";


describe("applyMappers()", () => {

    it("will return an empty array when inputs is empty", () => {
        expect(applyMappers([], [])).toEqual([]);
    });


    it("will return inputs unchanged when no mappers are provided", () => {
        const inputs = [1, 2, 3];
        expect(applyMappers(inputs, [])).toEqual(inputs);
    });


    it("will apply a single mapper to each input", () => {
        const inputs = [1, 2, 3];
        const double: (n: number) => number = (n) => n * 2;
        expect(applyMappers(inputs, [double])).toEqual([2, 4, 6]);
    });


    it("will apply multiple mappers in sequence to each input", () => {
        const inputs = [1, 2, 3];
        const addOne: (n: number) => number = (n) => n + 1;
        const multiplyByTwo: (n: number) => number = (n) => n * 2;
        expect(applyMappers(inputs, [addOne, multiplyByTwo])).toEqual([4, 6, 8]);
    });
});


describe("applyMappersAsync()", () => {

    it("will return an empty array when inputs is empty", async () => {
        const result = await applyMappersAsync([], []);
        expect(result).toEqual([]);
    });


    it("will return inputs unchanged when no mappers are provided", async () => {
        const inputs = [1, 2, 3];
        const result = await applyMappersAsync(inputs, []);
        expect(result).toEqual(inputs);
    });


    it("will apply a single async mapper to each input", async () => {
        const inputs = [1, 2, 3];
        const asyncDouble: (n: number) => Promise<number> = async (n) => Promise.resolve(n * 2);
        const result = await applyMappersAsync(inputs, [asyncDouble]);
        expect(result).toEqual([2, 4, 6]);
    });


    it("will apply multiple async mappers in sequence to each input", async () => {
        const inputs = [1, 2, 3];
        const asyncAddOne: (n: number) => Promise<number> = async (n) => Promise.resolve(n + 1);
        const asyncMultiplyByTwo: (n: number) => Promise<number> = async (n) => Promise.resolve(n * 2);
        const result = await applyMappersAsync(inputs, [asyncAddOne, asyncMultiplyByTwo]);
        expect(result).toEqual([4, 6, 8]);
    });


    it("will reject when one of the mappers rejects", async () => {
        const inputs = [1];
        const rejectingMapper: (n: number) => Promise<number> = async () => Promise.reject("test error");
        try {
            await applyMappersAsync(inputs, [rejectingMapper]);
            fail("Expected the promise to reject");
        }
        catch (error) {
            expect(error).toBe("test error");
        }
    });
});
