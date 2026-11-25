import { type Result } from "@repo/depot/result";
import { PlayerId } from "@repo/mille-bornes-core/ids";
import { describeRejection } from "@repo/mille-bornes-core/rejection";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { defaultTimings } from "./config.mjs";
import { FakeClock } from "./fakeClock.mjs";
import { Hub } from "./hub.mjs";
import { collectingLogger } from "./logger.mjs";
import { type Screen } from "./screens.mjs";
import { SessionRegistry } from "./sessions.mjs";
import { MemorySnapshotStore } from "./snapshotStore.mjs";


interface Harness {
    readonly store:    MemorySnapshotStore;
    readonly sessions: SessionRegistry;
    readonly hub:      Hub;
    readonly logger:   ReturnType<typeof collectingLogger>;
}


async function openHub(store = new MemorySnapshotStore()): Promise<Harness> {
    const rand = seededRandom(7);
    const sessions = await SessionRegistry.load(store, rand);
    const logger = collectingLogger();
    const hub = await Hub.open({
        store, sessions, clock: new FakeClock(), rand, timings: defaultTimings, logger
    });
    return { store, sessions, hub, logger };
}


async function newPlayer(h: Harness, name: string): Promise<PlayerId> {
    return (await h.sessions.create(name)).throwIfFailed().playerId;
}


// Makes a watcher whose screens can be awaited one at a time.
function watcher(hub: Hub, player: PlayerId, abort = new AbortController()): {
    next:  () => Promise<IteratorResult<Screen>>;
    abort: AbortController;
} {
    const it = hub.watch(player, abort.signal)[Symbol.asyncIterator]();
    return { next: () => it.next(), abort };
}


async function nextScreen(w: ReturnType<typeof watcher>): Promise<Screen> {
    const r = await w.next();
    if (r.done) {
        throw new Error("The watch ended.");
    }
    return r.value;
}


function errorOf(r: Result<void, string>): string {
    return r.failed ? r.error : "";
}


function waiting(s: Screen): Extract<Screen, { kind: "Waiting" }>["pending"] {
    if (s.kind !== "Waiting") {
        throw new Error(`Expected Waiting but got ${s.kind}.`);
    }
    return s.pending;
}


function lobby(s: Screen): Extract<Screen, { kind: "Lobby" }> {
    if (s.kind !== "Lobby") {
        throw new Error(`Expected Lobby but got ${s.kind}.`);
    }
    return s;
}


const tooMany = describeRejection({ reason: "TooManyPlayers" });
const notOrganizer = describeRejection({ reason: "NotOrganizer" });


