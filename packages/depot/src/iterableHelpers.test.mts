import {
    augmentAsync, buildIndex, choose, chooseAsync, chooseFirst, chooseFirstAsync, filter, filterAsync,
    findFirstDuplicateBy, firstMatch, groupConsecutiveBy, intersperse, map, mapAsync, partitionAsync,
    reduce, reduceAsync, split, zipWithAsync
} from "./iterableHelpers.mjs";
import { NoneOption, SomeOption } from "./option.mjs";
import { FailedResult, SucceededResult } from "./result.mjs";
import { getTimerPromise } from "./promiseHelpers.mjs";
import { getRandomInt } from "./random.mjs";
import { pipe } from "./pipe2.mjs";
import { pipeAsync } from "./pipeAsync2.mjs";


describe("iterableHelpers", () => {

    describe("buildIndex()", () => {

        const people = [
            {first: "Fred", last: "Flintstone"},
            {first: "Wilma", last: "Flintstone"},
            {first: "Betty", last: "Rubble"},
            {first: "Barney", last: "Rubble"}
        ];

        it("builds the expected Map", () => {

            const personMap = buildIndex((p) => p.first, people);
            expect(Array.from(personMap.entries())).toEqual([
                ["Fred", { first: "Fred", last: "Flintstone" }],
                ["Wilma", { first: "Wilma", last: "Flintstone" }],
                ["Betty", { first: "Betty", last: "Rubble" }],
                ["Barney", { first: "Barney", last: "Rubble" }]
            ]);

        });


        it("passes each item's index to the key function", () => {

            const personMap = buildIndex((p, index) => `${index}:${p.first}`, people);
            expect(Array.from(personMap.keys())).toEqual([
                "0:Fred", "1:Wilma", "2:Betty", "3:Barney"
            ]);

        });


        it("supports point-free use via the curried form", () => {

            const personMap = buildIndex((p: {first: string}) => p.first)(people);
            expect(Array.from(personMap.keys())).toEqual([
                "Fred", "Wilma", "Betty", "Barney"
            ]);

        });


        it("operates on any Iterable, not just arrays", () => {

            const personMap = buildIndex((p) => p.first, new Set(people));
            expect(Array.from(personMap.keys())).toEqual([
                "Fred", "Wilma", "Betty", "Barney"
            ]);

        });


    });

});


describe("findFirstDuplicateBy()", () => {

    const people = [
        {first: "Fred", last: "Flintstone"},
        {first: "Wilma", last: "Flintstone"},
        {first: "Betty", last: "Rubble"},
        {first: "Barney", last: "Rubble"}
    ];


    it("returns NoneOption when there are no duplicates", () => {

        const result = findFirstDuplicateBy((p) => p.first, people);
        expect(result).toEqual(NoneOption.get());

    });


    it("returns SomeOption when a duplicate is found", () => {

        const result = findFirstDuplicateBy((p) => p.last, people);
        expect(result).toEqual(new SomeOption({ elem: people[1]!, criterion: "Flintstone" }));

    });


    it("passes each item's index to the criterion function", () => {

        // Using the index as the criterion means every item is unique, so no
        // duplicate is ever found.
        const result = findFirstDuplicateBy((p, index) => `${index}:${p.last}`, people);
        expect(result).toEqual(NoneOption.get());

    });


    it("supports point-free use via the curried form", () => {

        const result = findFirstDuplicateBy((p: {last: string}) => p.last)(people);
        expect(result).toEqual(new SomeOption({ elem: people[1]!, criterion: "Flintstone" }));

    });


    it("operates on any Iterable, not just arrays", () => {

        const result = findFirstDuplicateBy((p) => p.last, new Set(people));
        expect(result).toEqual(new SomeOption({ elem: people[1]!, criterion: "Flintstone" }));

    });

});


