import { hashSync } from "./hash.mjs";
import { LruCache } from "./lruCache.mjs";
import { NoneOption, SomeOption } from "./option.mjs";


////////////////////////////////////////////////////////////////////////////////
// Key data type that will exercise value object equality.
class Person {
    public constructor(public readonly first: string, public readonly last: string) {
    }
}

function hashPerson(p: Person) {
    const intrinsics = {
        // Include the name of the type so that it can't compare equal to
        // other types that coincidentally have the same properties.
        person: {
            first: p.first.toLocaleLowerCase(),
            last:  p.last.toLocaleLowerCase()
        }
    };
    return hashSync(JSON.stringify(intrinsics), "base64");
}

////////////////////////////////////////////////////////////////////////////////


describe("LruCache", () => {

    const fred = {first: "Fred", last: "Flintstone"};
    const wilma = {first: "Wilma", last: "Flintstone"};
    const barney = {first: "Barney", last: "Rubble"};
    const betty = {first: "Betty", last: "Rubble"};

    describe("capacity", () => {

        it("returns the capacity specified during construction ", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);
            expect(cache.capacity).toEqual(3);
        });


        it("throws when capacity is zero", () => {
            const ctor = () => new LruCache<Person, number>(0, hashPerson);
            expect(ctor).toThrowError("Capacity must be greater than 0");
        });


        it("throws when capacity is negative", () => {
            const ctor = () => new LruCache<Person, number>(-1, hashPerson);
            expect(ctor).toThrowError("Capacity must be greater than 0");
        });


        it("returns the updated capacity after resize()", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);

            cache.resize(5);

            expect(cache.capacity).toEqual(5);
        });

    });


    describe("resize()", () => {

        it("throws when newCapacity is zero", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);

            expect(() => cache.resize(0)).toThrowError("Capacity must be greater than 0");
        });


        it("throws when newCapacity is negative", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);

            expect(() => cache.resize(-1)).toThrowError("Capacity must be greater than 0");
        });


        it("does not evict when growing capacity", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);

            cache.resize(4);

            expect(cache.size).toEqual(2);
            expect(cache.get(fred)).toEqual(new SomeOption(40));
            expect(cache.get(wilma)).toEqual(new SomeOption(34));
        });


        it("evicts least recently used items when shrinking", () => {
            const cache = new LruCache<Person, number>(4, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);
            cache.set(barney, 37);
            cache.set(betty, 33);

            // Recency order is [betty, barney, wilma, fred].
            cache.resize(2);

            expect(cache.size).toEqual(2);
            expect(cache.get(fred)).toEqual(NoneOption.get());
            expect(cache.get(wilma)).toEqual(NoneOption.get());
            expect(cache.get(barney)).toEqual(new SomeOption(37));
            expect(cache.get(betty)).toEqual(new SomeOption(33));
        });


        it("respects current recency order when shrinking", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);
            cache.set(barney, 37);

            // Touch fred so wilma becomes least recently used.
            cache.get(fred);
            cache.resize(2);

            expect(cache.get(wilma)).toEqual(NoneOption.get());
            expect(cache.get(fred)).toEqual(new SomeOption(40));
            expect(cache.get(barney)).toEqual(new SomeOption(37));
        });


        it("allows future inserts up to the resized capacity", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);
            cache.set(barney, 37);

            cache.resize(1);
            expect(cache.size).toEqual(1);

            cache.set(betty, 33);
            expect(cache.size).toEqual(1);
            expect(cache.get(barney)).toEqual(NoneOption.get());
            expect(cache.get(betty)).toEqual(new SomeOption(33));
        });

    });


    describe("size", () => {

        it("returns the expected size", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);
            expect(cache.size).toEqual(0);

            cache.set(fred, 40);
            expect(cache.size).toEqual(1);

            cache.set(wilma, 34);
            expect(cache.size).toEqual(2);

            cache.set(barney, 37);
            expect(cache.size).toEqual(3);

            cache.set(betty, 34);
            // Cache should have evicted the least recently used item, so size should
            expect(cache.size).toEqual(3);
        });


        it("does not grow when setting an existing key", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);

            expect(cache.size).toEqual(2);
            cache.set(fred, 41);
            expect(cache.size).toEqual(2);
        });


        it("does not change when get() misses", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);
            cache.set(fred, 40);

            expect(cache.size).toEqual(1);
            expect(cache.get(wilma)).toEqual(NoneOption.get());
            expect(cache.size).toEqual(1);
        });


        it("does not change when get() hits", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);
            cache.set(fred, 40);

            expect(cache.size).toEqual(1);
            expect(cache.get(fred)).toEqual(new SomeOption(40));
            expect(cache.size).toEqual(1);
        });

    });


    describe("has()", () => {

        it("returns false when the key is not present", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            expect(cache.has(fred)).toBeFalse();
        });


        it("returns true when the key is present", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);
            cache.set(fred, 40);

            expect(cache.has(fred)).toBeTrue();
        });


        it("does not count as a use and does not update recency", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            cache.set(fred, 40);
            cache.set(wilma, 34);

            // Querying membership should not affect recency order.
            expect(cache.has(fred)).toBeTrue();

            cache.set(barney, 37);

            expect(cache.get(fred)).toEqual(NoneOption.get());
            expect(cache.get(wilma)).toEqual(new SomeOption(34));
            expect(cache.get(barney)).toEqual(new SomeOption(37));
        });

    });


    describe("peek()", () => {

        it("returns NoneOption when the key is not present", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            expect(cache.peek(fred)).toEqual(NoneOption.get());
        });


        it("returns SomeOption when the key is present", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);
            cache.set(fred, 40);

            expect(cache.peek(fred)).toEqual(new SomeOption(40));
        });


        it("does not count as a use and does not update recency", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            cache.set(fred, 40);
            cache.set(wilma, 34);

            expect(cache.peek(fred)).toEqual(new SomeOption(40));

            cache.set(barney, 37);

            expect(cache.get(fred)).toEqual(NoneOption.get());
            expect(cache.get(wilma)).toEqual(new SomeOption(34));
            expect(cache.get(barney)).toEqual(new SomeOption(37));
        });


        it("does not change size", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);
            cache.set(fred, 40);

            expect(cache.size).toEqual(1);
            expect(cache.peek(fred)).toEqual(new SomeOption(40));
            expect(cache.peek(wilma)).toEqual(NoneOption.get());
            expect(cache.size).toEqual(1);
        });

    });


    describe("keys(), values() and entries()", () => {

        it("return iterators", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            const keysIter = cache.keys();
            const valuesIter = cache.values();
            const entriesIter = cache.entries();

            expect(typeof keysIter.next).toEqual("function");
            expect(typeof valuesIter.next).toEqual("function");
            expect(typeof entriesIter.next).toEqual("function");
        });


        it("return items in recency order", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);
            cache.set(barney, 37);

            expect(Array.from(cache.keys())).toEqual([barney, wilma, fred]);
            expect(Array.from(cache.values())).toEqual([37, 34, 40]);
            expect(Array.from(cache.entries())).toEqual([
                [barney, 37],
                [wilma, 34],
                [fred, 40]
            ]);
        });


        it("reflect updated recency after get()", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);
            cache.set(barney, 37);

            cache.get(wilma);

            expect(Array.from(cache.keys())).toEqual([wilma, barney, fred]);
            expect(Array.from(cache.values())).toEqual([34, 37, 40]);
            expect(Array.from(cache.entries())).toEqual([
                [wilma, 34],
                [barney, 37],
                [fred, 40]
            ]);
        });

    });


    describe("delete()", () => {

        it("returns false when the key is not present", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            expect(cache.delete(fred)).toBeFalse();
        });


        it("returns true when the key is present", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);
            cache.set(fred, 40);

            expect(cache.delete(fred)).toBeTrue();
        });


        it("removes an existing key from the cache", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);

            expect(cache.delete(fred)).toBeTrue();
            expect(cache.get(fred)).toEqual(NoneOption.get());
            expect(cache.get(wilma)).toEqual(new SomeOption(34));
        });


        it("decrements size when an item is removed", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);

            expect(cache.size).toEqual(2);
            expect(cache.delete(fred)).toBeTrue();
            expect(cache.size).toEqual(1);
        });


        it("frees capacity for future inserts", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);

            expect(cache.delete(fred)).toBeTrue();
            cache.set(barney, 37);

            expect(cache.get(fred)).toEqual(NoneOption.get());
            expect(cache.get(wilma)).toEqual(new SomeOption(34));
            expect(cache.get(barney)).toEqual(new SomeOption(37));
            expect(cache.size).toEqual(2);
        });

    });


    describe("clear()", () => {

        it("does not throw when called on an empty cache", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            expect(() => cache.clear()).not.toThrow();
            expect(cache.size).toEqual(0);
        });


        it("removes all items", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);
            cache.set(barney, 37);

            cache.clear();

            expect(cache.size).toEqual(0);
            expect(cache.has(fred)).toBeFalse();
            expect(cache.has(wilma)).toBeFalse();
            expect(cache.has(barney)).toBeFalse();
            expect(cache.get(fred)).toEqual(NoneOption.get());
            expect(cache.get(wilma)).toEqual(NoneOption.get());
            expect(cache.get(barney)).toEqual(NoneOption.get());
        });


        it("allows inserting new items after clearing", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);
            cache.clear();

            cache.set(barney, 37);
            cache.set(betty, 33);

            expect(cache.size).toEqual(2);
            expect(cache.get(barney)).toEqual(new SomeOption(37));
            expect(cache.get(betty)).toEqual(new SomeOption(33));
            expect(cache.get(fred)).toEqual(NoneOption.get());
            expect(cache.get(wilma)).toEqual(NoneOption.get());
        });

    });


    describe("get()", () => {

        it("returns NoneOption when the key is not present", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            expect(cache.get(fred)).toEqual(NoneOption.get());
        });


        it("returns SomeOption when the key is present", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);
            cache.set(fred, 40);

            expect(cache.get(fred)).toEqual(new SomeOption(40));
        });


        it("treats get() as a use and updates recency", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            cache.set(fred, 40);
            cache.set(wilma, 34);
            expect(cache.get(fred)).toEqual(new SomeOption(40));
            cache.set(barney, 37);

            expect(cache.get(wilma)).toEqual(NoneOption.get());
            expect(cache.get(fred)).toEqual(new SomeOption(40));
            expect(cache.get(barney)).toEqual(new SomeOption(37));
        });


        it("returns the latest value after repeated set and get calls", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);

            cache.set(fred, 40);
            cache.set(wilma, 34);
            cache.set(fred, 41);
            const value = cache.get(fred).throwIfNone();

            expect(value).toEqual(41);
        });

    });


    describe("getOrSet()", () => {

        it("returns existing value and does not call factory", async () => {
            const cache = new LruCache<Person, number>(2, hashPerson);
            cache.set(fred, 40);

            let numFactoryCalls = 0;
            const value = await cache.getOrSet(fred, () => {
                numFactoryCalls += 1;
                return 99;
            });

            expect(value).toEqual(40);
            expect(numFactoryCalls).toEqual(0);
        });


        it("calls factory once, stores value, and returns it when key is missing", async () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            let numFactoryCalls = 0;
            const value = await cache.getOrSet(fred, () => {
                numFactoryCalls += 1;
                return 40;
            });

            expect(value).toEqual(40);
            expect(numFactoryCalls).toEqual(1);
            expect(cache.get(fred)).toEqual(new SomeOption(40));
        });


        it("treats cache hit as a use and updates recency", async () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            cache.set(fred, 40);
            cache.set(wilma, 34);

            // Hit should mark fred as MRU.
            await cache.getOrSet(fred, () => 999);
            cache.set(barney, 37);

            expect(cache.get(wilma)).toEqual(NoneOption.get());
            expect(cache.get(fred)).toEqual(new SomeOption(40));
            expect(cache.get(barney)).toEqual(new SomeOption(37));
        });


        it("respects capacity when inserting missing key", async () => {
            const cache = new LruCache<Person, number>(2, hashPerson);
            cache.set(fred, 40);
            cache.set(wilma, 34);

            const value = await cache.getOrSet(barney, () => 37);

            expect(value).toEqual(37);
            expect(cache.size).toEqual(2);
            expect(cache.get(fred)).toEqual(NoneOption.get());
            expect(cache.get(wilma)).toEqual(new SomeOption(34));
            expect(cache.get(barney)).toEqual(new SomeOption(37));
        });


        it("accepts a factory that returns a promise", async () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            let numFactoryCalls = 0;
            const value = await cache.getOrSet(fred, () => {
                numFactoryCalls += 1;
                return Promise.resolve(40);
            });

            expect(value).toEqual(40);
            expect(numFactoryCalls).toEqual(1);
            expect(cache.get(fred)).toEqual(new SomeOption(40));
        });

    });


    describe("set()", () => {

        it("adds new items and they can be retrieved", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);

            cache.set(fred, 40);
            cache.set(wilma, 34);

            expect(cache.get(fred)).toEqual(new SomeOption(40));
            expect(cache.get(wilma)).toEqual(new SomeOption(34));
        });


        it("updates an existing key's value", () => {
            const cache = new LruCache<Person, number>(3, hashPerson);

            cache.set(fred, 40);
            cache.set(fred, 41);

            expect(cache.get(fred)).toEqual(new SomeOption(41));
            expect(cache.size).toEqual(1);
        });


        it("evicts the least recently used item when capacity is exceeded", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            cache.set(fred, 40);
            cache.set(wilma, 34);
            cache.set(barney, 37);

            expect(cache.get(fred)).toEqual(NoneOption.get());
            expect(cache.get(wilma)).toEqual(new SomeOption(34));
            expect(cache.get(barney)).toEqual(new SomeOption(37));
        });


        it("treats set() on an existing key as a use", () => {
            const cache = new LruCache<Person, number>(2, hashPerson);

            cache.set(fred, 40);
            cache.set(wilma, 34);
            cache.set(fred, 41);
            cache.set(barney, 37);

            expect(cache.get(wilma)).toEqual(NoneOption.get());
            expect(cache.get(fred)).toEqual(new SomeOption(41));
            expect(cache.get(barney)).toEqual(new SomeOption(37));
        });

    });

});
