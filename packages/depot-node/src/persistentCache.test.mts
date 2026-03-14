import { generateUuid } from "@repo/depot/uuid";
import { NoneOption, SomeOption } from "@repo/depot/option";
import { hashStringFastSync, type HashString } from "@repo/depot/hash";
import { getIllegalChars, PersistentCache } from "./persistentCache.mjs";
import { tmpDir } from "./specHelpers.test.mjs";
import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";


describe("PersistentCache", () => {

    function getIllegalNames(): Array<string> {
        const names = [
            "",
            " ",
            ".",
            ".."
        ];

        if (process.platform === "win32") {
            names.push(
                "CON",
                "NUL",
                "COM1",
                "LPT1",
                "trailingSpace ",
                "trailingDot."
            );
        }

        return names;
    }

    async function expectRejectMessage(
        operation: () => Promise<unknown>,
        messagePattern: RegExp
    ): Promise<void> {
        try {
            await operation();
            fail("Expected operation to reject");
        }
        catch (err) {
            expect((err as Error).message).toMatch(messagePattern);
        }
    }


    beforeEach(() => {
        tmpDir.emptySync();
    });


    describe("static", () => {

        describe("create()", () => {

            it("rejects when the cache name contains an illegal character", async () => {
                const badNames = getIllegalChars().map((curIllegalChar) => {
                    return "foo" + curIllegalChar + "bar";
                })
                .concat(getIllegalNames());

                const promises = badNames.map((badName) => {
                    return PersistentCache.create<string>(badName, {dir: tmpDir.toString()});
                });

                const inspections = await Promise.allSettled(promises);
                const numRejections = inspections
                .filter((curInspection) => curInspection.status === "rejected")
                .length;

                expect(numRejections).toEqual(badNames.length);
            });


            it("rejects when the specified directory does not exist", async () => {
                await expectRejectMessage(
                    () => PersistentCache.create(generateUuid(), {dir: generateUuid()}),
                    /Directory ".+" does not exist\./
                );
            });


            it("rejects when memoryCapacity is zero", async () => {
                await expectRejectMessage(
                    () => PersistentCache.create(generateUuid(), {dir: tmpDir.toString(), memoryCapacity: 0}),
                    /memoryCapacity must be a positive integer when specified/
                );
            });


            it("rejects when memoryCapacity is negative", async () => {
                await expectRejectMessage(
                    () => PersistentCache.create(generateUuid(), {dir: tmpDir.toString(), memoryCapacity: -1}),
                    /memoryCapacity must be a positive integer when specified/
                );
            });


            it("rejects when memoryCapacity is not an integer", async () => {
                await expectRejectMessage(
                    () => PersistentCache.create(generateUuid(), {dir: tmpDir.toString(), memoryCapacity: 1.5}),
                    /memoryCapacity must be a positive integer when specified/
                );
            });


            it("creates a PersistentCache instance", async () => {
                const cache = await PersistentCache.create(generateUuid(), {dir: tmpDir.toString()});
                expect(cache).toBeTruthy();
            });


            it("uses keyHashFn when memoryCapacity is specified", async () => {
                let numHashCalls = 0;
                const keyHashFn = (key: string): HashString => {
                    numHashCalls += 1;
                    return hashStringFastSync(key);
                };

                const cache = await PersistentCache.create<string>(
                    generateUuid(),
                    {dir: tmpDir.toString(), memoryCapacity: 2, keyHashFn}
                );

                await cache.set("keyA", "valueA");
                expect(numHashCalls).toBeGreaterThan(0);
            });


            it("does not use keyHashFn when memoryCapacity is omitted", async () => {
                const throwingHashFn = (): HashString => {
                    throw new Error("keyHashFn should not be used");
                };

                const cache = await PersistentCache.create<string>(
                    generateUuid(),
                    {dir: tmpDir.toString(), keyHashFn: throwingHashFn}
                );

                await expectAsync(cache.set("key", "value")).toBeResolved();
            });


            it("uses default hash when memoryCapacity is specified and keyHashFn is omitted", async () => {
                const cache = await PersistentCache.create<string>(
                    generateUuid(),
                    {dir: tmpDir.toString(), memoryCapacity: 1}
                );

                await cache.set("keyA", "valueA");
                await cache.set("keyB", "valueB");

                // keyA should have been evicted from memory but remain on disk.
                expect(await cache.has("keyA")).toBeTrue();
            });


            it("puts files in the requested directory", async () => {
                const cacheName = generateUuid();
                const cache = await PersistentCache.create(cacheName, {dir: tmpDir.toString()});
                expect(cache).toBeTruthy();

                const expectedDir = new Directory(tmpDir, cacheName);
                expect(expectedDir.existsSync()).toBeTruthy();
            });

        });


        describe("createSync", () => {

            it("throws when the cache name contains an illegal character", () => {
                const badNames = getIllegalChars().map((curIllegalChar) => {
                    return "foo" + curIllegalChar + "bar";
                })
                .concat(getIllegalNames());

                for (const name of badNames) {
                    expect(() => {
                        PersistentCache.createSync<string>(name, {dir: tmpDir.toString()});
                    }).toThrowError(/Illegal cache name/i);
                }
            });


            it("throws when the specified directory does not exist", () => {
                const cacheName = generateUuid();
                const dataDir = generateUuid();   // Does not exist

                expect(() => {
                    PersistentCache.createSync(cacheName, {dir: dataDir});
                }).toThrowError(/Directory ".+" does not exist./);
            });


            it("throws when memoryCapacity is zero", () => {
                expect(() => {
                    PersistentCache.createSync(generateUuid(), {dir: tmpDir.toString(), memoryCapacity: 0});
                }).toThrowError(/memoryCapacity must be a positive integer when specified/);
            });


            it("throws when memoryCapacity is negative", () => {
                expect(() => {
                    PersistentCache.createSync(generateUuid(), {dir: tmpDir.toString(), memoryCapacity: -1});
                }).toThrowError(/memoryCapacity must be a positive integer when specified/);
            });


            it("throws when memoryCapacity is not an integer", () => {
                expect(() => {
                    PersistentCache.createSync(generateUuid(), {dir: tmpDir.toString(), memoryCapacity: 1.5});
                }).toThrowError(/memoryCapacity must be a positive integer when specified/);
            });


            it("creates a PersistentCache instance", () => {
                const cacheName = generateUuid();
                const cache = PersistentCache.createSync(cacheName, {dir: tmpDir.toString()});
                expect(cache).toBeTruthy();
            });


            it("accepts keyHashFn when memoryCapacity is specified", () => {
                const keyHashFn = (key: string): HashString => hashStringFastSync(key);

                const cache = PersistentCache.createSync(
                    generateUuid(),
                    {dir: tmpDir.toString(), memoryCapacity: 2, keyHashFn}
                );

                expect(cache).toBeTruthy();
            });


            it("puts files in the requested directory", () => {
                const cacheName = generateUuid();
                const cache = PersistentCache.createSync(cacheName, {dir: tmpDir.toString()});
                expect(cache).toBeTruthy();
                const expectedDir = new Directory(tmpDir, cacheName);
                expect(expectedDir.existsSync()).toBeTruthy();
            });

        });

    });


    describe("instance", () => {

        describe("set()", () => {

            it("will reject when an illegal character appears in the key name", async () => {
                const badKeyNames = getIllegalChars().map((curIllegalChar) => {
                    return "foo" + curIllegalChar + "bar";
                })
                .concat(getIllegalNames());

                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                const promises = badKeyNames.map((badKeyName) => {
                    return cache.set(badKeyName, "quux");
                });

                const inspections = await Promise.allSettled(promises);
                const numRejections = inspections
                .filter((curInspection) => curInspection.status === "rejected")
                .length;

                expect(numRejections).toEqual(badKeyNames.length);
            });


            it("will store a value and resolve the returned promise", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                await cache.set("key", "value");

                const opt = await cache.get("key");
                expect(opt).toBeInstanceOf(SomeOption);
                expect((opt as SomeOption<string>).value).toEqual("value");
            });


            it("overwrites an existing key", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                await cache.set("key", "valueA");
                await cache.set("key", "valueB");

                const opt = await cache.get("key");
                expect(opt).toBeInstanceOf(SomeOption);
                expect((opt as SomeOption<string>).value).toEqual("valueB");
            });


            it("will persist values so that another instance can read the value", async () => {
                const cacheName = generateUuid();
                const key = generateUuid();
                const val = generateUuid();

                const cacheA = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                await cacheA.set(key, val);

                const cacheB = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                const opt = await cacheB.get(key);
                expect(opt).toBeInstanceOf(SomeOption);
                expect((opt as SomeOption<string>).value).toEqual(val);
            });

        });


        describe("has()", () => {

            it("returns false for a key that does not exist", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                expect(await cache.has(generateUuid())).toBeFalse();
            });


            it("returns true for a key that exists in memory", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                await cache.set("key", "value");
                expect(await cache.has("key")).toBeTrue();
            });


            it("returns true for an evicted key that still exists on disk", async () => {
                const cache = await PersistentCache.create<string>(
                    generateUuid(),
                    {dir: tmpDir.toString(), memoryCapacity: 1}
                );

                await cache.set("keyA", "valueA");
                await cache.set("keyB", "valueB");

                expect(await cache.has("keyA")).toBeTrue();
            });


            it("returns true for a key that was persisted by another instance", async () => {
                const cacheName = generateUuid();
                const key = generateUuid();

                const cacheA = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                await cacheA.set(key, "value");

                const cacheB = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                expect(await cacheB.has(key)).toBeTrue();
            });


            it("returns false after a key is deleted", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                await cache.set("key", "value");
                await cache.delete("key");
                expect(await cache.has("key")).toBeFalse();
            });

        });


        describe("get()", () => {

            it("returns a NoneOption when the requested key does not exist", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                const opt = await cache.get(generateUuid());
                expect(opt).toBeInstanceOf(NoneOption);
            });


            it("returns NoneOption and deletes the file when persisted JSON is malformed", async () => {
                const cacheName = generateUuid();
                const badKey = generateUuid();

                const cache = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                const cacheDir = new Directory(tmpDir, cacheName);
                const keyFile = new File(cacheDir, badKey + ".json");

                await keyFile.write("{ this is not valid JSON");

                const opt = await cache.get(badKey);
                expect(opt).toBeInstanceOf(NoneOption);
                expect(await keyFile.exists()).toBeUndefined();
            });


            it("returns NoneOption and deletes the file when persisted shape is invalid", async () => {
                const cacheName = generateUuid();
                const badKey = generateUuid();

                const cache = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                const cacheDir = new Directory(tmpDir, cacheName);
                const keyFile = new File(cacheDir, badKey + ".json");

                await keyFile.writeJson({value: "not-payload"});

                const opt = await cache.get(badKey);
                expect(opt).toBeInstanceOf(NoneOption);
                expect(await keyFile.exists()).toBeUndefined();
            });

        });


        describe("getOrSet()", () => {

            it("returns existing value and does not call fallback factory", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                await cache.set("key", "existing");

                let numFactoryCalls = 0;
                const val = await cache.getOrSet("key", () => {
                    numFactoryCalls += 1;
                    return "new";
                });

                expect(val).toEqual("existing");
                expect(numFactoryCalls).toEqual(0);
            });


            it("stores and returns fallback factory value when key is missing", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});

                const val = await cache.getOrSet("key", () => "fallback");

                expect(val).toEqual("fallback");
                const opt = await cache.get("key");
                expect(opt).toBeInstanceOf(SomeOption);
                expect((opt as SomeOption<string>).value).toEqual("fallback");
            });


            it("stores and returns async fallback factory value when key is missing", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});

                let numFactoryCalls = 0;
                const val = await cache.getOrSet("key", () => {
                    numFactoryCalls += 1;
                    return "fallback";
                });

                expect(val).toEqual("fallback");
                expect(numFactoryCalls).toEqual(1);
                const opt = await cache.get("key");
                expect(opt).toBeInstanceOf(SomeOption);
                expect((opt as SomeOption<string>).value).toEqual("fallback");
            });


            it("uses persisted value when key was evicted from bounded memory cache", async () => {
                const cache = await PersistentCache.create<string>(
                    generateUuid(),
                    {dir: tmpDir.toString(), memoryCapacity: 1}
                );

                await cache.set("keyA", "valueA");
                await cache.set("keyB", "valueB");

                let numFactoryCalls = 0;
                const val = await cache.getOrSet("keyA", () => {
                    numFactoryCalls += 1;
                    return "newValue";
                });

                expect(val).toEqual("valueA");
                expect(numFactoryCalls).toEqual(0);
            });

        });


        describe("delete()", () => {

            it("will remove the key from the cache", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                const key = generateUuid();
                const val = generateUuid();

                await cache.set(key, val);
                const optBefore = await cache.get(key);
                expect(optBefore).toBeInstanceOf(SomeOption);

                const didDelete = await cache.delete(key);
                expect(didDelete).toBeTrue();
                const optAfter = await cache.get(key);
                expect(optAfter).toBeInstanceOf(NoneOption);
            });


            it("does not throw when deleting a key that does not exist", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                expect(await cache.delete(generateUuid())).toBeFalse();
            });


            it("returns true when key only exists on disk", async () => {
                const cacheName = generateUuid();
                const key = generateUuid();

                const cacheA = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                await cacheA.set(key, "value");

                const cacheB = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                expect(await cacheB.delete(key)).toBeTrue();
            });

        });


        describe("clear()", () => {

            it("removes all keys from the current cache instance", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});

                await cache.set("keyA", "valueA");
                await cache.set("keyB", "valueB");

                await cache.clear();

                const keys = await cache.keys();
                expect(keys).toEqual([]);

                const optA = await cache.get("keyA");
                const optB = await cache.get("keyB");

                expect(optA).toBeInstanceOf(NoneOption);
                expect(optB).toBeInstanceOf(NoneOption);
            });


            it("removes persisted keys so another instance sees an empty cache", async () => {
                const cacheName = generateUuid();

                const cacheA = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                await cacheA.set("keyA", "valueA");
                await cacheA.set("keyB", "valueB");
                await cacheA.clear();

                const cacheB = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                const keys = await cacheB.keys();
                expect(keys).toEqual([]);
            });


            it("does not throw when called on an empty cache", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                await expectAsync(cache.clear()).toBeResolved();
                expect(await cache.keys()).toEqual([]);
            });


            it("keeps cache usable after clear", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                await cache.set("key", "value");

                await cache.clear();
                await cache.set("key2", "value2");

                const opt = await cache.get("key2");
                expect(opt).toBeInstanceOf(SomeOption);
                expect((opt as SomeOption<string>).value).toEqual("value2");
            });

        });


        describe("keys()", () => {

            it("will enumerate the existing keys", async () => {
                const cacheName = generateUuid();
                const key1 = generateUuid();
                const key2 = generateUuid();
                const key3 = generateUuid();

                const cacheA = await PersistentCache.create(cacheName, {dir: tmpDir.toString()});
                await Promise.all([
                    cacheA.set(key1, generateUuid()),
                    cacheA.set(key2, generateUuid()),
                    cacheA.set(key3, generateUuid())
                ]);

                const cacheB = await PersistentCache.create(cacheName, {dir: tmpDir.toString()});
                const keys = await cacheB.keys();

                expect(keys.length).toEqual(3);
                expect(keys.indexOf(key1)).toBeGreaterThanOrEqual(0);
                expect(keys.indexOf(key2)).toBeGreaterThanOrEqual(0);
                expect(keys.indexOf(key3)).toBeGreaterThanOrEqual(0);
            });


            it("returns an empty array when no keys exist", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});

                const keys = await cache.keys();
                expect(keys).toEqual([]);
            });


            it("does not include deleted keys", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                const keyA = generateUuid();
                const keyB = generateUuid();

                await cache.set(keyA, generateUuid());
                await cache.set(keyB, generateUuid());
                await cache.delete(keyA);

                const keys = await cache.keys();
                expect(keys.length).toEqual(1);
                expect(keys[0]).toEqual(keyB);
            });

        });

    });

});