describe("mapAsync()", () => {

    it("eagerly maps the items of an array", async () => {
        const result = await mapAsync((x: number) => Promise.resolve(x * 2), [1, 2, 3]);
        expect(result).toEqual([2, 4, 6]);
    });


    it("operates on any Iterable, not just arrays", async () => {
        const set = new Set([1, 2, 3]);
        const result = await mapAsync((x: number) => Promise.resolve(x * 2), set);
        expect(result).toEqual([2, 4, 6]);
    });


    it("passes each item's index to the mapping function", async () => {
        const result = await mapAsync(
            (x: string, index: number) => Promise.resolve(`${index}:${x}`),
            ["a", "b", "c"]
        );
        expect(result).toEqual(["0:a", "1:b", "2:c"]);
    });


    it("supports point-free use with pipeAsync()", async () => {
        const result = await pipeAsync(
            [1, 2, 3],
            mapAsync((x: number) => Promise.resolve(x + 1))
        );
        expect(result).toEqual([2, 3, 4]);
    });


    it("invokes the mapping functions concurrently", async () => {
        let numConcurrent = 0;
        let maxConcurrent = 0;

        const result = await mapAsync(
            async (x: number) => {
                numConcurrent++;
                maxConcurrent = Math.max(maxConcurrent, numConcurrent);
                await Promise.resolve();
                numConcurrent--;
                return x;
            },
            [1, 2, 3]
        );

        expect(result).toEqual([1, 2, 3]);
        expect(maxConcurrent).toBeGreaterThan(1);
    });


    it("rejects as soon as the first mapping function rejects", async () => {
        try {
            await mapAsync(
                (x: number) => x === 2 ?
                    Promise.reject(new Error("boom")) :
                    Promise.resolve(x),
                [1, 2, 3]
            );
            fail("Expected the returned promise to reject.");
        }
        catch (err) {
            expect((err as Error).message).toEqual("boom");
        }
    });

});


describe("augmentAsync()", () => {

    it("eagerly resolves with the augmented items when all async values succeed", async () => {
        const col = [{value: 1}, {value: 2}, {value: 3}];
        const augmentFn = (input: {value: number}) => Promise.resolve({isEven: input.value % 2 === 0});

        const augmented = await augmentAsync(augmentFn, col);
        expect(augmented).toEqual([
            {value: 1, isEven: false},
            {value: 2, isEven: true},
            {value: 3, isEven: false}
        ]);
    });


    it("passes each item's index to the augment function", async () => {
        const col = [{value: 10}, {value: 20}];

        const augmented = await augmentAsync((input: {value: number}, index) => Promise.resolve({index}), col);
        expect(augmented).toEqual([
            {value: 10, index: 0},
            {value: 20, index: 1}
        ]);
    });


    it("supports point-free use with pipeAsync()", async () => {
        const augmented = await pipeAsync(
            [{value: 1}, {value: 2}],
            augmentAsync((input: {value: number}) => Promise.resolve({doubled: input.value * 2}))
        );
        expect(augmented).toEqual([
            {value: 1, doubled: 2},
            {value: 2, doubled: 4}
        ]);
    });


    it("operates on any Iterable, not just arrays", async () => {
        const set = new Set([{value: 1}, {value: 2}]);
        const augmented = await augmentAsync(
            (input: {value: number}) => Promise.resolve({isEven: input.value % 2 === 0}),
            set
        );
        expect(augmented).toEqual([
            {value: 1, isEven: false},
            {value: 2, isEven: true}
        ]);
    });


    it("rejects if obtaining any of the asynchronous values rejects", async () => {
        const col = [{value: 1}, {value: 2}, {value: 3}];

        const augmentFn = (input: {value: number}) => {
            const isEven = input.value % 2 === 0;
            return isEven ?
                // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                Promise.reject("error message") :
                Promise.resolve({isEven});
        };

        try {
            await augmentAsync(augmentFn, col);
            fail("Expected the returned promise to reject.");
        }
        catch (err) {
            expect(err).toEqual("error message");
        }
    });

});


describe("zipWithAsync()", () => {

    it("eagerly resolves with the expected [item, value] tuples", async () => {
        const pairs = await zipWithAsync((curNum: number) => Promise.resolve(curNum + 1), [10, 30, 15]);
        expect(pairs).toEqual([
            [10, 11],
            [30, 31],
            [15, 16]
        ]);
    });


    it("passes each item's index to the async function", async () => {
        const pairs = await zipWithAsync((curStr: string, index) => Promise.resolve(index), ["a", "b", "c"]);
        expect(pairs).toEqual([
            ["a", 0],
            ["b", 1],
            ["c", 2]
        ]);
    });


    it("supports point-free use with pipeAsync()", async () => {
        const pairs = await pipeAsync(
            [1, 2, 3],
            zipWithAsync((curNum: number) => Promise.resolve(curNum * 10))
        );
        expect(pairs).toEqual([
            [1, 10],
            [2, 20],
            [3, 30]
        ]);
    });


    it("operates on any Iterable, not just arrays", async () => {
        const pairs = await zipWithAsync((curNum: number) => Promise.resolve(curNum + 1), new Set([10, 30, 15]));
        expect(pairs).toEqual([
            [10, 11],
            [30, 31],
            [15, 16]
        ]);
    });


    it("rejects if obtaining any of the asynchronous values rejects", async () => {
        const valueFunc = (curNum: number) => curNum % 2 === 0 ?
            Promise.resolve(curNum + 1) :
            Promise.reject(new Error(`${curNum} rejected.`));

        try {
            await zipWithAsync(valueFunc, [10, 31, 16]);
            fail("Expected the returned promise to reject.");
        }
        catch (err) {
            expect((err as Error).message).toEqual("31 rejected.");
        }
    });

});


