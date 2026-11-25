import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { shuffleDeck } from "@repo/mille-bornes-core/deck";
import { type Seat } from "@repo/mille-bornes-core/game";
import { GameId, PlayerId } from "@repo/mille-bornes-core/ids";
import { applyPendingCommand, beginGame, createPending } from "@repo/mille-bornes-core/pendingGame";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { variantForSeatCount } from "@repo/mille-bornes-core/variant";
import { collectingLogger } from "./logger.mjs";
import { decodeRecord, encodeRecord, type GameRecord, type SessionRecord } from "./records.mjs";
import { FileSnapshotStore, MemorySnapshotStore, type SnapshotStore } from "./snapshotStore.mjs";


function seat(name: string, kind: Seat["kind"] = "Human"): Seat {
    return {
        id:   PlayerId.create(),
        name: PlayerName.tryCreate(name).throwIfFailed(),
        kind
    };
}


const ann = seat("Ann");
const bob = seat("Bob", "Robot");


function pendingRecord(id: GameId = GameId.create()): Extract<GameRecord, { state: "Pending" }> {
    const pending = applyPendingCommand(createPending(id, ann), ann.id, { type: "AddRobot", seat: bob })
    .throwIfFailed();
    return { format: 1, state: "Pending", pending };
}


function runningRecord(id: GameId = GameId.create()): Extract<GameRecord, { state: "Running" }> {
    const { pending } = pendingRecord(id);
    const deck = shuffleDeck(variantForSeatCount(pending.seats.length).throwIfFailed().deck, seededRandom(1));
    const { game } = beginGame(pending, ann.id, deck).throwIfFailed();
    return { format: 1, state: "Running", organizer: ann.id, game, seq: 7, left: [bob.id] };
}


const session: SessionRecord = { playerId: ann.id, token: "secret-token", name: ann.name };


function recordId(r: GameRecord): GameId {
    return r.state === "Pending" ? r.pending.id : r.game.config.id;
}


/** Parses the JSON an encoded record would have on disk. */
function wire(r: GameRecord): Record<string, unknown> {
    return JSON.parse(JSON.stringify(encodeRecord(r))) as Record<string, unknown>;
}


describe("records", () => {

    describe("encodeRecord/decodeRecord", () => {

        it("round-trips a pending record", () => {
            const r = pendingRecord();
            expect(decodeRecord(wire(r)).throwIfFailed()).toEqual(r);
        });


        it("round-trips a running record, including seq and left", () => {
            const r = runningRecord();
            expect(decodeRecord(wire(r)).throwIfFailed()).toEqual(r);
        });


        it("refuses a format other than 1", () => {
            expect(decodeRecord({ ...wire(runningRecord()), format: 2 }).failed).toBeTrue();
        });


        it("refuses an unknown state, an extra property and a non-object", () => {
            expect(decodeRecord({ ...wire(pendingRecord()), state: "Done" }).failed).toBeTrue();
            expect(decodeRecord({ ...wire(pendingRecord()), extra: 1 }).failed).toBeTrue();
            expect(decodeRecord([]).failed).toBeTrue();
            expect(decodeRecord(null).failed).toBeTrue();
        });


        it("refuses a bad organizer, a bad left entry and a bad seq", () => {
            const w = wire(runningRecord());
            expect(decodeRecord({ ...w, organizer: "ann" }).failed).toBeTrue();
            expect(decodeRecord({ ...w, left: ["bob"] }).failed).toBeTrue();
            expect(decodeRecord({ ...w, seq: -1 }).failed).toBeTrue();
            expect(decodeRecord({ ...w, seq: 1.5 }).failed).toBeTrue();
        });


        it("refuses an organizer or a leaver who is not seated, and a duplicated leaver", () => {
            const w = wire(runningRecord());
            expect(decodeRecord({ ...w, organizer: PlayerId.create() }).failed).toBeTrue();
            expect(decodeRecord({ ...w, left: [PlayerId.create()] }).failed).toBeTrue();
            expect(decodeRecord({ ...w, left: [bob.id, bob.id] }).failed).toBeTrue();
        });


        it("refuses a game that breaks an invariant", () => {
            const w = wire(runningRecord());
            const game = w.game as { drawPile: Array<unknown> };
            expect(decodeRecord({ ...w, game: { ...game, drawPile: [...game.drawPile, game.drawPile[0]] } })
            .failed).toBeTrue();
        });

    });

});


interface StoreFixture {
    store:   SnapshotStore;
    cleanup: () => Promise<void>;
}


