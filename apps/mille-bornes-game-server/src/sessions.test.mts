import { PlayerId } from "@repo/mille-bornes-core/ids";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import { whimsicalNames } from "@repo/mille-bornes-core/whimsicalNames";
import { parseBearer, SessionRegistry } from "./sessions.mjs";
import { MemorySnapshotStore } from "./snapshotStore.mjs";


const rand = (): number => 0.5;


function name(s: string): PlayerName {
    return PlayerName.tryCreate(s).throwIfFailed();
}


function failSaves(store: MemorySnapshotStore): void {
    store.saveSessions = () => Promise.reject(new Error("disk full"));
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