describe("filterAsync()", () => {

    it("eagerly keeps only the items whose predicate resolves truthy", async () => {
        const result = await filterAsync((curNum: number) => Promise.resolve(curNum % 2 === 0), [10, 31, 16]);
        expect(result).toEqual([10, 16]);
    });


    it("passes each item's index to the predicate", async () => {
        // Keep only items at even indices.
        const result = await filterAsync((curStr: string, index) => Promise.resolve(index % 2 === 0), ["a", "b", "c", "d"]);
        expect(result).toEqual(["a", "c"]);
    });


    it("supports point-free use with pipeAsync()", async () => {
        const result = await pipeAsync(
            [1, 2, 3, 4],
            filterAsync((curNum: number) => Promise.resolve(curNum > 2))
        );
        expect(result).toEqual([3, 4]);
    });


    it("operates on any Iterable, not just arrays", async () => {
        const result = await filterAsync((curNum: number) => Promise.resolve(curNum % 2 === 0), new Set([10, 31, 16]));
        expect(result).toEqual([10, 16]);
    });


    it("rejects if any of the async predicate invocations rejects", async () => {
        const asyncRejectIfOdd = (curNum: number) => curNum % 2 === 0 ?
            Promise.resolve(true) :
            Promise.reject(new Error(`${curNum} rejected.`));

        try {
            await filterAsync(asyncRejectIfOdd, [10, 31, 16]);
            fail("Expected the returned promise to reject.");
        }
        catch (err) {
            expect((err as Error).message).toEqual("31 rejected.");
        }
    });

});


describe("partitionAsync()", () => {

    it("eagerly separates items based on the async predicate", async () => {
        const [evens, odds] = await partitionAsync((curNum: number) => Promise.resolve(curNum % 2 === 0), [10, 31, 16]);
        expect(evens).toEqual([10, 16]);
        expect(odds).toEqual([31]);
    });


    it("passes each item's index to the predicate", async () => {
        // Partition by even/odd index.
        const [evenIdx, oddIdx] = await partitionAsync(
            (curStr: string, index) => Promise.resolve(index % 2 === 0),
            ["a", "b", "c", "d"]
        );
        expect(evenIdx).toEqual(["a", "c"]);
        expect(oddIdx).toEqual(["b", "d"]);
    });


    it("supports point-free use with pipeAsync()", async () => {
        const [big, small] = await pipeAsync(
            [1, 5, 2, 8],
            partitionAsync((curNum: number) => Promise.resolve(curNum >= 5))
        );
        expect(big).toEqual([5, 8]);
        expect(small).toEqual([1, 2]);
    });


    it("operates on any Iterable, not just arrays", async () => {
        const [evens, odds] = await pipeAsync(
            new Set([10, 31, 16]),
            partitionAsync((curNum: number) => Promise.resolve(curNum % 2 === 0))
        );
        expect(evens).toEqual([10, 16]);
        expect(odds).toEqual([31]);
    });


    it("rejects if any of the async predicate invocations rejects", async () => {
        const asyncRejectIfOdd = (curNum: number) => curNum % 2 === 0 ?
            Promise.resolve(true) :
            Promise.reject(new Error(`${curNum} rejected.`));

        try {
            await partitionAsync(asyncRejectIfOdd, [10, 31, 16]);
            fail("Expected the returned promise to reject.");
        }
        catch (err) {
            expect((err as Error).message).toEqual("31 rejected.");
        }
    });

});


