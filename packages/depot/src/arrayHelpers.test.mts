import {
    anyMatchRegex, choose, chooseAsync, filterDefined, groupConsecutiveBy,
    insertIf, permutations, split, toArray, chooseFirst, chooseFirstAsync,
    hasIndex
} from "./arrayHelpers.mjs";
import { getTimerPromise } from "./promiseHelpers.mjs";
import { FailedResult, SucceededResult } from "./result.mjs";
import { getRandomInt } from "./random.mjs";


describe("hasIndex()", () => {

    it("returns false when given a negative index", () => {
        expect(hasIndex([0, 1, 2], -1)).toBeFalse();
    });


    it("returns false when given an index that is not an integer", () => {
        expect(hasIndex([0, 1, 2], 1.5)).toBeFalse();
    });


    it("returns false when the array is not large enough to have the index", () => {
        expect(hasIndex([], 0)).toBeFalse();
        expect(hasIndex([0, 1, 2], 3)).toBeFalse();
    });


    it("returns true when the array is large enough to have the index", () => {
        expect(hasIndex([0], 0)).toBeTrue();
        expect(hasIndex([0, 1, 2], 0)).toBeTrue();
        expect(hasIndex([0, 1, 2], 2)).toBeTrue();
    });

});


describe("anyMatchRegex()", () => {

    it("will return the a truthy match object when there is a match", () => {
        const strings = ["abc", "a-b-c"];
        const match = anyMatchRegex(strings, /a.b.c/);
        expect(match).toBeTruthy();
        expect(match![0]).toEqual("a-b-c");

    });


    it("will return undefined when there is no match", () => {
        const strings = ["abc", "a-b-c"];
        const match = anyMatchRegex(strings, /a_b_c/);
        expect(match).toEqual(undefined);
    });


});


describe("insertIf", () => {

    it("returns an empty array when the condition is false", () => {
        expect(insertIf(false, 1, 2, 3)).toEqual([]);
    });


    it("returns an array containing the items when the condition is true", () => {
        expect(insertIf(true, 1, 2, 3)).toEqual([1, 2, 3]);
    });

});


describe("permutations()", () => {

    it("returns expected results for a zero length array", () => {
        expect(permutations([])).toEqual([]);
    });


    it("returns expected results for a 1-element array", () => {
        expect(permutations([1])).toEqual([[1]]);
    });


    it("returns expected results for a 2-element array", () => {
        const perms = permutations([1, 2]);
        expect(perms).toEqual([[1, 2], [2, 1]]);
    });


    it("returns expected results for a 3-element array", () => {
        expect(permutations([1, 2, 3])).toEqual([
            [1, 2, 3],
            [1, 3, 2],
            [2, 1, 3],
            [2, 3, 1],
            [3, 1, 2],
            [3, 2, 1]
        ]);
    });

    it("returns expected results for a 4-element array", () => {
        expect(permutations([1, 2, 3, 4])).toEqual([
            [1, 2, 3, 4],
            [1, 2, 4, 3],
            [1, 3, 2, 4],
            [1, 3, 4, 2],
            [1, 4, 2, 3],
            [1, 4, 3, 2],

            [2, 1, 3, 4],
            [2, 1, 4, 3],
            [2, 3, 1, 4],
            [2, 3, 4, 1],
            [2, 4, 1, 3],
            [2, 4, 3, 1],

            [3, 1, 2, 4],
            [3, 1, 4, 2],
            [3, 2, 1, 4],
            [3, 2, 4, 1],
            [3, 4, 1, 2],
            [3, 4, 2, 1],

            [4, 1, 2, 3],
            [4, 1, 3, 2],
            [4, 2, 1, 3],
            [4, 2, 3, 1],
            [4, 3, 1, 2],
            [4, 3, 2, 1]
        ]);
    });


});


describe("toArray()", () => {
    it("returns an empty array when given undefined", () => {
        expect(toArray(undefined)).toEqual([]);
    });


    it("returns an empty array when given null", () => {
        expect(toArray(null)).toEqual([]);
    });


    it("returns the original array when given an array", () => {
        expect(toArray(["one", "two"])).toEqual(["one", "two"]);
    });


    it("wraps a single value in an array", () => {
        expect(toArray("one")).toEqual(["one"]);
    });
});


describe("split()", () => {

    it("returns expected two arrays", () => {
        const nums = [1, 2, 3, 4, 5];
        expect(split(nums, 3)).toEqual([[1, 2, 3], [4, 5]]);
    });


    it("returns the expected arrays when the source array has exactly enough for the first", () => {
        const nums = [1, 2, 3, 4, 5];
        expect(split(nums, 5)).toEqual([[1, 2, 3, 4, 5], []]);
    });


    it("returns the expected arrays when the source array does not have enough elements for the first one", () => {
        const nums = [1, 2, 3, 4, 5];
        expect(split(nums, 6)).toEqual([[1, 2, 3, 4, 5], []]);
    });


    it("returns the expected arrays when numToTake is 0", () => {
        const nums = [1, 2, 3, 4, 5];
        expect(split(nums, 0)).toEqual([[], [1, 2, 3, 4, 5]]);
    });


    it("forces numToTake to be at least 0", () => {
        const nums = [1, 2, 3, 4, 5];
        expect(split(nums, -2)).toEqual([[], [1, 2, 3, 4, 5]]);
    });

});