describe("Hub", () => {

    describe("instance", () => {

        describe("screenFor()", () => {

            it("is an empty Lobby for a new player", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");

                expect(h.hub.screenFor(ann)).toEqual({ kind: "Lobby", notice: null, games: [] });
            });


            it("is Waiting for the organizer and lists the game for others", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");

                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.addRobot(ann)).throwIfFailed();

                const mine = waiting(h.hub.screenFor(ann));
                expect(mine.seats[0]?.name).toEqual("Ann" as never);
                expect(mine.seats[0]?.isOrganizer).toBeTrue();
                const other = lobby(h.hub.screenFor(bob));
                expect(other.games.length).toBe(1);
                expect(other.games[0]?.organizerName).toEqual("Ann" as never);
                expect(other.games[0]?.seatNames.length).toBe(2);
                expect(JSON.stringify(other)).not.toContain("Robot");
            });


            it("lists pending games oldest first", async () => {
                const h = await openHub();
                for (const name of ["Ann", "Bob", "Cy"]) {
                    const p = await newPlayer(h, name);
                    (await h.hub.createGame(p)).throwIfFailed();
                }
                const dee = await newPlayer(h, "Dee");

                const names = lobby(h.hub.screenFor(dee)).games.map((g) => g.organizerName);

                expect(names).toEqual(["Ann", "Bob", "Cy"] as typeof names);
            });


            it("does not consume a notice", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();
                (await h.hub.removeSeat(ann, bob)).throwIfFailed();

                expect(lobby(h.hub.screenFor(bob)).notice).not.toBeNull();
                expect(lobby(h.hub.screenFor(bob)).notice).not.toBeNull();
            });

        });


        describe("createGame()", () => {

            it("fails for a player with no session", async () => {
                const h = await openHub();
                const stranger = PlayerId.create();

                const r = await h.hub.createGame(stranger);

                expect(r.failed).toBeTrue();
                expect(errorOf(r)).toBe("You need to enter your name first.");
            });


            it("fails for a player who is already in a game", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                (await h.hub.createGame(ann)).throwIfFailed();

                const r = await h.hub.createGame(ann);

                expect(errorOf(r)).toBe("You are already in a game.");
            });

        });


        describe("join()", () => {

            it("seats the player and updates both Waiting screens", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                const gameId = waiting(h.hub.screenFor(ann)).id;
                const annWatch = watcher(h.hub, ann);
                const bobWatch = watcher(h.hub, bob);
                await nextScreen(annWatch);
                expect((await nextScreen(bobWatch)).kind).toBe("Lobby");

                (await h.hub.join(bob, gameId)).throwIfFailed();

                const annsSeats = waiting(await nextScreen(annWatch)).seats;
                expect(annsSeats.map((s) => s.name)).toEqual(["Ann", "Bob"] as never);
                const bobs = waiting(await nextScreen(bobWatch));
                expect(bobs.seats.map((s) => s.name)).toEqual(["Ann", "Bob"] as never);
                expect(bobs.isOrganizer).toBeFalse();
                annWatch.abort.abort();
                bobWatch.abort.abort();
            });


            it("fails for an unknown game", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const other = await newPlayer(h, "Bob");
                (await h.hub.createGame(other)).throwIfFailed();
                const gameId = waiting(h.hub.screenFor(other)).id;
                (await h.hub.cancelPending(other)).throwIfFailed();

                const r = await h.hub.join(ann, gameId);

                expect(errorOf(r)).toBe("That game is no longer open.");
            });


            it("fails when the game is full", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const zed = await newPlayer(h, "Zed");
                (await h.hub.createGame(ann)).throwIfFailed();
                for (let i = 0; i < 5; ++i) {
                    (await h.hub.addRobot(ann)).throwIfFailed();
                }

                const r = await h.hub.join(zed, waiting(h.hub.screenFor(ann)).id);

                expect(errorOf(r)).toBe(tooMany);
                expect(h.hub.screenFor(zed).kind).toBe("Lobby");
            });


            it("fails for a player who is already in a game", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.createGame(bob)).throwIfFailed();

                const r = await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id);

                expect(errorOf(r)).toBe("You are already in a game.");
            });


            it("fails with NameTaken for a name differing in case or spacing", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const loud = await newPlayer(h, "ANN");
                const spaced = await newPlayer(h, " ann ");
                (await h.hub.createGame(ann)).throwIfFailed();
                const gameId = waiting(h.hub.screenFor(ann)).id;

                for (const p of [loud, spaced]) {
                    const r = await h.hub.join(p, gameId);

                    expect(errorOf(r)).toBe(
                        describeRejection({ reason: "NameTaken", name: h.sessions.nameOf(p)! })
                    );
                }
            });

        });


        describe("addRobot()", () => {

            it("adds a whimsical robot name nobody at the table has", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                (await h.hub.createGame(ann)).throwIfFailed();

                for (let i = 0; i < 5; ++i) {
                    (await h.hub.addRobot(ann)).throwIfFailed();
                }

                const names = waiting(h.hub.screenFor(ann)).seats.map((s) => s.name.toLowerCase());
                expect(new Set(names).size).toBe(6);
            });


            it("fails for a player who is not the organizer", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();

                const r = await h.hub.addRobot(bob);

                expect(errorOf(r)).toBe(notOrganizer);
            });


            it("fails for a player in no game", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");

                const r = await h.hub.addRobot(ann);

                expect(errorOf(r)).toBe("You are not in a game.");
            });


            it("fails for a seventh seat", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                (await h.hub.createGame(ann)).throwIfFailed();
                for (let i = 0; i < 5; ++i) {
                    (await h.hub.addRobot(ann)).throwIfFailed();
                }

                const r = await h.hub.addRobot(ann);

                expect(errorOf(r)).toBe(tooMany);
            });


            it("shows the robot's kind to the organizer only", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();
                (await h.hub.addRobot(ann)).throwIfFailed();

                expect(waiting(h.hub.screenFor(ann)).seats.map((s) => s.kind))
                .toEqual(["Human", "Human", "Robot"]);
                expect(waiting(h.hub.screenFor(bob)).seats.map((s) => s.kind))
                .toEqual([null, null, null]);
            });

        });


        describe("removeSeat()", () => {

            it("returns the removed player to the Lobby with a notice shown once", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();
                const bobWatch = watcher(h.hub, bob);
                await nextScreen(bobWatch);

                (await h.hub.removeSeat(ann, bob)).throwIfFailed();

                const removed = lobby(await nextScreen(bobWatch));
                expect(removed.notice).toContain("removed");
                const carol = await newPlayer(h, "Carol");
                (await h.hub.createGame(carol)).throwIfFailed();
                expect(lobby(await nextScreen(bobWatch)).notice).toBeNull();
                bobWatch.abort.abort();
            });


            it("fails for a player who is not the organizer", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                const cy = await newPlayer(h, "Cy");
                (await h.hub.createGame(ann)).throwIfFailed();
                const gameId = waiting(h.hub.screenFor(ann)).id;
                (await h.hub.join(bob, gameId)).throwIfFailed();
                (await h.hub.join(cy, gameId)).throwIfFailed();

                const r = await h.hub.removeSeat(bob, cy);

                expect(errorOf(r)).toBe(notOrganizer);
            });


            it("fails for a seat that is not in the game", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                (await h.hub.createGame(ann)).throwIfFailed();

                const r = await h.hub.removeSeat(ann, PlayerId.create());

                expect(errorOf(r)).toBe(describeRejection({ reason: "NoSuchSeat" }));
            });


            it("fails for a seat in another game", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.createGame(bob)).throwIfFailed();

                const r = await h.hub.removeSeat(ann, bob);

                expect(errorOf(r)).toBe(describeRejection({ reason: "NoSuchSeat" }));
                expect(waiting(h.hub.screenFor(bob)).seats.length).toBe(1);
            });


            it("fails when the organizer removes themselves", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                (await h.hub.createGame(ann)).throwIfFailed();

                const r = await h.hub.removeSeat(ann, ann);

                expect(errorOf(r)).toBe(describeRejection({ reason: "OrganizerCannotLeave" }));
            });


            it("lets a removed player create or join another game at once", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                const cy = await newPlayer(h, "Cy");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.createGame(cy)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();
                (await h.hub.removeSeat(ann, bob)).throwIfFailed();

                (await h.hub.join(bob, waiting(h.hub.screenFor(cy)).id)).throwIfFailed();
                (await h.hub.leavePending(bob)).throwIfFailed();
                (await h.hub.createGame(bob)).throwIfFailed();

                expect(waiting(h.hub.screenFor(bob)).isOrganizer).toBeTrue();
                expect(waiting(h.hub.screenFor(ann)).seats.length).toBe(1);
            });

        });


        describe("leavePending()", () => {

            it("returns the leaver to the Lobby", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();

                (await h.hub.leavePending(bob)).throwIfFailed();

                expect(lobby(h.hub.screenFor(bob)).notice).toBeNull();
                expect(waiting(h.hub.screenFor(ann)).seats.length).toBe(1);
            });


            it("fails for the organizer", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                (await h.hub.createGame(ann)).throwIfFailed();

                const r = await h.hub.leavePending(ann);

                expect(errorOf(r)).toBe(
                    describeRejection({ reason: "OrganizerCannotLeave" })
                );
            });

        });


        describe("cancelPending()", () => {

            it("returns everyone to the Lobby with a notice and removes the snapshot", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();
                await h.hub.flush();
                expect((await h.store.loadAll()).games.length).toBe(1);

                (await h.hub.cancelPending(ann)).throwIfFailed();

                expect(lobby(h.hub.screenFor(ann)).games).toEqual([]);
                expect(lobby(h.hub.screenFor(bob)).notice).not.toBeNull();
                expect((await h.store.loadAll()).games).toEqual([]);
            });


            it("sends watchers to the Lobby with a notice, but not the organizer", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();
                const annWatch = watcher(h.hub, ann);
                const bobWatch = watcher(h.hub, bob);
                expect((await nextScreen(annWatch)).kind).toBe("Waiting");
                expect((await nextScreen(bobWatch)).kind).toBe("Waiting");

                (await h.hub.cancelPending(ann)).throwIfFailed();

                const bobs = lobby(await nextScreen(bobWatch));
                expect(bobs.notice).toContain("cancelled");
                expect(bobs.games).toEqual([]);
                const anns = lobby(await nextScreen(annWatch));
                expect(anns.notice).toBeNull();
                expect(h.hub.screenFor(ann)).toEqual(anns);
                annWatch.abort.abort();
                bobWatch.abort.abort();
            });


            it("fails for a player who is not the organizer", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();

                const r = await h.hub.cancelPending(bob);

                expect(errorOf(r)).toBe(notOrganizer);
                expect(h.hub.screenFor(bob).kind).toBe("Waiting");
            });

        });


        describe("swapSeats()", () => {

            it("shows in every Waiting screen; only the organizer may swap", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();

                const denied = await h.hub.swapSeats(bob, ann, bob);
                (await h.hub.swapSeats(ann, ann, bob)).throwIfFailed();

                expect(errorOf(denied)).toBe(notOrganizer);
                for (const p of [ann, bob]) {
                    expect(waiting(h.hub.screenFor(p)).seats.map((s) => s.name))
                    .toEqual(["Bob", "Ann"] as never);
                }
            });

        });


        describe("setLength()", () => {

            it("shows in every Waiting screen; only the organizer may set it", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();

                const denied = await h.hub.setLength(bob, "Full");
                (await h.hub.setLength(ann, "Full")).throwIfFailed();

                expect(errorOf(denied)).toBe(notOrganizer);
                expect(waiting(h.hub.screenFor(ann)).length).toBe("Full");
                expect(waiting(h.hub.screenFor(bob)).length).toBe("Full");
            });

        });


        describe("watch()", () => {

            it("yields the current screen first and then each later screen", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const w = watcher(h.hub, ann);

                expect(await nextScreen(w)).toEqual({ kind: "Lobby", notice: null, games: [] });
                (await h.hub.createGame(ann)).throwIfFailed();
                expect((await nextScreen(w)).kind).toBe("Waiting");
                (await h.hub.addRobot(ann)).throwIfFailed();
                expect(waiting(await nextScreen(w)).seats.length).toBe(2);
                w.abort.abort();
            });


            it("sends both watchers of one player each screen", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const first = watcher(h.hub, ann);
                const second = watcher(h.hub, ann);
                await nextScreen(first);
                await nextScreen(second);

                (await h.hub.createGame(ann)).throwIfFailed();

                expect((await nextScreen(first)).kind).toBe("Waiting");
                expect((await nextScreen(second)).kind).toBe("Waiting");
                first.abort.abort();
                second.abort.abort();
            });


            it("updates Lobby watchers when a game appears", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                const w = watcher(h.hub, bob);
                await nextScreen(w);

                (await h.hub.createGame(ann)).throwIfFailed();

                expect(lobby(await nextScreen(w)).games.length).toBe(1);
                w.abort.abort();
            });


            it("stops without throwing when aborted, and leaves no listener", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const w = watcher(h.hub, ann);
                await nextScreen(w);
                expect(h.hub.watcherCount(ann)).toBe(1);

                const waitingNext = w.next();
                w.abort.abort();

                expect((await waitingNext).done).toBeTrue();
                expect((await w.next()).done).toBeTrue();
                expect(h.hub.watcherCount(ann)).toBe(0);
            });


            it("ends at once when the signal is already aborted", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const abort = new AbortController();
                abort.abort();

                const w = watcher(h.hub, ann, abort);

                expect((await w.next()).done).toBeTrue();
                expect(h.hub.watcherCount(ann)).toBe(0);
            });


            it("does not lose a change made between watch() and the first next()", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const w = watcher(h.hub, ann);

                (await h.hub.createGame(ann)).throwIfFailed();

                expect((await nextScreen(w)).kind).toBe("Lobby");
                expect((await nextScreen(w)).kind).toBe("Waiting");
                w.abort.abort();
            });


            it("keeps a notice until the player's next watch, then clears it", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();
                (await h.hub.cancelPending(ann)).throwIfFailed();

                const first = watcher(h.hub, bob);
                expect(lobby(await nextScreen(first)).notice).not.toBeNull();
                const second = watcher(h.hub, bob);

                expect(lobby(await nextScreen(second)).notice).toBeNull();
                first.abort.abort();
                second.abort.abort();
            });

            it("closes its listener when the consumer stops after the first screen", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                const abort = new AbortController();

                // What `for await` does on `break`.
                const it = h.hub.watch(ann, abort.signal)[Symbol.asyncIterator]();
                expect(lobby((await it.next()).value as Screen).kind).toBe("Lobby");
                expect(h.hub.watcherCount(ann)).toBe(1);
                await it.return?.();

                expect(h.hub.watcherCount(ann)).toBe(0);
                (await h.hub.createGame(bob)).throwIfFailed();
                expect(h.hub.watcherCount(ann)).toBe(0);
            });


            it("clears a notice only when the screen carrying it is delivered", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();
                (await h.hub.cancelPending(ann)).throwIfFailed();
                const first = watcher(h.hub, bob);

                // Other changes before the first read must not use the notice up.
                const cy = await newPlayer(h, "Cy");
                (await h.hub.createGame(cy)).throwIfFailed();
                await new Promise((resolve) => { setTimeout(resolve, 5); });

                expect(lobby(await nextScreen(first)).notice).not.toBeNull();
                expect(lobby(await nextScreen(first)).notice).toBeNull();
                first.abort.abort();
            });


            it("keeps a notice when the watch ends before delivering it", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();
                (await h.hub.cancelPending(ann)).throwIfFailed();
                const dropped = watcher(h.hub, bob);
                dropped.abort.abort();

                expect((await dropped.next()).done).toBeTrue();

                const next = watcher(h.hub, bob);
                expect(lobby(await nextScreen(next)).notice).not.toBeNull();
                next.abort.abort();
            });

        });


        describe("dispose()", () => {

            it("ends every watch", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const w = watcher(h.hub, ann);
                await nextScreen(w);

                const waitingNext = w.next();
                h.hub.dispose();

                expect((await waitingNext).done).toBeTrue();
                expect(h.hub.watcherCount(ann)).toBe(0);
            });

        });


        describe("persistence", () => {

            it("saves the pending record after each mutation", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.addRobot(ann)).throwIfFailed();
                (await h.hub.setLength(ann, "Full")).throwIfFailed();
                await h.hub.flush();

                const { games } = await h.store.loadAll();

                expect(games.length).toBe(1);
                const record = games[0]?.record;
                expect(record?.state === "Pending" ? record.pending.seats.length : 0).toBe(2);
                expect(record?.state === "Pending" ? record.pending.length : "").toBe("Full");
            });


            it("restores pending games in Hub.open()", async () => {
                const first = await openHub();
                const ann = await newPlayer(first, "Ann");
                const bob = await newPlayer(first, "Bob");
                (await first.hub.createGame(ann)).throwIfFailed();
                (await first.hub.createGame(bob)).throwIfFailed();
                await first.hub.flush();

                const second = await openHub(first.store);

                expect(second.hub.screenFor(ann).kind).toBe("Waiting");
                expect(second.hub.screenFor(bob).kind).toBe("Waiting");
                const carol = await newPlayer(second, "Carol");
                expect(lobby(second.hub.screenFor(carol)).games.length).toBe(2);
            });


            it("fails but keeps the change when a save fails, and logs it", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                h.store.saveGame = () => Promise.reject(new Error("disk full"));

                const r = await h.hub.createGame(ann);

                expect(errorOf(r)).toBe(
                    "Something went wrong saving the game. Please try again."
                );
                expect(h.hub.screenFor(ann).kind).toBe("Waiting");
                const logged = h.logger.lines
                .some((l) => l.startsWith("ERROR") && l.includes("disk full"));
                expect(logged).toBeTrue();
            });

        });

    });

});