describe("reduceAsync()", () => {

    it("eagerly reduces to the expected value", async () => {
        const reduced = await reduceAsync(
            (acc: Array<number>, curVal: number) => Promise.resolve([...acc, curVal + 1]),
            [] as Array<number>,
            [1, 2, 3]
        );
        expect(reduced).toEqual([2, 3, 4]);
    });


    it("passes each item's index to the accumulator function", async () => {
        const reduced = await reduceAsync(
            (acc: number, curVal: number, index: number) => Promise.resolve(acc + curVal * index),
            0,
            [10, 20, 30]
        );
        // 0 + 10*0 + 20*1 + 30*2 = 80
        expect(reduced).toEqual(80);
    });


    it("supports point-free use with pipeAsync()", async () => {
        const sum = await pipeAsync(
            [1, 2, 3, 4],
            reduceAsync((acc: number, curVal: number) => Promise.resolve(acc + curVal), 0)
        );
        expect(sum).toEqual(10);
    });


    it("operates on any Iterable, not just arrays", async () => {
        const sum = await reduceAsync(
            (acc: number, curVal: number) => Promise.resolve(acc + curVal),
            0,
            new Set([1, 2, 3])
        );
        expect(sum).toEqual(6);
    });


    it("rejects if the accumulator function rejects", async () => {
        try {
            await reduceAsync(
                (acc: Array<number>, curVal: number) => curVal % 2 === 0 ?
                    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
                    Promise.reject("error message") :
                    Promise.resolve([...acc, curVal + 1]),
                [] as Array<number>,
                [1, 2, 3]
            );
            fail("Expected the returned promise to reject.");
        }
        catch (err) {
            expect(err).toEqual("error message");
        }
    });

});


describe("firstMatch()", () => {

    it("returns the first non-null match", () => {
        const match = firstMatch(/a.b.c/, ["abc", "a-b-c"]);
        expect(match).toBeTruthy();
        expect(match![0]).toEqual("a-b-c");
    });


    it("returns undefined when no string matches", () => {
        const match = firstMatch(/a_b_c/, ["abc", "a-b-c"]);
        expect(match).toEqual(undefined);
    });


    it("supports point-free use with pipe()", () => {
        const match = pipe(
            ["abc", "a-b-c"],
            firstMatch(/a.b.c/)
        );
        expect(match![0]).toEqual("a-b-c");
    });


    it("operates on any Iterable, not just arrays", () => {
        const match = firstMatch(/a.b.c/, new Set(["abc", "a-b-c"]));
        expect(match![0]).toEqual("a-b-c");
    });

});


describe("intersperse()", () => {

    it("returns an empty array when given no items", () => {
        expect(intersperse("-", [])).toEqual([]);
    });


    it("returns a single-item array unchanged", () => {
        expect(intersperse("-", ["a"])).toEqual(["a"]);
    });


    it("inserts the separator between items", () => {
        expect(intersperse("-", ["a", "b", "c"])).toEqual(["a", "-", "b", "-", "c"]);
    });


    it("does not modify the input", () => {
        const input = ["a", "b", "c"];
        intersperse("-", input);
        expect(input).toEqual(["a", "b", "c"]);
    });


    it("supports point-free use with pipe()", () => {
        const result = pipe(["a", "b", "c"], intersperse("-"));
        expect(result).toEqual(["a", "-", "b", "-", "c"]);
    });


    it("operates on any Iterable, not just arrays", () => {
        // A generator yields the items lazily.
        function* gen(): Generator<number> {
            yield 1;
            yield 2;
            yield 3;
        }
        expect(intersperse(0, gen())).toEqual([1, 0, 2, 0, 3]);
    });

});


describe("split()", () => {

    it("splits into two arrays at numToTake", () => {
        expect(split(3, [1, 2, 3, 4, 5])).toEqual([[1, 2, 3], [4, 5]]);
    });


    it("puts everything in the first array when numToTake equals the length", () => {
        expect(split(5, [1, 2, 3, 4, 5])).toEqual([[1, 2, 3, 4, 5], []]);
    });


    it("puts everything in the first array when numToTake exceeds the length", () => {
        expect(split(6, [1, 2, 3, 4, 5])).toEqual([[1, 2, 3, 4, 5], []]);
    });


    it("puts everything in the second array when numToTake is 0", () => {
        expect(split(0, [1, 2, 3, 4, 5])).toEqual([[], [1, 2, 3, 4, 5]]);
    });


    it("treats a negative numToTake as 0", () => {
        expect(split(-2, [1, 2, 3, 4, 5])).toEqual([[], [1, 2, 3, 4, 5]]);
    });


    it("supports point-free use with pipe()", () => {
        const [first, second] = pipe([1, 2, 3, 4, 5], split(2));
        expect(first).toEqual([1, 2]);
        expect(second).toEqual([3, 4, 5]);
    });


    it("operates on any Iterable, not just arrays", () => {
        expect(split(2, new Set([1, 2, 3, 4]))).toEqual([[1, 2], [3, 4]]);
    });

});


