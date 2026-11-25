import { PlayerId } from "@repo/mille-bornes-core/ids";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import { whimsicalNames } from "@repo/mille-bornes-core/whimsicalNames";
import { collectingLogger } from "./logger.mjs";
import { parseBearer, SessionRegistry } from "./sessions.mjs";
import { MemorySnapshotStore } from "./snapshotStore.mjs";


const rand = (): number => 0.5;


function name(s: string): PlayerName {
    return PlayerName.tryCreate(s).throwIfFailed();
}


function failSaves(store: MemorySnapshotStore): void {
    store.saveSessions = () => Promise.reject(new Error("disk full"));
}


// Makes each save take a moment, and fails the saves whose 1-based call number
// is listed, so concurrent changes overlap.
function slowSaves(store: MemorySnapshotStore, failing: ReadonlyArray<number> = []): void {
    const save = store.saveSessions.bind(store);
    let calls = 0;
    store.saveSessions = async (records) => {
        const call = ++calls;
        await new Promise((resolve) => { setTimeout(resolve, 5); });
        if (failing.includes(call)) {
            throw new Error("disk full");
        }
        return save(records);
    };
}


async function storedNames(store: MemorySnapshotStore): Promise<Array<string>> {
    return (await store.loadAll()).sessions.map((s) => s.name);
}