function sharedCases(name: string, makeStore: () => Promise<StoreFixture>): void {

    describe(name, () => {

        let store: SnapshotStore;
        let cleanup: () => Promise<void>;


        beforeEach(async () => {
            ({ store, cleanup } = await makeStore());
        });


        afterEach(async () => {
            await cleanup();
        });


        it("loads nothing from an empty store", async () => {
            expect(await store.loadAll()).toEqual({ games: [], sessions: [] });
        });


        it("round-trips pending and running records and sessions", async () => {
            const pending = pendingRecord();
            const running = runningRecord();
            await store.saveGame(recordId(pending), pending);
            await store.saveGame(recordId(running), running);
            await store.saveSessions([session]);
            await store.flush();

            const loaded = await store.loadAll();
            expect(loaded.games.length).toBe(2);
            expect(loaded.games.find((g) => g.id === recordId(pending))?.record).toEqual(pending);
            expect(loaded.games.find((g) => g.id === recordId(running))?.record).toEqual(running);
            expect(loaded.sessions).toEqual([session]);
        });


        it("replaces a game on overwrite", async () => {
            const id = GameId.create();
            const first = pendingRecord(id);
            const second = { ...runningRecord(id), seq: 99 };
            await store.saveGame(id, first);
            await store.saveGame(id, second);
            await store.flush();
            expect((await store.loadAll()).games).toEqual([{ id, record: second }]);
        });


        it("leaves the last of a burst of saves", async () => {
            const id = GameId.create();
            const saves = Array.from({ length: 20 }, (_, seq) => {
                return store.saveGame(id, { ...runningRecord(id), seq });
            });
            await Promise.all(saves);
            await store.flush();
            const [loaded] = (await store.loadAll()).games;
            expect(loaded?.record.state === "Running" && loaded.record.seq).toBe(19);
        });


        it("removes a deleted game", async () => {
            const keep = pendingRecord();
            const drop = runningRecord();
            await store.saveGame(recordId(keep), keep);
            await store.saveGame(recordId(drop), drop);
            await store.deleteGame(recordId(drop));
            await store.flush();
            expect((await store.loadAll()).games.map((g) => g.id)).toEqual([recordId(keep)]);
        });


        it("does not fail when deleting a game that was never saved", async () => {
            await expectAsync(store.deleteGame(GameId.create())).toBeResolved();
        });


        it("does not load a quarantined game", async () => {
            const r = runningRecord();
            await store.saveGame(recordId(r), r);
            await store.quarantineGame(recordId(r));
            await store.flush();
            expect((await store.loadAll()).games).toEqual([]);
        });


        it("rejects an id that is not a canonical GameId", async () => {
            const bad = "../evil" as GameId;
            await expectAsync(store.saveGame(bad, pendingRecord())).toBeRejected();
            await expectAsync(store.deleteGame(bad)).toBeRejected();
            await expectAsync(store.quarantineGame(bad)).toBeRejected();
        });

    });

}


async function tempDir(): Promise<string> {
    return fs.mkdtemp(path.join(os.tmpdir(), "mb-snapshots-"));
}


describe("MemorySnapshotStore", () => {

    sharedCases("shared behavior", () => Promise.resolve({
        store:   new MemorySnapshotStore(),
        cleanup: () => Promise.resolve()
    }));

});