describe("groupAdjacentBy()", () => {

    const isSimilarEvenOdd = (a: number, b: number) => (a % 2) === (b % 2);

    it("returns no groups when given an empty array", () => {
        expect(groupConsecutiveBy([], isSimilarEvenOdd)).toEqual(
            []
        );
    });


    it("returns the original array when no consecutive items are similar", () => {
        expect(groupConsecutiveBy([0, 1, 2, 3, 4, 5], isSimilarEvenOdd)).toEqual(
            [
                [0],
                [1],
                [2],
                [3],
                [4],
                [5]
            ]
        );
    });


    it("groups similar items at the beginning of the input array", () => {
        expect(groupConsecutiveBy([0, 2, 4, 3, 4, 5], isSimilarEvenOdd)).toEqual(
            [
                [0, 2, 4],
                [3],
                [4],
                [5]
            ]
        );
    });


    it("groups similar items in the middle of the input array", () => {
        expect(groupConsecutiveBy([0, 1, 2, 4, 6, 7, 8], isSimilarEvenOdd)).toEqual(
            [
                [0],
                [1],
                [2, 4, 6],
                [7],
                [8]
            ]
        );
    });


    it("groups similar items at the end of the input array", () => {
        expect(groupConsecutiveBy([0, 1, 2, 3, 4, 6, 24], isSimilarEvenOdd)).toEqual(
            [
                [0],
                [1],
                [2],
                [3],
                [4, 6, 24]
            ]
        );
    });


});


describe("filterDefined()", () => {

    it("returns an array containing only the items that are not null or undefined", () => {
        const input = [1, undefined, "two", null, true];
        expect(filterDefined(input)).toEqual([1, "two", true]);
    });


    it("returns an empty array if all values are null or undefined", () => {
        const input = [null, null, undefined, null, undefined, undefined];
        expect(filterDefined(input)).toEqual([]);
    });


    it("falsy values such as false, 0 and empty string are not filtered out", () => {
        const input = [false, 0, "", 1];
        expect(filterDefined(input)).toEqual([false, 0, "", 1]);
    });
});


describe("choose()", () => {

    it("includes only the return values that are successful", () => {
        const chooseEven = (x: number) => x % 2 === 0 ? new SucceededResult({ val: x }) : new FailedResult(undefined);
        const out = choose(chooseEven, [1, 2, 3, 4, 5, 6]);
        expect(out).toEqual([{ val: 2 }, { val: 4 }, { val: 6 }]);
    });

});


describe("chooseAsync()", () => {

    it("includes only the async return values that are successful", async () => {
        const chooseEvenAsync = (x: number) => x % 2 === 0 ?
            Promise.resolve(new SucceededResult({ val: x })) :
            Promise.resolve(new FailedResult(undefined));
        const out = await chooseAsync(chooseEvenAsync, [1, 2, 3, 4, 5, 6]);
        expect(out).toEqual([{ val: 2 }, { val: 4 }, { val: 6 }]);
    });

});


describe("chooseFirst()", () => {

    it("returns a failed Result with the error value when no inputs produce a success", () => {
        let numInvocations = 0;
        const fnContainsFox = (str: string) => {
            numInvocations++;
            return str.includes("fox") ?
                new SucceededResult(str + "-output") : new FailedResult("error message");
        };

        const inputs = ["foo bar", "quux", "one hen", "two ducks"];
        const res = chooseFirst(fnContainsFox, "none found", inputs);
        expect(res.failed).toBeTrue();
        expect(res.error).toEqual("none found");
        expect(numInvocations).toEqual(4);
    });


    it("returns a successful Result for the first input that produces a success", () => {
        let numInvocations = 0;
        const fnContainsFox = (str: string) => {
            numInvocations++;
            return str.includes("fox") ?
                new SucceededResult(str + "-output") : new FailedResult("error message");
        };

        const inputs = ["foo bar", "brown fox", "quick brown fox"];
        const res = chooseFirst(fnContainsFox, "none found", inputs);
        expect(res.succeeded).toBeTrue();
        expect(res.value).toEqual("brown fox-output");
        expect(numInvocations).toEqual(2);
    });

});


describe("chooseFirstAsync()", () => {

    it("returns a failed Result with the error value when no inputs produce a success", async () => {
        let numInvocations = 0;
        const fnContainsFox = async (str: string) => {
            numInvocations++;
            await getTimerPromise(getRandomInt(10, 30), 0);
            return str.includes("fox") ?
                new SucceededResult(str + "-output") : new FailedResult("error message");
        };

        const inputs = ["foo bar", "quux", "one hen", "two ducks"];
        const res = await chooseFirstAsync(fnContainsFox, "none found", inputs);
        expect(res.failed).toBeTrue();
        expect(res.error).toEqual("none found");
        expect(numInvocations).toEqual(4);
    });


    it("returns a successful Result for the first input that produces a success", async () => {
        let numInvocations = 0;
        const fnContainsFox = async (str: string) => {
            numInvocations++;
            await getTimerPromise(getRandomInt(10, 30), 0);
            return str.includes("fox") ?
                new SucceededResult(str + "-output") : new FailedResult("error message");
        };

        const inputs = ["foo bar", "brown fox", "quick brown fox"];
        const res = await chooseFirstAsync(fnContainsFox, "none found", inputs);
        expect(res.succeeded).toBeTrue();
        expect(res.value).toEqual("brown fox-output");
        expect(numInvocations).toEqual(2);
    });

});