describe("SessionRegistry", () => {

    describe("static", () => {

        describe("load()", () => {

            it("restores the sessions an earlier registry saved", async () => {
                const store = new MemorySnapshotStore();
                const first = await SessionRegistry.load(store, rand);
                const made = (await first.create("Ann")).throwIfFailed();

                const second = await SessionRegistry.load(store, rand);

                expect(second.authenticate({ playerId: made.playerId, token: made.token })).toBeTrue();
                expect(second.nameOf(made.playerId)).toEqual(made.name);
            });


            it("starts empty when nothing was saved", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand);

                expect(registry.nameOf(PlayerId.create())).toBeNull();
            });

        });

    });


    describe("instance", () => {

        describe("create()", () => {

            it("issues a valid id, a 32 character token and the trimmed name", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand);

                const made = (await registry.create("  Ann  ")).throwIfFailed();

                expect(PlayerId.tryCreate(made.playerId).succeeded).toBeTrue();
                expect(made.token).toMatch(/^[A-Za-z0-9_-]{32}$/u);
                expect(made.name).toBe(name("Ann"));
                expect(registry.nameOf(made.playerId)).toBe(name("Ann"));
            });


            it("issues a different token each time", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand);

                const a = (await registry.create("Ann")).throwIfFailed();
                const b = (await registry.create("Bob")).throwIfFailed();

                expect(a.token).not.toBe(b.token);
            });


            it("uses the injected token source", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand, {
                    newToken: () => "fixed-token"
                });

                expect((await registry.create("Ann")).throwIfFailed().token).toBe("fixed-token");
            });


            it("picks a whimsical name for null", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand);

                const made = (await registry.create(null)).throwIfFailed();

                expect(whimsicalNames).toContain(made.name);
            });


            it("refuses a blank name, a long name and an invisible character, creating nothing", async () => {
                const store = new MemorySnapshotStore();
                const registry = await SessionRegistry.load(store, rand);

                for (const bad of ["   ", "x".repeat(101), "An​n"]) {
                    const result = await registry.create(bad);

                    expect(result.failed).withContext(bad).toBeTrue();
                    expect(result.failed && result.error).withContext(bad).toMatch(/^A player name /u);
                }
                expect((await store.loadAll()).sessions).toEqual([]);
            });


            it("keeps picking surprise names after the pool would be used up", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand);

                for (let i = 0; i < whimsicalNames.length + 10; i++) {
                    expect((await registry.create(null)).succeeded).withContext(String(i)).toBeTrue();
                }
            });


            it("accepts a 20 character name and refuses a 21 character one", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand);

                expect((await registry.create("x".repeat(20))).succeeded).toBeTrue();
                expect((await registry.create("x".repeat(21))).failed).toBeTrue();
            });


            it("persists two concurrent creates", async () => {
                const store = new MemorySnapshotStore();
                slowSaves(store);
                const registry = await SessionRegistry.load(store, rand);

                const [a, b] = await Promise.all([registry.create("Ann"), registry.create("Bob")]);

                expect(a.succeeded && b.succeeded).toBeTrue();
                expect(await storedNames(store)).toEqual(["Ann", "Bob"]);
            });


            it("never stores a failed create, and keeps a concurrent one", async () => {
                const store = new MemorySnapshotStore();
                slowSaves(store, [1]);
                const registry = await SessionRegistry.load(store, rand);

                const [a, b] = await Promise.all([registry.create("Ann"), registry.create("Bob")]);
                const c = (await registry.create("Cy")).throwIfFailed();

                expect(a.failed).toBeTrue();
                expect(b.succeeded).toBeTrue();
                expect(await storedNames(store)).toEqual(["Bob", "Cy"]);
                expect(registry.authenticate({ playerId: c.playerId, token: c.token })).toBeTrue();
            });


            it("saves every session through the store", async () => {
                const store = new MemorySnapshotStore();
                const registry = await SessionRegistry.load(store, rand);

                await registry.create("Ann");
                await registry.create("Bob");

                expect((await store.loadAll()).sessions.map((s) => s.name)).toEqual([name("Ann"), name("Bob")]);
            });


            it("fails and issues nothing when the session cannot be saved", async () => {
                const store = new MemorySnapshotStore();
                const registry = await SessionRegistry.load(store, rand, { newToken: () => "tok" });
                const ann = (await registry.create("Ann")).throwIfFailed();
                failSaves(store);

                const result = await registry.create("Bob");

                expect(result.failed).toBeTrue();
                expect(result.failed && result.error).toBe("The session could not be saved.");
                // Ann is untouched and the failed session is gone, so a retry works.
                expect(registry.authenticate({ playerId: ann.playerId, token: ann.token })).toBeTrue();
                store.saveSessions = MemorySnapshotStore.prototype.saveSessions.bind(store);
                expect((await registry.create("Bob")).succeeded).toBeTrue();
                expect((await store.loadAll()).sessions.map((s) => s.name)).toEqual([name("Ann"), name("Bob")]);
            });

        });


        describe("rename()", () => {

            it("changes the name and saves it", async () => {
                const store = new MemorySnapshotStore();
                const registry = await SessionRegistry.load(store, rand);
                const made = (await registry.create("Ann")).throwIfFailed();

                const renamed = (await registry.rename(made.playerId, " Annie ")).throwIfFailed();

                expect(renamed).toBe(name("Annie"));
                expect(registry.nameOf(made.playerId)).toBe(name("Annie"));
                expect((await store.loadAll()).sessions[0]?.name).toBe(name("Annie"));
            });


            it("changes nothing for an invalid name", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand);
                const made = (await registry.create("Ann")).throwIfFailed();

                const result = await registry.rename(made.playerId, "   ");

                expect(result.failed).toBeTrue();
                expect(registry.nameOf(made.playerId)).toBe(name("Ann"));
            });


            it("fails for an unknown player", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand);

                const result = await registry.rename(PlayerId.create(), "Ann");

                expect(result.failed).toBeTrue();
            });


            it("ends with the last of two concurrent renames applied and persisted", async () => {
                const store = new MemorySnapshotStore();
                const registry = await SessionRegistry.load(store, rand);
                const made = (await registry.create("Ann")).throwIfFailed();
                slowSaves(store);

                await Promise.all([registry.rename(made.playerId, "One"), registry.rename(made.playerId, "Two")]);

                expect(registry.nameOf(made.playerId)).toBe(name("Two"));
                expect(await storedNames(store)).toEqual(["Two"]);
            });


            it("does not undo a concurrent rename when the first one cannot be saved", async () => {
                const store = new MemorySnapshotStore();
                const registry = await SessionRegistry.load(store, rand);
                const made = (await registry.create("Ann")).throwIfFailed();
                slowSaves(store, [1]);

                const [one, two] = await Promise.all([
                    registry.rename(made.playerId, "One"),
                    registry.rename(made.playerId, "Two")
                ]);

                expect(one.failed).toBeTrue();
                expect(two.succeeded).toBeTrue();
                expect(registry.nameOf(made.playerId)).toBe(name("Two"));
                expect(await storedNames(store)).toEqual(["Two"]);
            });


            it("keeps a concurrent rename that succeeded when the second cannot be saved", async () => {
                const store = new MemorySnapshotStore();
                const registry = await SessionRegistry.load(store, rand);
                const made = (await registry.create("Ann")).throwIfFailed();
                slowSaves(store, [2]);

                await Promise.all([registry.rename(made.playerId, "One"), registry.rename(made.playerId, "Two")]);

                expect(registry.nameOf(made.playerId)).toBe(name("One"));
                expect(await storedNames(store)).toEqual(["One"]);
            });


            it("restores the old name when the change cannot be saved", async () => {
                const store = new MemorySnapshotStore();
                const registry = await SessionRegistry.load(store, rand);
                const made = (await registry.create("Ann")).throwIfFailed();
                failSaves(store);

                const result = await registry.rename(made.playerId, "Annie");

                expect(result.failed).toBeTrue();
                expect(result.failed && result.error).toBe("The new name could not be saved.");
                expect(registry.nameOf(made.playerId)).toBe(name("Ann"));
            });


            it("logs one error, without the token, when the save fails", async () => {
                const store = new MemorySnapshotStore();
                const logger = collectingLogger();
                const options = { newToken: () => "tok", logger };
                const registry = await SessionRegistry.load(store, rand, options);
                const made = (await registry.create("Ann")).throwIfFailed();
                failSaves(store);

                await registry.rename(made.playerId, "Annie");

                const errors = logger.lines.filter((l) => l.startsWith("ERROR"));
                expect(errors.length).toBe(1);
                expect(errors[0]).toContain("disk full");
                expect(errors[0]).not.toContain("tok");
            });

        });


        describe("nameOf()", () => {

            it("is null for an unknown player", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand);

                expect(registry.nameOf(PlayerId.create())).toBeNull();
            });

        });


        describe("authenticate()", () => {

            it("accepts the issued credential", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand);
                const made = (await registry.create("Ann")).throwIfFailed();

                expect(registry.authenticate({ playerId: made.playerId, token: made.token })).toBeTrue();
            });


            it("rejects everything else without throwing", async () => {
                const registry = await SessionRegistry.load(new MemorySnapshotStore(), rand);
                const ann = (await registry.create("Ann")).throwIfFailed();
                const bob = (await registry.create("Bob")).throwIfFailed();
                const sameLength = `${ann.token.slice(0, -1)}${ann.token.endsWith("A") ? "B" : "A"}`;
                const bad = [
                    { playerId: ann.playerId, token: "wrong" },
                    { playerId: ann.playerId, token: sameLength },
                    { playerId: ann.playerId, token: ann.token.slice(0, -1) },
                    { playerId: ann.playerId, token: `${ann.token}x` },
                    { playerId: ann.playerId, token: "é中😀" },
                    { playerId: ann.playerId, token: "" },
                    { playerId: bob.playerId, token: ann.token },
                    { playerId: PlayerId.create(), token: ann.token }
                ];

                for (const credential of bad) {
                    expect(registry.authenticate(credential)).withContext(credential.token).toBeFalse();
                }
            });

        });

    });

});