describe("groupConsecutiveBy()", () => {

    const isSimilarEvenOdd = (a: number, b: number) => (a % 2) === (b % 2);

    it("returns no groups when given no items", () => {
        expect(groupConsecutiveBy(isSimilarEvenOdd, [])).toEqual([]);
    });


    it("returns single-item groups when no consecutive items are similar", () => {
        expect(groupConsecutiveBy(isSimilarEvenOdd, [0, 1, 2, 3, 4, 5])).toEqual([
            [0], [1], [2], [3], [4], [5]
        ]);
    });


    it("groups similar items at the beginning", () => {
        expect(groupConsecutiveBy(isSimilarEvenOdd, [0, 2, 4, 3, 4, 5])).toEqual([
            [0, 2, 4], [3], [4], [5]
        ]);
    });


    it("groups similar items in the middle", () => {
        expect(groupConsecutiveBy(isSimilarEvenOdd, [0, 1, 2, 4, 6, 7, 8])).toEqual([
            [0], [1], [2, 4, 6], [7], [8]
        ]);
    });


    it("groups similar items at the end", () => {
        expect(groupConsecutiveBy(isSimilarEvenOdd, [0, 1, 2, 3, 4, 6, 24])).toEqual([
            [0], [1], [2], [3], [4, 6, 24]
        ]);
    });


    it("supports point-free use with pipe()", () => {
        const groups = pipe([0, 2, 1, 3], groupConsecutiveBy(isSimilarEvenOdd));
        expect(groups).toEqual([[0, 2], [1, 3]]);
    });


    it("operates on any Iterable, not just arrays", () => {
        expect(groupConsecutiveBy(isSimilarEvenOdd, new Set([0, 2, 1, 3]))).toEqual([
            [0, 2], [1, 3]
        ]);
    });

});


describe("choose()", () => {

    const chooseEven = (x: number) => x % 2 === 0 ?
        new SucceededResult({val: x}) :
        new FailedResult(undefined);


    it("includes only the successful return values", () => {
        expect(choose(chooseEven, [1, 2, 3, 4, 5, 6])).toEqual([{val: 2}, {val: 4}, {val: 6}]);
    });


    it("supports point-free use with pipe()", () => {
        expect(pipe([1, 2, 3, 4], choose(chooseEven))).toEqual([{val: 2}, {val: 4}]);
    });


    it("operates on any Iterable, not just arrays", () => {
        expect(choose(chooseEven, new Set([1, 2, 3, 4]))).toEqual([{val: 2}, {val: 4}]);
    });

});


describe("chooseAsync()", () => {

    const chooseEvenAsync = (x: number) => x % 2 === 0 ?
        Promise.resolve(new SucceededResult({val: x})) :
        Promise.resolve(new FailedResult(undefined));


    it("includes only the successful async return values", async () => {
        const out = await chooseAsync(chooseEvenAsync, [1, 2, 3, 4, 5, 6]);
        expect(out).toEqual([{val: 2}, {val: 4}, {val: 6}]);
    });


    it("supports point-free use with pipeAsync()", async () => {
        const out = await pipeAsync([1, 2, 3, 4], chooseAsync(chooseEvenAsync));
        expect(out).toEqual([{val: 2}, {val: 4}]);
    });


    it("operates on any Iterable, not just arrays", async () => {
        const out = await chooseAsync(chooseEvenAsync, new Set([1, 2, 3, 4]));
        expect(out).toEqual([{val: 2}, {val: 4}]);
    });

});


