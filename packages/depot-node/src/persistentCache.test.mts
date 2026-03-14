import { generateUuid } from "@repo/depot/uuid";
import { getIllegalChars, PersistentCache } from "./persistentCache.mjs";
import { tmpDir } from "./specHelpers.test.mjs";
import { Directory } from "./directory.mjs";


describe("PersistentCache", () => {

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
                const illegalChars = getIllegalChars();

                const promises = illegalChars.map((curIllegalChar) => {
                    const name = "foo" + curIllegalChar + "bar";
                    return PersistentCache.create<string>(name, {dir: tmpDir.toString()});
                });

                const inspections = await Promise.allSettled(promises);
                const numRejections = inspections
                .filter((curInspection) => curInspection.status === "rejected")
                .length;

                expect(numRejections).toEqual(illegalChars.length);
            });


            it("rejects when the specified directory does not exist", async () => {
                await expectRejectMessage(
                    () => PersistentCache.create(generateUuid(), {dir: generateUuid()}),
                    /Directory ".+" does not exist\./
                );
            });


            it("creates a PersistentCache instance", async () => {
                const cache = await PersistentCache.create(generateUuid(), {dir: tmpDir.toString()});
                expect(cache).toBeTruthy();
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
                const illegalChars = getIllegalChars();

                for (const curIllegalChar of illegalChars) {
                    const name = "foo" + curIllegalChar + "bar";
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


            it("creates a PersistentCache instance", () => {
                const cacheName = generateUuid();
                const cache = PersistentCache.createSync(cacheName, {dir: tmpDir.toString()});
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

        describe("put()", () => {

            it("will reject when an illegal character appears in the key name", async () => {
                const illegalChars = getIllegalChars();

                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                const promises = illegalChars.map((curIllegalChar) => {
                    return cache.put("foo" + curIllegalChar + "bar", "quux");
                });

                const inspections = await Promise.allSettled(promises);
                const numRejections = inspections
                .filter((curInspection) => curInspection.status === "rejected")
                .length;

                expect(numRejections).toEqual(illegalChars.length);
            });


            it("will store a value and resolve the returned promise", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                await cache.put("key", "value");

                const val = await cache.get("key");
                expect(val).toEqual("value");
            });


            it("overwrites an existing key", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                await cache.put("key", "valueA");
                await cache.put("key", "valueB");

                const val = await cache.get("key");
                expect(val).toEqual("valueB");
            });


            it("will persist values so that another instance can read the value", async () => {
                const cacheName = generateUuid();
                const key = generateUuid();
                const val = generateUuid();

                const cacheA = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                await cacheA.put(key, val);

                const cacheB = await PersistentCache.create<string>(cacheName, {dir: tmpDir.toString()});
                const readVal = await cacheB.get(key);
                expect(readVal).toEqual(val);
            });

        });


        describe("get()", () => {

            it("will reject when the requested key does not exist", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                await expectRejectMessage(() => cache.get(generateUuid()), /No value/);
            });

        });


        describe("delete()", () => {

            it("will remove the key from the cache", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                const key = generateUuid();
                const val = generateUuid();

                await cache.put(key, val);
                expect(await cache.get(key)).toEqual(val);

                await cache.delete(key);
                await expectRejectMessage(() => cache.get(key), /No value/);
            });


            it("does not throw when deleting a key that does not exist", async () => {
                const cache = await PersistentCache.create<string>(generateUuid(), {dir: tmpDir.toString()});
                await expectAsync(cache.delete(generateUuid())).toBeResolved();
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
                    cacheA.put(key1, generateUuid()),
                    cacheA.put(key2, generateUuid()),
                    cacheA.put(key3, generateUuid())
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

                await cache.put(keyA, generateUuid());
                await cache.put(keyB, generateUuid());
                await cache.delete(keyA);

                const keys = await cache.keys();
                expect(keys.length).toEqual(1);
                expect(keys[0]).toEqual(keyB);
            });

        });

    });

});
