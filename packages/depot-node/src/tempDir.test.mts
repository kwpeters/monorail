import * as os from "node:os";
import { createTempDir } from "./tempDir.mjs";
import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";


// These names must be kept in sync with the (private) constants defined in
// tempDir.mts, since this spec pokes at the on-disk structures created by
// that module.
const rootDirName = "depot-node-tempdir";
const propsFileName = "props.json";
const lastCleanupFileName = "last-cleanup.json";
const oneHourMs = 60 * 60 * 1000;


describe("createTempDir()", () => {

    const rootDir = new Directory(os.tmpdir(), rootDirName);

    beforeEach(() => {
        rootDir.emptySync();
    });


    afterAll(() => {
        rootDir.deleteSync();
    });


    it("returns a failed Result when lifetimeMs is 0", async () => {
        const result = await createTempDir("foo", 0);
        expect(result.succeeded).toBeFalse();
    });


    it("returns a failed Result when lifetimeMs is negative", async () => {
        const result = await createTempDir("foo", -1);
        expect(result.succeeded).toBeFalse();
    });


    it("returns a successful Result containing the new directory", async () => {
        const result = await createTempDir("foo", 60_000);
        expect(result.succeeded).toBeTrue();
    });


    it("returns a directory with the exact name requested", async () => {
        const result = await createTempDir("foo", 60_000);
        expect(result.value!.dirName).toEqual("foo");
    });


    it("returns a directory that exists on the filesystem", async () => {
        const result = await createTempDir("foo", 60_000);
        expect(result.value!.existsSync()).toBeDefined();
    });


    it("returns a directory nested within the OS temp directory", async () => {
        const result = await createTempDir("foo", 60_000);
        expect(result.value!.absPath().startsWith(rootDir.absPath())).toBeTrue();
    });


    it("creates a props.json file (within the container directory) recording the expiration time", async () => {
        const beforeMs = Date.now();
        const result = await createTempDir("foo", 60_000);
        const afterMs = Date.now();

        const containerDir = result.value!.parentDir()!;
        const props = await new File(containerDir, propsFileName).readJson<{ expiresAtMs: number; }>();

        expect(props.expiresAtMs).toBeGreaterThanOrEqual(beforeMs + 60_000);
        expect(props.expiresAtMs).toBeLessThanOrEqual(afterMs + 60_000);
    });


    it("creates a separate, uniquely named container directory for each call, even when the same name is requested", async () => {
        const result1 = await createTempDir("foo", 60_000);
        const result2 = await createTempDir("foo", 60_000);

        const containerDir1 = result1.value!.parentDir()!;
        const containerDir2 = result2.value!.parentDir()!;

        expect(containerDir1.equals(containerDir2)).toBeFalse();
        expect(result1.value!.existsSync()).toBeDefined();
        expect(result2.value!.existsSync()).toBeDefined();
    });


    describe("cleanup behavior", () => {

        function writeContainer(name: string, expiresAtMs: number): Directory {
            const containerDir = new Directory(rootDir, `${name}-0000000000`);
            new Directory(containerDir, name).ensureExistsSync();
            new File(containerDir, propsFileName).writeJsonSync({expiresAtMs});
            return containerDir;
        }


        it("deletes expired container directories once the cleanup interval has elapsed", async () => {
            const expiredContainerDir = writeContainer("old", Date.now() - 1000);

            // Make the last cleanup appear to have happened long enough ago
            // that a new sweep is triggered.
            new File(rootDir, lastCleanupFileName).writeJsonSync({lastCleanupMs: Date.now() - oneHourMs - 1});

            await createTempDir("new", 60_000);

            expect(expiredContainerDir.existsSync()).toBeUndefined();
        });


        it("does not delete container directories that have not expired", async () => {
            const activeContainerDir = writeContainer("active", Date.now() + 60_000);

            new File(rootDir, lastCleanupFileName).writeJsonSync({lastCleanupMs: Date.now() - oneHourMs - 1});

            await createTempDir("new", 60_000);

            expect(activeContainerDir.existsSync()).toBeDefined();
        });


        it("does not sweep when the cleanup interval has not yet elapsed", async () => {
            const expiredContainerDir = writeContainer("old", Date.now() - 1000);

            // The last cleanup happened recently, so no sweep should occur.
            new File(rootDir, lastCleanupFileName).writeJsonSync({lastCleanupMs: Date.now()});

            await createTempDir("new", 60_000);

            expect(expiredContainerDir.existsSync()).toBeDefined();
        });


        it("updates the last cleanup timestamp after performing a sweep", async () => {
            new File(rootDir, lastCleanupFileName).writeJsonSync({lastCleanupMs: Date.now() - oneHourMs - 1});

            const beforeMs = Date.now();
            await createTempDir("new", 60_000);
            const afterMs = Date.now();

            const data = await new File(rootDir, lastCleanupFileName).readJson<{ lastCleanupMs: number; }>();
            expect(data.lastCleanupMs).toBeGreaterThanOrEqual(beforeMs);
            expect(data.lastCleanupMs).toBeLessThanOrEqual(afterMs);
        });

    });

});
