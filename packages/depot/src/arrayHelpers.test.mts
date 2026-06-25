import {
    filterDefined,
    insertIf, permutations, toArray,
    hasIndex,
    atOrDefault,
    lastIndex,
    fromNullable,
    insertIfWith
} from "./arrayHelpers.mjs";
import { NoneOption, SomeOption, Option } from "./option.mjs";


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


describe("atOrDefault()", () => {

    it("returns the default value when the index is out of bounds", () => {
        expect(atOrDefault([1, 2, 3], 3, 0)).toEqual(0);
        expect(atOrDefault([1, 2, 3], -1, 0)).toEqual(0);
    });

    it("returns the item at the specified index when it is in bounds", () => {
        expect(atOrDefault([1, 2, 3], 1, 0)).toEqual(2);
    });

});


describe("lastIndex", () => {

    it("returns undefined for an empty array", () => {
        expect(lastIndex([])).toBeUndefined();
    });


    it("returns the last index for a non-empty array", () => {
        expect(lastIndex([1, 2, 3])).toEqual(2);
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


describe("insertIfWith()", () => {

    it("does not invoke the function when the conition is false", () => {
        const opt = NoneOption.get() as Option<number>;
        let invocationCounter = 0;
        const arr = [
            ...insertIfWith(opt.isSome, () => {
                invocationCounter++;
                return [opt.value!.toString()];
            })
        ];
        expect(invocationCounter).toEqual(0);
        expect(arr.length).toEqual(0);
    });


    it("invokes the function and includes the return values when the condition is true", () => {
        const opt = new SomeOption(42) as Option<number>;
        let invocationCounter = 0;
        const arr = [
            ...insertIfWith(opt.isSome, () => {
                invocationCounter++;
                return [opt.value!.toString()];
            })
        ];
        expect(invocationCounter).toEqual(1);
        expect(arr.length).toEqual(1);
        expect(arr[0]).toEqual("42");
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


describe("fromNullable()", () => {

    it("returns an empty array for null input", () => {
        const result = fromNullable(null);
        expect(result).toEqual([]);
    });


    it("returns an empty array for undefined input", () => {
        const result = fromNullable(undefined);
        expect(result).toEqual([]);
    });


    it("returns the original array for non-nullable input", () => {
        const result = fromNullable([1, 2, 3]);
        expect(result).toEqual([1, 2, 3]);
    });
});