describe("chooseFirst()", () => {

    const fnContainsFox = (str: string) => str.includes("fox") ?
        new SucceededResult(str + "-output") :
        new FailedResult("error message");


    it("returns a failed Result with the error value when no input produces a success", () => {
        const res = chooseFirst(fnContainsFox, "none found", ["foo bar", "quux", "one hen"]);
        expect(res.failed).toBeTrue();
        expect(res.error).toEqual("none found");
    });


    it("returns the first successful Result, stopping early", () => {
        let numInvocations = 0;
        const counted = (str: string) => {
            numInvocations++;
            return fnContainsFox(str);
        };

        const res = chooseFirst(counted, "none found", ["foo bar", "brown fox", "quick brown fox"]);
        expect(res.succeeded).toBeTrue();
        expect(res.value).toEqual("brown fox-output");
        expect(numInvocations).toEqual(2);
    });


    it("supports point-free use with pipe()", () => {
        const res = pipe(["foo bar", "brown fox"], chooseFirst(fnContainsFox, "none found"));
        expect(res.value).toEqual("brown fox-output");
    });

});


describe("chooseFirstAsync()", () => {

    const fnContainsFoxAsync = async (str: string) => {
        await getTimerPromise(getRandomInt(10, 30), 0);
        return str.includes("fox") ?
            new SucceededResult(str + "-output") :
            new FailedResult("error message");
    };


    it("returns a failed Result with the error value when no input produces a success", async () => {
        const res = await chooseFirstAsync(fnContainsFoxAsync, "none found", ["foo bar", "quux", "one hen"]);
        expect(res.failed).toBeTrue();
        expect(res.error).toEqual("none found");
    });


    it("returns the first successful Result, stopping early", async () => {
        let numInvocations = 0;
        const counted = (str: string) => {
            numInvocations++;
            return fnContainsFoxAsync(str);
        };

        const res = await chooseFirstAsync(counted, "none found", ["foo bar", "brown fox", "quick brown fox"]);
        expect(res.succeeded).toBeTrue();
        expect(res.value).toEqual("brown fox-output");
        expect(numInvocations).toEqual(2);
    });


    it("supports point-free use with pipeAsync()", async () => {
        const res = await pipeAsync(["foo bar", "brown fox"], chooseFirstAsync(fnContainsFoxAsync, "none found"));
        expect(res.value).toEqual("brown fox-output");
    });

});


describe("map()", () => {

    it("eagerly maps the items", () => {
        expect(map((x: number) => x * 2, [1, 2, 3])).toEqual([2, 4, 6]);
    });


    it("passes each item's index to the mapping function", () => {
        expect(map((x: string, index) => `${index}:${x}`, ["a", "b", "c"])).toEqual(["0:a", "1:b", "2:c"]);
    });


    it("supports point-free use with pipe()", () => {
        expect(pipe([1, 2, 3], map((x: number) => x + 1))).toEqual([2, 3, 4]);
    });


    it("operates on any Iterable, not just arrays", () => {
        expect(map((x: number) => x * 2, new Set([1, 2, 3]))).toEqual([2, 4, 6]);
    });

});


describe("filter()", () => {

    it("eagerly keeps only the items whose predicate is truthy", () => {
        expect(filter((x: number) => x % 2 === 0, [1, 2, 3, 4])).toEqual([2, 4]);
    });


    it("passes each item's index to the predicate", () => {
        expect(filter((x: string, index) => index % 2 === 0, ["a", "b", "c", "d"])).toEqual(["a", "c"]);
    });


    it("supports point-free use with pipe()", () => {
        expect(pipe([1, 2, 3, 4], filter((x: number) => x > 2))).toEqual([3, 4]);
    });


    it("operates on any Iterable, not just arrays", () => {
        expect(filter((x: number) => x % 2 === 0, new Set([1, 2, 3, 4]))).toEqual([2, 4]);
    });

});


describe("reduce()", () => {

    it("eagerly reduces to a single value", () => {
        expect(reduce((acc: number, x: number) => acc + x, 0, [1, 2, 3, 4])).toEqual(10);
    });


    it("passes each item's index to the accumulator function", () => {
        // 0 + 10*0 + 20*1 + 30*2 = 80
        expect(reduce((acc: number, x: number, index: number) => acc + x * index, 0, [10, 20, 30])).toEqual(80);
    });


    it("supports point-free use with pipe()", () => {
        const sum = pipe([1, 2, 3, 4], reduce((acc: number, x: number) => acc + x, 0));
        expect(sum).toEqual(10);
    });


    it("operates on any Iterable, not just arrays", () => {
        expect(reduce((acc: number, x: number) => acc + x, 0, new Set([1, 2, 3]))).toEqual(6);
    });

});
