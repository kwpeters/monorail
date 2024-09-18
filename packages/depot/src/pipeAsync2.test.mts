import { pipeAsync } from "./pipeAsync2.mjs";
import { getTimerPromise } from "./promiseHelpers.mjs";


async function parseIntAsync(str: string): Promise<number> {
    await getTimerPromise(20, undefined);
    return parseInt(str, 10);
}


async function addThreeAsync(n: number): Promise<number> {
    await getTimerPromise(10, undefined);
    return n + 3;
}


describe("pipeAsync()", () => {

    it("pipes async and sync values through the specified functions", async () => {
        const result = await pipeAsync(
            "5",
            parseIntAsync,
            addThreeAsync,
            addThreeAsync,
            (n) => n + 1
        );
        expect(result).toEqual(12);
    });

});
