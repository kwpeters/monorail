import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FailedResult, type Result } from "@repo/depot/result";
import { chooseCommand } from "@repo/mille-bornes-core/bot";
import { Card } from "@repo/mille-bornes-core/card";
import { type PlayerCommand } from "@repo/mille-bornes-core/commands";
import { GameId, PlayerId } from "@repo/mille-bornes-core/ids";
import { describeRejection } from "@repo/mille-bornes-core/rejection";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { viewFor } from "@repo/mille-bornes-core/view";
import { defaultTimings } from "./config.mjs";
import { FakeClock } from "./fakeClock.mjs";
import { Hub, type HubOptions } from "./hub.mjs";
import { collectingLogger } from "./logger.mjs";
import { type GameRecord } from "./records.mjs";
import { type Screen } from "./screens.mjs";
import { SessionRegistry } from "./sessions.mjs";
import { FileSnapshotStore, MemorySnapshotStore, type SnapshotStore } from "./snapshotStore.mjs";
import { Table } from "./table.mjs";


interface Harness {
    readonly store:    SnapshotStore;
    readonly sessions: SessionRegistry;
    readonly hub:      Hub;
    readonly clock:    FakeClock;
    readonly logger:   ReturnType<typeof collectingLogger>;
}


async function openHub(
    store: SnapshotStore = new MemorySnapshotStore(),
    extra: Pick<HubOptions, "tableFactory"> = {}
): Promise<Harness> {
    const rand = seededRandom(7);
    const sessions = await SessionRegistry.load(store, rand);
    const logger = collectingLogger();
    const clock = new FakeClock();
    const hub = await Hub.open({
        store, sessions, clock, rand, timings: defaultTimings, logger, ...extra
    });
    return { store, sessions, hub, clock, logger };
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


type Playing = Extract<Screen, { kind: "Playing" }>;


function playing(s: Screen): Playing {
    if (s.kind !== "Playing") {
        throw new Error(`Expected Playing but got ${s.kind}.`);
    }
    return s;
}


// The first name organizes and the others join; then `robots` robots are
// added and the game is started.  Returns the humans in that order.
async function startedGame(
    h:      Harness,
    names:  ReadonlyArray<string>,
    robots = 0
): Promise<Array<PlayerId>> {
    const players: Array<PlayerId> = [];
    for (const name of names) {
        players.push(await newPlayer(h, name));
    }
    const organizer = players[0]!;
    (await h.hub.createGame(organizer)).throwIfFailed();
    const id = waiting(h.hub.screenFor(organizer)).id;
    for (const p of players.slice(1)) {
        (await h.hub.join(p, id)).throwIfFailed();
    }
    for (let i = 0; i < robots; ++i) {
        (await h.hub.addRobot(organizer)).throwIfFailed();
    }
    (await h.hub.startGame(organizer)).throwIfFailed();
    return players;
}


// The first human with a move and the move `chooseCommand` picks, if any.
function nextMove(
    h:      Harness,
    humans: ReadonlyArray<PlayerId>,
    rand:   () => number
): { by: PlayerId; cmd: PlayerCommand } | null {
    for (const by of humans) {
        const cmd = chooseCommand(playing(h.hub.screenFor(by)).view, rand);
        if (cmd) {
            return { by, cmd };
        }
    }
    return null;
}


// Plays the humans' moves (advancing the clock when no human has one) until
// `done` holds for the first human's screen.  Returns the number of moves.
async function playUntil(
    h:      Harness,
    humans: ReadonlyArray<PlayerId>,
    done:   (s: Playing, moves: number) => boolean,
    rand = seededRandom(11)
): Promise<number> {
    let moves = 0;
    for (let i = 0; i < 5000; ++i) {
        if (done(playing(h.hub.screenFor(humans[0]!)), moves)) {
            return moves;
        }
        const move = nextMove(h, humans, rand);
        if (move) {
            (await h.hub.play(move.by, move.cmd)).throwIfFailed();
            ++moves;
        }
        else {
            h.clock.advance(500);
        }
    }
    throw new Error("playUntil gave up.");
}


const inWindow = (s: Playing): boolean => s.view.phase.kind === "HazardIncoming";
const isOver = (s: Playing): boolean => s.view.phase.kind === "GameOver";


async function records(h: Harness): Promise<Array<GameRecord>> {
    await h.hub.flush();
    return (await h.store.loadAll()).games.map((g) => g.record);
}


async function runningRecord(h: Harness): Promise<Extract<GameRecord, { state: "Running" }>> {
    const found = (await records(h)).find((r) => r.state === "Running");
    if (found?.state !== "Running") {
        throw new Error("There is no Running record.");
    }
    return found;
}


function eventTypes(s: Screen): Array<string> {
    return playing(s).events.map((e) => e.type);
}


const tooMany = describeRejection({ reason: "TooManyPlayers" });
const notOrganizer = describeRejection({ reason: "NotOrganizer" });
const organizerEnded = "The organizer ended the game.";
const hostEnded = "The game was ended on the host computer.";
const stuckNotice = "Something went wrong with the game, so it was ended.";


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


        describe("startGame()", () => {

            it("fails for a player who is not the organizer", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();

                const r = await h.hub.startGame(bob);

                expect(errorOf(r)).toBe(notOrganizer);
                expect(h.hub.screenFor(bob).kind).toBe("Waiting");
            });


            it("fails with one seat, asking for a robot", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                (await h.hub.createGame(ann)).throwIfFailed();

                const r = await h.hub.startGame(ann);

                expect(errorOf(r)).toBe(
                    describeRejection({ reason: "UnsupportedPlayerCount", count: 1 })
                );
                expect(errorOf(r)).toContain("robot");
                expect(h.hub.screenFor(ann).kind).toBe("Waiting");
            });


            it("fails for a player in no game", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");

                expect(errorOf(await h.hub.startGame(ann))).toBe("You are not in a game.");
            });


            it("shows every player their own hand and saves a Running record", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(ann)).throwIfFailed();
                (await h.hub.join(bob, waiting(h.hub.screenFor(ann)).id)).throwIfFailed();
                const annWatch = watcher(h.hub, ann);
                const bobWatch = watcher(h.hub, bob);
                await nextScreen(annWatch);
                await nextScreen(bobWatch);

                (await h.hub.startGame(ann)).throwIfFailed();

                const record = await runningRecord(h);
                for (const [p, w] of [[ann, annWatch], [bob, bobWatch]] as const) {
                    const screen = playing(await nextScreen(w));
                    expect(screen.view.me.id).toBe(p);
                    expect([6, 7]).toContain(screen.view.me.hand.length);
                    const mine = record.game.players.find((s) => s.seat.id === p);
                    expect(screen.view.me.hand).toEqual(mine!.hand);
                    expect(screen.isOrganizer).toBe(p === ann);
                    expect(h.hub.screenFor(p).kind).toBe("Playing");
                }
                expect(record.organizer).toBe(ann);
                expect(record.seq).toBe(0);
                expect(record.left).toEqual([]);
                annWatch.abort.abort();
                bobWatch.abort.abort();
            });


            it("takes the game out of the Lobby list", async () => {
                const h = await openHub();
                const cy = await newPlayer(h, "Cy");
                const w = watcher(h.hub, cy);
                await nextScreen(w);

                await startedGame(h, ["Ann"], 1);

                // The game appears, and goes when it starts.
                let s = lobby(await nextScreen(w));
                while (s.games.length === 0) {
                    s = lobby(await nextScreen(w));
                }
                while (s.games.length > 0) {
                    s = lobby(await nextScreen(w));
                }
                expect(lobby(h.hub.screenFor(cy)).games).toEqual([]);
                w.abort.abort();
            });


            it("leaks no other hand, no draw pile and no seat kinds", async () => {
                const h = await openHub();
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"], 1);
                const { game } = await runningRecord(h);
                const robot = game.players.find((p) => p.seat.kind === "Robot")!.seat.id;

                for (const viewer of [ann!, bob!]) {
                    const screen = playing(h.hub.screenFor(viewer));
                    const json = JSON.stringify(screen);
                    const mine = new Set<string>(screen.view.me.hand);
                    for (const other of game.players.filter((p) => p.seat.id !== viewer)) {
                        for (const card of other.hand.filter((c) => !mine.has(c))) {
                            expect(json).not.toContain(`"${card}"`);
                        }
                    }
                    expect(json).not.toContain("\"drawPile\"");
                    expect(json.split("\"hand\"").length).toBe(2);
                    expect(json).not.toContain("Robot");
                    expect(screen.robots).toEqual(viewer === ann ? [robot] : null);
                }
            });

        });


        describe("play()", () => {

            it("sends every player one Playing update with their own events", async () => {
                const h = await openHub();
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"]);
                const annWatch = watcher(h.hub, ann!);
                await nextScreen(annWatch);
                const bobWatch = watcher(h.hub, bob!);
                await nextScreen(bobWatch);
                // Bob connecting is shown to Ann.
                expect(playing(await nextScreen(annWatch)).events).toEqual([]);
                const move = nextMove(h, [ann!, bob!], seededRandom(1))!;

                (await h.hub.play(move.by, move.cmd)).throwIfFailed();

                let drawn = 0;
                for (const [p, w] of [[ann!, annWatch], [bob!, bobWatch]] as const) {
                    const screen = playing(await nextScreen(w));
                    expect(screen.view).toEqual(playing(h.hub.screenFor(p)).view);
                    expect(screen.events.length).toBeGreaterThan(0);
                    for (const e of screen.events) {
                        if (e.type === "CardDrawn") {
                            ++drawn;
                            expect(e.card === null).toBe(e.player !== p);
                        }
                    }
                }
                expect(drawn).toBe(2);
                annWatch.abort.abort();
                bobWatch.abort.abort();
            });


            it("refuses an illegal play in plain words and changes nothing", async () => {
                const h = await openHub();
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"]);
                const phase = playing(h.hub.screenFor(ann!)).view.phase;
                const waiter = phase.kind === "Turn" && phase.player === ann ? bob! : ann!;
                const before = [h.hub.screenFor(ann!), h.hub.screenFor(bob!)];

                const r = await h.hub.play(waiter, { type: "Drive", card: Card.dist25 });

                expect(errorOf(r)).toContain("turn");
                expect([h.hub.screenFor(ann!), h.hub.screenFor(bob!)]).toEqual(before);
                expect((await runningRecord(h)).seq).toBe(0);
            });


            it("refuses the same command sent twice and changes nothing", async () => {
                const h = await openHub();
                const players = await startedGame(h, ["Ann", "Bob"]);
                const move = nextMove(h, players, seededRandom(1))!;
                (await h.hub.play(move.by, move.cmd)).throwIfFailed();
                const { seq } = await runningRecord(h);
                const before = h.hub.screenFor(move.by);

                const r = await h.hub.play(move.by, move.cmd);

                expect(errorOf(r)).not.toBe("");
                expect(h.hub.screenFor(move.by)).toEqual(before);
                expect((await runningRecord(h)).seq).toBe(seq);
            });


            it("fails for a player in no game or in a game not started", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                const bob = await newPlayer(h, "Bob");
                (await h.hub.createGame(bob)).throwIfFailed();
                const drive: PlayerCommand = { type: "Drive", card: Card.dist25 };

                expect(errorOf(await h.hub.play(ann, drive))).toBe("You are not in a game.");
                expect(errorOf(await h.hub.play(bob, drive)))
                .toBe("The game has not started yet.");
            });


            it("does not let an outsider play into someone else's game", async () => {
                const h = await openHub();
                const players = await startedGame(h, ["Ann", "Bob"]);
                const carol = await newPlayer(h, "Carol");
                const move = nextMove(h, players, seededRandom(1))!;
                const before = h.hub.screenFor(move.by);

                const r = await h.hub.play(carol, move.cmd);

                expect(errorOf(r)).toBe("You are not in a game.");
                expect(h.hub.screenFor(move.by)).toEqual(before);
            });


            it("saves the latest state after each change", async () => {
                const h = await openHub();
                const players = await startedGame(h, ["Ann", "Bob"]);

                await playUntil(h, players, (_s, moves) => moves === 3);

                const record = await runningRecord(h);
                expect(record.seq).toBeGreaterThanOrEqual(3);
                expect(playing(h.hub.screenFor(players[0]!)).view)
                .toEqual(viewFor(record.game, players[0]!).throwIfFailed());
            });


            it("succeeds and logs one error when the save fails; the move stands", async () => {
                const h = await openHub();
                const players = await startedGame(h, ["Ann", "Bob"]);
                const before = playing(h.hub.screenFor(players[0]!)).view;
                h.store.saveGame = () => Promise.reject(new Error("disk full"));
                const move = nextMove(h, players, seededRandom(1))!;

                const r = await h.hub.play(move.by, move.cmd);

                expect(r.succeeded).toBeTrue();
                expect(playing(h.hub.screenFor(players[0]!)).view).not.toEqual(before);
                const errors = h.logger.lines.filter((l) => l.startsWith("ERROR"));
                expect(errors.length).toBe(1);
                expect(errors[0]).toContain("disk full");
            });


            it("turns a throwing Table into a failed Result", async () => {
                const h = await openHub(undefined, {
                    tableFactory: (o) => {
                        const t = new Table(o);
                        t.submit = (): never => { throw new Error("submit broke"); };
                        return t;
                    }
                });
                const players = await startedGame(h, ["Ann", "Bob"]);
                const move = nextMove(h, players, seededRandom(1))!;

                const r = await h.hub.play(move.by, move.cmd);

                expect(errorOf(r)).toBe("That command could not be played.");
                expect(h.hub.screenFor(move.by).kind).toBe("Playing");
            });


            it("shows nested updates in seq order and saves the newest", async () => {
                let table: Table | undefined;
                let nest: (() => Result<void, string>) | null = null;
                const h = await openHub(undefined, {
                    tableFactory: (o) => {
                        table = new Table({
                            ...o,
                            onUpdate: (u) => {
                                const inner = nest;
                                nest = null;
                                // Nest a change before the hub hears.
                                expect(inner?.().succeeded ?? true).toBeTrue();
                                o.onUpdate(u);
                            }
                        });
                        return table;
                    }
                });
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"]);
                const annWatch = watcher(h.hub, ann!);
                await nextScreen(annWatch);
                const rand = seededRandom(1);
                const first = nextMove(h, [ann!, bob!], rand)!;
                nest = () => {
                    for (const p of [ann!, bob!]) {
                        const cmd = chooseCommand(viewFor(table!.game, p).throwIfFailed(), rand);
                        if (cmd) {
                            return table!.submit(p, cmd);
                        }
                    }
                    return new FailedResult("No second move.");
                };

                (await h.hub.play(first.by, first.cmd)).throwIfFailed();

                expect(nest).toBeNull();
                expect((await runningRecord(h)).seq).toBe(2);
                const shown = playing(await nextScreen(annWatch));
                expect(shown.view).toEqual(playing(h.hub.screenFor(ann!)).view);
                // The next screen is a presence change: nothing stale.
                const bobWatch = watcher(h.hub, bob!);
                await nextScreen(bobWatch);
                const after = playing(await nextScreen(annWatch));
                expect(after.events).toEqual([]);
                expect(after.view).toEqual(shown.view);
                annWatch.abort.abort();
                bobWatch.abort.abort();
            });

        });


        describe("timers", () => {

            it("closes a hazard window after 5,000 ms and shows HazardLanded", async () => {
                const h = await openHub();
                const players = await startedGame(h, ["Ann", "Bob"]);
                await playUntil(h, players, inWindow);
                const w = watcher(h.hub, players[0]!);
                await nextScreen(w);

                h.clock.advance(4999);
                expect(inWindow(playing(h.hub.screenFor(players[0]!)))).toBeTrue();
                h.clock.advance(1);

                expect(eventTypes(await nextScreen(w))).toContain("HazardLanded");
                w.abort.abort();
            });


            it("shows the true time left to a reconnecting watch and adds no timer", async () => {
                const h = await openHub();
                const players = await startedGame(h, ["Ann", "Bob"]);
                await playUntil(h, players, inWindow);
                expect(playing(h.hub.screenFor(players[0]!)).timer)
                .toEqual({ kind: "HazardWindow", remainingMs: 5000 });
                h.clock.advance(1000);
                const pending = h.clock.pendingCount();

                const w = watcher(h.hub, players[1]!);
                const screen = playing(await nextScreen(w));

                expect(screen.timer).toEqual({ kind: "HazardWindow", remainingMs: 4000 });
                expect(screen.events).toEqual([]);
                expect(h.clock.pendingCount()).toBe(pending);
                w.abort.abort();
            });


            it("lets a robot on turn play by itself after its delay", async () => {
                const h = await openHub();
                const [ann] = await startedGame(h, ["Ann"], 1);
                const { game } = await runningRecord(h);
                const robot = game.players.find((p) => p.seat.kind === "Robot")!.seat.id;
                await playUntil(h, [ann!], (s) => {
                    return s.view.phase.kind === "Turn" && s.view.phase.player === robot;
                });
                const w = watcher(h.hub, ann!);
                await nextScreen(w);
                const { seq } = await runningRecord(h);
                const early = await h.hub.play(ann!, { type: "Drive", card: Card.dist25 });
                expect(errorOf(early)).toContain("turn");
                expect((await runningRecord(h)).seq).toBe(seq);

                h.clock.advance(3000);

                const screen = playing(await nextScreen(w));
                expect(screen.events.some((e) => "player" in e && e.player === robot)).toBeTrue();
                w.abort.abort();
            });


            it("plays one human and three robots through to GameOver", async () => {
                const h = await openHub();
                const [ann] = await startedGame(h, ["Ann"], 3);

                await playUntil(h, [ann!], isOver);

                const phase = playing(h.hub.screenFor(ann!)).view.phase;
                expect(phase.kind === "GameOver" ? phase.reveal.map((r) => r.kind) : [])
                .toEqual(jasmine.arrayWithExactContents(["Human", "Robot", "Robot", "Robot"]));
                expect(h.logger.lines.filter((l) => l.startsWith("ERROR"))).toEqual([]);
            });

        });


        describe("presence", () => {

            it("shows a player connected while a watch is open", async () => {
                const h = await openHub();
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"]);
                const annWatch = watcher(h.hub, ann!);
                expect(playing(await nextScreen(annWatch)).connected).toEqual([ann!]);

                const bobWatch = watcher(h.hub, bob!);
                expect(playing(await nextScreen(bobWatch)).connected)
                .toEqual(jasmine.arrayWithExactContents([ann!, bob!]));

                expect(playing(await nextScreen(annWatch)).connected)
                .toEqual(jasmine.arrayWithExactContents([ann!, bob!]));
                annWatch.abort.abort();
                bobWatch.abort.abort();
            });


            it("shows a closed watch as disconnected only after 3,000 ms", async () => {
                const h = await openHub();
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"]);
                const annWatch = watcher(h.hub, ann!);
                await nextScreen(annWatch);
                const bobWatch = watcher(h.hub, bob!);
                await nextScreen(bobWatch);
                expect(playing(await nextScreen(annWatch)).connected).toContain(bob!);
                bobWatch.abort.abort();
                expect((await bobWatch.next()).done).toBeTrue();

                h.clock.advance(2999);
                expect(playing(h.hub.screenFor(ann!)).connected).toContain(bob!);
                h.clock.advance(1);

                expect(playing(await nextScreen(annWatch)).connected).toEqual([ann!]);
                annWatch.abort.abort();
            });


            it("never shows a reconnect within the grace period as disconnected", async () => {
                const h = await openHub();
                const players = await startedGame(h, ["Ann", "Bob"]);
                const [ann, bob] = players;
                const annWatch = watcher(h.hub, ann!);
                await nextScreen(annWatch);
                const first = watcher(h.hub, bob!);
                await nextScreen(first);
                expect(playing(await nextScreen(annWatch)).connected).toContain(bob!);
                first.abort.abort();
                expect((await first.next()).done).toBeTrue();

                h.clock.advance(2000);
                const second = watcher(h.hub, bob!);
                await nextScreen(second);
                h.clock.advance(10000);
                expect(h.clock.pendingCount()).toBe(0);
                const move = nextMove(h, players, seededRandom(1))!;
                (await h.hub.play(move.by, move.cmd)).throwIfFailed();

                // Ann sees the play next, so no presence screen came first.
                const next = playing(await nextScreen(annWatch));
                expect(next.events.length).toBeGreaterThan(0);
                expect(next.connected).toContain(bob!);
                annWatch.abort.abort();
                second.abort.abort();
            });


            it("updates both of a player's watches and keeps them connected", async () => {
                const h = await openHub();
                const players = await startedGame(h, ["Ann", "Bob"]);
                const [ann, bob] = players;
                const tab1 = watcher(h.hub, bob!);
                const tab2 = watcher(h.hub, bob!);
                await nextScreen(tab1);
                await nextScreen(tab2);
                const move = nextMove(h, players, seededRandom(1))!;
                (await h.hub.play(move.by, move.cmd)).throwIfFailed();
                expect(playing(await nextScreen(tab1)).events.length).toBeGreaterThan(0);
                expect(playing(await nextScreen(tab2)).events.length).toBeGreaterThan(0);

                tab1.abort.abort();
                expect((await tab1.next()).done).toBeTrue();
                h.clock.advance(10000);
                expect(playing(h.hub.screenFor(ann!)).connected).toContain(bob!);
                expect(h.clock.pendingCount()).toBe(0);

                tab2.abort.abort();
                expect((await tab2.next()).done).toBeTrue();
                h.clock.advance(3000);
                expect(playing(h.hub.screenFor(ann!)).connected).toEqual([ann!]);
            });


            it("always shows robots as connected", async () => {
                const h = await openHub();
                const [ann] = await startedGame(h, ["Ann"], 2);
                const { game } = await runningRecord(h);

                const connected = playing(h.hub.screenFor(ann!)).connected;

                expect(connected).toEqual(game.players.map((p) => p.seat.id));
            });

        });


        describe("endGame()", () => {

            it("returns everyone to the Lobby and never brings the game back", async () => {
                const h = await openHub();
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"]);
                await playUntil(h, [ann!, bob!], inWindow);
                expect(h.clock.pendingCount()).toBe(1);

                (await h.hub.endGame(ann!)).throwIfFailed();

                expect(lobby(h.hub.screenFor(bob!)).notice).toBe(organizerEnded);
                expect(lobby(h.hub.screenFor(ann!)).notice).toBeNull();
                expect(h.clock.pendingCount()).toBe(0);
                expect(await records(h)).toEqual([]);
                const drive: PlayerCommand = { type: "Drive", card: Card.dist25 };
                expect(errorOf(await h.hub.play(bob!, drive))).toBe("You are not in a game.");
                h.clock.advance(24 * 60 * 60 * 1000);
                expect(h.hub.screenFor(ann!).kind).toBe("Lobby");
                expect(await records(h)).toEqual([]);
                expect(h.hub.adminList()).toEqual([]);
            });


            it("sends watchers to the Lobby with the notice", async () => {
                const h = await openHub();
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"]);
                const w = watcher(h.hub, bob!);
                await nextScreen(w);

                (await h.hub.endGame(ann!)).throwIfFailed();

                expect(lobby(await nextScreen(w)).notice).toBe(organizerEnded);
                w.abort.abort();
            });


            it("fails for a player who is not the organizer", async () => {
                const h = await openHub();
                const [, bob] = await startedGame(h, ["Ann", "Bob"]);

                expect(errorOf(await h.hub.endGame(bob!))).toBe(notOrganizer);
                expect(h.hub.screenFor(bob!).kind).toBe("Playing");
            });

        });


        describe("adminEnd()", () => {

            it("ends a running game for everyone, even mid hazard window", async () => {
                const h = await openHub();
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"]);
                await playUntil(h, [ann!, bob!], inWindow);
                const id = playing(h.hub.screenFor(ann!)).view.gameId;

                (await h.hub.adminEnd(id)).throwIfFailed();

                expect(lobby(h.hub.screenFor(ann!)).notice).toBe(hostEnded);
                expect(lobby(h.hub.screenFor(bob!)).notice).toBe(hostEnded);
                expect(h.clock.pendingCount()).toBe(0);
                h.clock.advance(24 * 60 * 60 * 1000);
                expect(await records(h)).toEqual([]);
                expect(h.hub.screenFor(bob!).kind).toBe("Lobby");
            });


            it("ends a pending game", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                (await h.hub.createGame(ann)).throwIfFailed();

                (await h.hub.adminEnd(waiting(h.hub.screenFor(ann)).id)).throwIfFailed();

                expect(lobby(h.hub.screenFor(ann)).notice).toBe(hostEnded);
                expect(await records(h)).toEqual([]);
            });


            it("fails for an unknown game", async () => {
                const h = await openHub();

                const r = await h.hub.adminEnd(GameId.create());

                expect(errorOf(r)).toBe("There is no such game.");
            });

        });


        describe("leaveFinished()", () => {

            it("fails before GameOver", async () => {
                const h = await openHub();
                const [ann] = await startedGame(h, ["Ann", "Bob"]);

                expect(errorOf(await h.hub.leaveFinished(ann!))).toBe("The game is not over yet.");
                expect(h.hub.screenFor(ann!).kind).toBe("Playing");
            });


            it("returns each player to the Lobby and deletes the game after the last", async () => {
                const h = await openHub();
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"]);
                await playUntil(h, [ann!, bob!], isOver);
                const phase = playing(h.hub.screenFor(bob!)).view.phase;
                expect(phase.kind === "GameOver" ? phase.reveal.map((r) => r.kind) : [])
                .toEqual(["Human", "Human"]);
                const { seq } = await runningRecord(h);
                const late = await h.hub.play(ann!, { type: "Drive", card: Card.dist25 });
                expect(errorOf(late)).not.toBe("");
                expect((await runningRecord(h)).seq).toBe(seq);

                (await h.hub.leaveFinished(ann!)).throwIfFailed();

                expect(lobby(h.hub.screenFor(ann!)).notice).toBeNull();
                expect(isOver(playing(h.hub.screenFor(bob!)))).toBeTrue();
                expect((await runningRecord(h)).left).toEqual([ann!]);
                (await h.hub.createGame(ann!)).throwIfFailed();
                (await h.hub.leaveFinished(bob!)).throwIfFailed();
                expect(h.hub.screenFor(bob!).kind).toBe("Lobby");
                expect((await records(h)).map((r) => r.state)).toEqual(["Pending"]);
            });

        });


        describe("adminList()", () => {

            it("lists pending, running and finished games", async () => {
                const h = await openHub();
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"]);
                await playUntil(h, [ann!, bob!], isOver);
                await startedGame(h, ["Cy"], 1);
                const dee = await newPlayer(h, "Dee");
                (await h.hub.createGame(dee)).throwIfFailed();

                const list = h.hub.adminList();

                expect(list.map((g) => [g.state, g.organizerName, g.seatNames.length, g.phase]))
                .toEqual(jasmine.arrayWithExactContents([
                    ["Finished", "Ann", 2, "GameOver"],
                    ["Running", "Cy", 2, "Turn"],
                    ["Pending", "Dee", 1, "Waiting"]
                ]));
            });

        });


        describe("stuck guard", () => {

            it("quarantines a game whose timer the engine refuses, and goes on", async () => {
                let made = 0;
                const h = await openHub(undefined, {
                    tableFactory: (o) => new Table(made++ === 0 ?
                        { ...o, applySystem: () => new FailedResult({ reason: "WrongPhase" }) } :
                        o)
                });
                const [ann, bob] = await startedGame(h, ["Ann", "Bob"]);
                const others = await startedGame(h, ["Cy", "Dee"]);
                await playUntil(h, [ann!, bob!], inWindow);
                const w = watcher(h.hub, bob!);
                await nextScreen(w);

                h.clock.advance(5000);

                expect(lobby(await nextScreen(w)).notice).toBe(stuckNotice);
                expect(lobby(h.hub.screenFor(ann!)).notice).toBe(stuckNotice);
                expect((await records(h)).length).toBe(1);
                expect(h.logger.lines.some((l) => l.startsWith("ERROR"))).toBeTrue();
                h.clock.advance(24 * 60 * 60 * 1000);
                expect((await records(h)).length).toBe(1);
                expect(h.hub.screenFor(ann!).kind).toBe("Lobby");
                await playUntil(h, others, (_s, moves) => moves === 2);
                w.abort.abort();
            });


            it("ends the game when building a screen throws, and goes on", async () => {
                let broken: Table | null = null;
                const tables: Array<Table> = [];
                const h = await openHub(undefined, {
                    tableFactory: (o) => {
                        const t = new Table(o);
                        const timer = t.timer.bind(t);
                        t.timer = () => {
                            if (t === broken) {
                                throw new Error("timer broke");
                            }
                            return timer();
                        };
                        tables.push(t);
                        return t;
                    }
                });
                const players = await startedGame(h, ["Ann", "Bob"]);
                const others = await startedGame(h, ["Cy", "Dee"]);
                const move = nextMove(h, players, seededRandom(1))!;
                broken = tables[0]!;

                const r = await h.hub.play(move.by, move.cmd);

                expect(errorOf(r)).toBe(stuckNotice);
                for (const p of players) {
                    expect(lobby(h.hub.screenFor(p)).notice).toBe(stuckNotice);
                }
                expect((await records(h)).length).toBe(1);
                expect(h.logger.lines.some((l) => l.includes("timer broke"))).toBeTrue();
                await playUntil(h, others, (_s, moves) => moves === 2);
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


            it("stops every running game's timers and leaves no presence timer", async () => {
                const h = await openHub();
                const players = await startedGame(h, ["Ann", "Bob"]);
                await playUntil(h, players, inWindow);
                const w = watcher(h.hub, players[0]!);
                await nextScreen(w);

                h.hub.dispose();

                expect((await w.next()).done).toBeTrue();
                expect(h.clock.pendingCount()).toBe(0);
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


            it("succeeds and keeps the change when a save fails, and logs one error", async () => {
                const h = await openHub();
                const ann = await newPlayer(h, "Ann");
                h.store.saveGame = () => Promise.reject(new Error("disk full"));

                const r = await h.hub.createGame(ann);

                expect(r.succeeded).toBeTrue();
                expect(h.hub.screenFor(ann).kind).toBe("Waiting");
                expect((await h.hub.addRobot(ann)).succeeded).toBeTrue();
                const errors = h.logger.lines.filter((l) => l.startsWith("ERROR"));
                expect(errors.length).toBe(2);
                expect(errors.every((l) => l.includes("disk full"))).toBeTrue();
            });


            it("restores running games with the same screens and seq", async () => {
                const first = await openHub();
                const players = await startedGame(first, ["Ann", "Bob"]);
                await playUntil(first, players, (_s, moves) => moves === 4);
                const before = players.map((p) => first.hub.screenFor(p));
                const { seq } = await runningRecord(first);
                first.hub.dispose();

                const second = await openHub(first.store);

                expect(players.map((p) => second.hub.screenFor(p))).toEqual(before);
                expect((await runningRecord(second)).seq).toBe(seq);
                const move = nextMove(second, players, seededRandom(1))!;
                (await second.hub.play(move.by, move.cmd)).throwIfFailed();
                expect((await runningRecord(second)).seq).toBe(seq + 1);
            });


            it("restarts a restored hazard window in full", async () => {
                const first = await openHub();
                const players = await startedGame(first, ["Ann", "Bob"]);
                await playUntil(first, players, inWindow);
                first.clock.advance(3000);
                first.hub.dispose();

                const second = await openHub(first.store);

                const ann = players[0]!;
                expect(playing(second.hub.screenFor(ann)).timer?.remainingMs).toBe(5000);
                second.clock.advance(4999);
                expect(inWindow(playing(second.hub.screenFor(ann)))).toBeTrue();
                second.clock.advance(1);
                expect(inWindow(playing(second.hub.screenFor(ann)))).toBeFalse();
            });


            it("restores a finished game, who has left, and waits for the rest", async () => {
                const first = await openHub();
                const [ann, bob] = await startedGame(first, ["Ann", "Bob"]);
                await playUntil(first, [ann!, bob!], isOver);
                (await first.hub.leaveFinished(ann!)).throwIfFailed();
                await first.hub.flush();
                first.hub.dispose();

                const second = await openHub(first.store);

                expect(second.hub.screenFor(ann!).kind).toBe("Lobby");
                expect(isOver(playing(second.hub.screenFor(bob!)))).toBeTrue();
                expect(second.clock.pendingCount()).toBe(0);
                expect(errorOf(await second.hub.endGame(bob!))).toBe(notOrganizer);
                (await second.hub.leaveFinished(bob!)).throwIfFailed();
                expect(await records(second)).toEqual([]);
            });


            it("quarantines a game that cannot be restored and loads the rest", async () => {
                const first = await openHub();
                const [ann] = await startedGame(first, ["Ann"], 1);
                const [cy] = await startedGame(first, ["Cy"], 1);
                const cyGame = playing(first.hub.screenFor(cy!)).view.gameId;
                await first.hub.flush();
                first.hub.dispose();

                const second = await openHub(first.store, {
                    tableFactory: (o) => {
                        if (o.game.config.id === cyGame) {
                            throw new Error("no table today");
                        }
                        return new Table(o);
                    }
                });

                expect(second.hub.screenFor(ann!).kind).toBe("Playing");
                expect(lobby(second.hub.screenFor(cy!)).notice).toBe(stuckNotice);
                expect((await records(second)).length).toBe(1);
                expect(second.logger.lines.some((l) => l.includes("no table today"))).toBeTrue();
            });


            it("skips a damaged Running file and loads the other games", async () => {
                const dir = await fs.mkdtemp(path.join(os.tmpdir(), "hub-test-"));
                try {
                    const store = new FileSnapshotStore(dir, collectingLogger());
                    const first = await openHub(store);
                    const [ann] = await startedGame(first, ["Ann"], 1);
                    await first.hub.flush();
                    first.hub.dispose();
                    const bad = {
                        format:    1,
                        state:     "Running",
                        organizer: ann,
                        game:      { nope: true },
                        seq:       0,
                        left:      []
                    };
                    await fs.writeFile(
                        path.join(dir, "games", `${GameId.create()}.json`), JSON.stringify(bad)
                    );

                    const second = await openHub(store);

                    expect(second.hub.screenFor(ann!).kind).toBe("Playing");
                    expect(second.hub.adminList().length).toBe(1);
                    second.hub.dispose();
                }
                finally {
                    await fs.rm(dir, { recursive: true, force: true });
                }
            });

        });

    });

});