describe("parseBearer()", () => {

    const id = PlayerId.create();
    const token = "abc_DEF-123";


    it("accepts the exact form", () => {
        expect(parseBearer(`Bearer ${id}.${token}`)).toEqual({ playerId: id, token });
    });


    it("accepts a header of exactly 200 characters and rejects one of 201", () => {
        const prefix = `Bearer ${id}.`;
        const exact = `${prefix}${"a".repeat(200 - prefix.length)}`;

        expect(exact.length).toBe(200);
        expect(parseBearer(exact)).not.toBeNull();
        expect(parseBearer(`${exact}a`)).toBeNull();
    });


    it("rejects anything else", () => {
        const long = `Bearer ${id}.${"a".repeat(200)}`;
        const bad: Array<string | undefined> = [
            undefined,
            "",
            "Bearer",
            "Bearer ",
            `Basic ${id}.${token}`,
            `bearer ${id}.${token}`,
            `Bearer not-a-uuid.${token}`,
            `Bearer ${id}${token}`,
            `Bearer ${id}.`,
            `Bearer ${id}.a.b`,
            `Bearer ${id}.a b`,
            `Bearer  ${id}.${token}`,
            `Bearer ${id}.${token} `,
            `Bearer ${id}.${token} extra`,
            `Bearer ${id}.toéken`,
            long
        ];

        expect(long.length).toBeGreaterThan(200);
        for (const header of bad) {
            expect(parseBearer(header)).withContext(String(header)).toBeNull();
        }
    });

});