describe("FileSnapshotStore", () => {

    sharedCases("shared behavior", async () => {
        const dir = await tempDir();
        return {
            store:   new FileSnapshotStore(dir, collectingLogger()),
            cleanup: () => fs.rm(dir, { recursive: true, force: true })
        };
    });


    describe("files", () => {

        let dir:    string;
        let logger: ReturnType<typeof collectingLogger>;
        let store:  FileSnapshotStore;


        beforeEach(async () => {
            dir = await tempDir();
            logger = collectingLogger();
            store = new FileSnapshotStore(dir, logger);
        });


        afterEach(async () => {
            await fs.rm(dir, { recursive: true, force: true });
        });


        const gameFile = (id: string): string => path.join(dir, "games", `${id}.json`);


        describe("saveGame", () => {

            it("writes games/<id>.json and leaves no .tmp file", async () => {
                const r = pendingRecord();
                await store.saveGame(recordId(r), r);
                await store.flush();
                expect(await fs.readdir(path.join(dir, "games"))).toEqual([`${recordId(r)}.json`]);
            });


            it("coalesces a burst of saves into fewer writes", async () => {
                const id = GameId.create();
                for (let seq = 0; seq < 20; seq++) {
                    void store.saveGame(id, { ...runningRecord(id), seq });
                }
                await store.flush();
                expect(store.writeCount).toBeLessThanOrEqual(2);
            });

        });


        describe("ordering", () => {

            it("leaves no file when a delete follows a save", async () => {
                const r = runningRecord();
                const id = recordId(r);
                await Promise.all([store.saveGame(id, r), store.saveGame(id, r), store.deleteGame(id)]);
                expect(await fs.readdir(path.join(dir, "games"))).toEqual([]);
            });


            it("keeps the file when a save follows a delete", async () => {
                const r = runningRecord();
                const id = recordId(r);
                await Promise.all([store.saveGame(id, r), store.deleteGame(id), store.saveGame(id, r)]);
                expect(await fs.readdir(path.join(dir, "games"))).toEqual([`${id}.json`]);
            });

        });


        describe("quarantine ordering", () => {

            it("runs a quarantine after a running save and before a later save", async () => {
                const id = GameId.create();
                const recA = { ...runningRecord(id), seq: 1 };
                const recB = { ...runningRecord(id), seq: 2 };
                const [, quarantined] = await Promise.allSettled([
                    store.saveGame(id, recA),
                    store.quarantineGame(id),
                    store.saveGame(id, recB)
                ]);
                await store.flush();

                expect(quarantined.status).toBe("fulfilled");
                const read = async (...parts: Array<string>): Promise<unknown> => {
                    return JSON.parse(await fs.readFile(path.join(dir, ...parts), "utf8"));
                };
                expect(decodeRecord(await read("failed", `${id}.json`)).throwIfFailed()).toEqual(recA);
                expect(decodeRecord(await read("games", `${id}.json`)).throwIfFailed()).toEqual(recB);
            });

        });


        describe("write failures", () => {

            it("logs the failure, rejects, and recovers on a later save", async () => {
                const r = pendingRecord();
                const id = recordId(r);
                await fs.writeFile(path.join(dir, "games"), "not a directory");

                await expectAsync(store.saveGame(id, r)).toBeRejected();
                const errors = logger.lines.filter((l) => l.startsWith("ERROR"));
                expect(errors.length).toBe(1);
                expect(errors[0]).toContain(`save of ${id}.json`);
                expect(errors[0]).not.toContain(ann.name);

                await fs.rm(path.join(dir, "games"));
                await store.saveGame(id, r);
                expect((await store.loadAll()).games).toEqual([{ id, record: r }]);
            });

        });


        describe("saveGame with a bad id", () => {

            it("creates nothing in the data directory", async () => {
                await expectAsync(store.saveGame("../evil" as GameId, pendingRecord())).toBeRejected();
                await expectAsync(store.deleteGame("..\\evil" as GameId)).toBeRejected();
                await expectAsync(store.quarantineGame("a/b" as GameId)).toBeRejected();
                await store.flush();
                expect(await fs.readdir(dir)).toEqual([]);
            });

        });


        describe("saveSessions", () => {

            it("writes sessions.json", async () => {
                await store.saveSessions([session]);
                await store.flush();
                expect(JSON.parse(await fs.readFile(path.join(dir, "sessions.json"), "utf8"))).toEqual([session]);
            });

        });


        describe("quarantineGame", () => {

            it("moves the file to failed/", async () => {
                const r = runningRecord();
                await store.saveGame(recordId(r), r);
                await store.quarantineGame(recordId(r));
                expect(await fs.readdir(path.join(dir, "failed"))).toEqual([`${recordId(r)}.json`]);
                expect(await fs.readdir(path.join(dir, "games"))).toEqual([]);
            });

        });


        describe("loadAll", () => {

            it("creates the data directories", async () => {
                await store.loadAll();
                expect(await fs.readdir(dir)).toEqual(["failed", "games"]);
            });


            it("skips damaged files with one warning each and keeps the good games", async () => {
                const good = runningRecord();
                await store.saveGame(recordId(good), good);
                await store.flush();

                const dupeRecord = runningRecord();
                const dupe = wire(dupeRecord);
                const dupeGame = dupe.game as { drawPile: Array<unknown> };
                dupeGame.drawPile.push(dupeGame.drawPile[0]);
                const format2 = pendingRecord();

                const damaged: Array<[string, string]> = [
                    [GameId.create(), "{"],
                    [GameId.create(), "[]"],
                    [recordId(dupeRecord), JSON.stringify(dupe)],
                    [recordId(format2), JSON.stringify({ ...wire(format2), format: 2 })],
                    [GameId.create(), JSON.stringify(wire(pendingRecord()))]
                ];
                for (const [id, text] of damaged) {
                    await fs.writeFile(gameFile(id), text);
                }
                await fs.writeFile(path.join(dir, "games", "notes.txt"), "hello");

                const loaded = await store.loadAll();
                expect(loaded.games).toEqual([{ id: recordId(good), record: good }]);
                expect(logger.lines.filter((l) => l.startsWith("WARN")).length).toBe(6);
            });


            it("loads every good game around entries that cannot be read or removed", async () => {
                const first = runningRecord("00000000-0000-4000-8000-000000000001" as GameId);
                const last = pendingRecord("ffffffff-ffff-4fff-8fff-ffffffffffff" as GameId);
                await store.saveGame(recordId(first), first);
                await store.saveGame(recordId(last), last);
                await store.flush();
                // Sorted between the two good games: a directory named like a game file, and one named .tmp.
                await fs.mkdir(gameFile("80000000-0000-4000-8000-000000000000"));
                await fs.mkdir(path.join(dir, "games", "a.tmp"));

                const loaded = await store.loadAll();
                expect(loaded.games.map((g) => g.id)).toEqual([recordId(first), recordId(last)]);
                const warnings = logger.lines.filter((l) => l.startsWith("WARN"));
                expect(warnings.length).toBe(2);
                expect(warnings.some((w) => w.includes("a.tmp"))).toBeTrue();
                expect(warnings.some((w) => w.includes("80000000-0000-4000-8000-000000000000.json"))).toBeTrue();
            });


            it("skips a running record whose organizer or leaver is not seated", async () => {
                const good = pendingRecord();
                await store.saveGame(recordId(good), good);
                await store.flush();
                for (const left of [[PlayerId.create()], [bob.id, bob.id]]) {
                    const r = runningRecord();
                    await fs.writeFile(gameFile(recordId(r)), JSON.stringify({ ...wire(r), left }));
                }
                const r = runningRecord();
                await fs.writeFile(gameFile(recordId(r)), JSON.stringify({ ...wire(r), organizer: PlayerId.create() }));

                expect((await store.loadAll()).games.map((g) => g.id)).toEqual([recordId(good)]);
                expect(logger.lines.filter((l) => l.startsWith("WARN")).length).toBe(3);
            });


            it("ignores and removes a stale .tmp file", async () => {
                await store.loadAll();
                const tmp = `${gameFile(GameId.create())}.tmp`;
                await fs.writeFile(tmp, "{\"half\":");
                expect((await store.loadAll()).games).toEqual([]);
                expect(await fs.readdir(path.join(dir, "games"))).toEqual([]);
                expect(logger.lines.filter((l) => l.startsWith("WARN"))).toEqual([]);
            });


            it("gives no sessions for a missing sessions.json", async () => {
                expect((await store.loadAll()).sessions).toEqual([]);
                expect(logger.lines).toEqual([]);
            });


            it("keeps the good sessions and warns once per bad record", async () => {
                const bea = { playerId: PlayerId.create(), token: "bea-token", name: ann.name };
                const bad = [
                    { ...session, token: "" },
                    { playerId: "nope", token: "leaky-token", name: "Cy" },
                    "garbage"
                ];
                const file = path.join(dir, "sessions.json");
                await fs.writeFile(file, JSON.stringify([session, ...bad, bea]));

                expect((await store.loadAll()).sessions).toEqual([session, bea]);
                const warnings = logger.lines.filter((l) => l.startsWith("WARN"));
                expect(warnings.length).toBe(3);
                expect(warnings.some((w) => w.includes("leaky-token"))).toBeFalse();
                expect(await fs.readdir(dir)).not.toContain("sessions.json.bad");
            });


            it("moves a torn sessions.json to sessions.json.bad and starts empty", async () => {
                const file = path.join(dir, "sessions.json");
                const torn = `[{"playerId":"${ann.id}","token":"secret-tok`;
                await fs.writeFile(`${file}.bad`, "an older bad file");
                await fs.writeFile(file, torn);

                expect((await store.loadAll()).sessions).toEqual([]);
                expect(await fs.readFile(`${file}.bad`, "utf8")).toBe(torn);
                const warnings = logger.lines.filter((l) => l.startsWith("WARN"));
                expect(warnings.length).toBe(1);
                expect(warnings[0]).not.toContain("secret-tok");

                await store.saveSessions([session]);
                expect(await fs.readFile(`${file}.bad`, "utf8")).toBe(torn);
                expect((await store.loadAll()).sessions).toEqual([session]);
            });


            it("moves a sessions.json that is not a list to sessions.json.bad", async () => {
                const file = path.join(dir, "sessions.json");
                await fs.writeFile(file, JSON.stringify({ sessions: [session] }));

                expect((await store.loadAll()).sessions).toEqual([]);
                expect(await fs.readdir(dir)).toContain("sessions.json.bad");
                expect(await fs.readdir(dir)).not.toContain("sessions.json");
            });

        });

    });

});
