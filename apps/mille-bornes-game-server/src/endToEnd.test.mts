import * as fs from "node:fs";
import * as http from "node:http";
import * as os from "node:os";
import * as path from "node:path";
import { GameId } from "@repo/mille-bornes-core/ids";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { realClock } from "./clock.mjs";
import { type Timings } from "./config.mjs";
import { collectingLogger } from "./logger.mjs";
import { type Screen } from "./screens.mjs";
import {
    connectScriptedPlayer, createScriptedPlayer, type ScriptedPlayer
} from "./scriptedPlayer.mjs";
import { startServer, type RunningServer } from "./startServer.mjs";


const tinyTimings: Timings = {
    hazardWindowMs:    40,
    extensionOfferMs:  80,
    raceOverPauseMs:   40,
    robotDelayMinMs:   1,
    robotDelayMaxMs:   5,
    disconnectGraceMs: 50
};
const gameTimeoutMs = 15_000;
const seatKeys = ["handSize", "id", "isMe", "name", "team"];
const meKeys = ["hand", "id", "name", "team"];
const playingKeys = ["connected", "events", "isOrganizer", "kind", "robots", "timer", "view"];
const viewKeys = [
    "discardTop", "drawPileCount", "gameId", "length", "me", "phase", "raceNumber", "seats",
    "teams", "trip"
];


type Playing = Extract<Screen, { kind: "Playing" }>;


interface TestServer {
    readonly running: RunningServer;
    readonly base:    string;
    readonly logger:  ReturnType<typeof collectingLogger>;
}


const servers: Array<TestServer> = [];
const players: Array<ScriptedPlayer> = [];
const dataDirs: Array<string> = [];


function newDataDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mb-e2e-test-"));
    dataDirs.push(dir);
    return dir;
}


async function serve(dataDir: string = newDataDir(), seed = 1): Promise<TestServer> {
    const logger = collectingLogger();
    const running = await startServer({
        config:    { port: 0, dataDir, webRoot: null, timings: tinyTimings },
        clock:     realClock,
        rand:      seededRandom(seed),
        logger,
        addresses: () => new Map<string, string>()
    });
    const server = { running, base: `http://127.0.0.1:${running.port.toString()}/`, logger };
    servers.push(server);
    return server;
}


async function stop(s: TestServer): Promise<void> {
    servers.splice(servers.indexOf(s), 1);
    await s.running.close();
}


function track(p: ScriptedPlayer): ScriptedPlayer {
    players.push(p);
    return p;
}


async function signUp(s: TestServer, name: string, seed = 1): Promise<ScriptedPlayer> {
    return track(await createScriptedPlayer(s.base, name, seededRandom(seed)));
}


function isPlaying(s: Screen): s is Playing {
    return s.kind === "Playing";
}


function isWaitingWith(seats: number): (s: Screen) => boolean {
    return (s) => s.kind === "Waiting" && s.pending.seats.length === seats;
}


function isGameOver(gameId: GameId): (s: Screen) => boolean {
    return (s) => isPlaying(s) && s.view.gameId === gameId && s.view.phase.kind === "GameOver";
}


function isTurnOf(p: ScriptedPlayer): (s: Screen) => boolean {
    return (s) => {
        return isPlaying(s) && s.view.phase.kind === "Turn" && s.view.phase.player === p.playerId;
    };
}


/**
 * Seats the humans (the first one organizes) and then the robots, and returns
 * the pending game's id.  Humans join before robots are added, because a
 * robot's name avoids only the names already seated.
 */
async function seat(humans: ReadonlyArray<ScriptedPlayer>, robots: number): Promise<GameId> {
    const [organizer, ...others] = humans;
    (await organizer!.createGame()).throwIfFailed();
    const waiting = await organizer!.waitFor(isWaitingWith(1));
    const gameId = waiting.kind === "Waiting" ? waiting.pending.id : GameId.create();
    for (const p of others) {
        (await p.join(gameId)).throwIfFailed();
    }
    for (let i = 0; i < robots; i++) {
        (await organizer!.addRobot()).throwIfFailed();
    }
    await Promise.all(humans.map(async (p) => p.waitFor(isWaitingWith(humans.length + robots))));
    return gameId;
}


/** Fails if any screen shows a player something that is not theirs to see. */
function expectNoLeaks(
    p:         ScriptedPlayer,
    organizer: boolean,
    everyone:  ReadonlyArray<ScriptedPlayer>
): void {
    const tokens = everyone.map((e) => e.authorization.split(".").slice(1).join("."));
    for (const s of p.screens) {
        const json = JSON.stringify(s);
        tokens.forEach((token) => { expect(json).not.toContain(token); });
        const hidesRobots = s.kind === "Lobby" ||
            (!organizer && (s.kind === "Waiting" || s.view.phase.kind !== "GameOver"));
        if (hidesRobots) {
            expect(json).withContext(`${p.name} saw seat kinds`).not.toContain("Robot");
        }
        if (s.kind === "Waiting") {
            expect(s.pending.isOrganizer).toBe(organizer);
        }
        if (s.kind !== "Playing") {
            continue;
        }
        expect(s.isOrganizer).toBe(organizer);
        if (!organizer) {
            expect(s.robots).toBeNull();
        }
        expect(Object.keys(s).sort()).toEqual(playingKeys);
        expect(Object.keys(s.view).sort()).toEqual(viewKeys);
        expect(Object.keys(s.view.me).sort()).toEqual(meKeys);
        expect(s.view.me.id).toBe(p.playerId);
        s.view.seats.forEach((v) => { expect(Object.keys(v).sort()).toEqual(seatKeys); });
        for (const e of s.events) {
            if (e.type === "CardDrawn" && e.player !== p.playerId) {
                expect(e.card).withContext(`${p.name} saw another player's draw`).toBeNull();
            }
        }
    }
}


async function hostPage(s: TestServer): Promise<string> {
    const res = await fetch(`http://localhost:${s.running.port.toString()}/host`);
    expect(res.status).toBe(200);
    return res.text();
}


// Events of one change, as any player sees them: every drawn card hidden.
function batches(p: ScriptedPlayer): Array<unknown> {
    return p.screens
    .filter(isPlaying)
    .map((s) => s.events.map((e) => (e.type === "CardDrawn" ? { ...e, card: null } : e)))
    .filter((events) => events.length > 0);
}


function rawPost(
    s:           TestServer,
    contentType: string,
    body:        string
): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
        let answered = false;
        const req = http.request({
            host:   "127.0.0.1",
            port:   s.running.port,
            method: "POST",
            path:   "/trpc/session.create"
        }, (res) => {
            answered = true;
            const chunks: Array<Buffer> = [];
            res.on("data", (c: Buffer) => { chunks.push(c); });
            res.on("end", () => {
                resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() });
            });
        });
        // The server may answer and close before a large body is all sent; a
        // reset after the answer is fine, one before it is a failure.
        req.on("error", (err: NodeJS.ErrnoException) => {
            const afterAnswer = answered && (err.code === "EPIPE" || err.code === "ECONNRESET");
            if (!afterAnswer) {
                reject(new Error(`POST got ${err.code ?? err.message} before any answer.`));
            }
        });
        req.setTimeout(5000, () => { req.destroy(new Error("No answer within 5 s.")); });
        req.setHeader("content-type", contentType);
        req.end(body);
    });
}


async function delay(ms: number): Promise<void> {
    await new Promise((resolve) => { setTimeout(resolve, ms); });
}


describe("end to end", () => {

    afterEach(async () => {
        players.splice(0).forEach((p) => { p.close(); });
        for (const s of servers.splice(0)) {
            await s.running.close();
        }
        dataDirs.splice(0).forEach((d) => { fs.rmSync(d, { recursive: true, force: true }); });
    });


    // On Windows, Node aborts at exit while a just-closed fetch stream is still
    // being torn down, so let the last connections finish closing.
    afterAll(async () => {
        await delay(100);
    });


    describe("createScriptedPlayer()", () => {

        it("signs up and receives the Lobby over SSE", async () => {
            const s = await serve();
            const ann = await signUp(s, "Ann");
            expect(ann.name).toBe("Ann");
            expect(ann.screens[0]).toEqual({ kind: "Lobby", notice: null, games: [] });
        }, 10_000);

    });


    describe("whole games over HTTP", () => {

        const cases: Array<{ humans: number; robots: number }> = [
            { humans: 2, robots: 0 },
            { humans: 1, robots: 2 },
            { humans: 2, robots: 2 },
            { humans: 3, robots: 3 }
        ];

        for (const { humans, robots } of cases) {
            const seats = humans + robots;
            const title = `plays ${seats.toString()} seats, ${humans.toString()} human, to the end`;
            it(title, async () => {
                const s = await serve(undefined, seats);
                const names = ["Ann", "Bob", "Cat"].slice(0, humans);
                const people = await Promise.all(names.map(async (n, i) => signUp(s, n, i + 1)));
                const gameId = await seat(people, robots);
                people.forEach((p) => { p.autoPlay(); });
                (await people[0]!.start()).throwIfFailed();

                const overs = await Promise.all(people.map(async (p) => {
                    return p.waitFor(isGameOver(gameId), gameTimeoutMs);
                }));
                for (const over of overs) {
                    const view = (over as Playing).view;
                    expect(view.phase.kind === "GameOver" && view.phase.reveal.map((r) => r.id))
                    .toEqual(view.seats.map((v) => v.id));
                }
                people.forEach((p, i) => { expectNoLeaks(p, i === 0, people); });

                for (const p of people) {
                    (await p.leave()).throwIfFailed();
                }
                expect(s.running.hub.adminList()).toEqual([]);
                expect(await hostPage(s)).toContain("No games.");
            }, 20_000);
        }

    });


    describe("restart", () => {

        it("brings back a pending and a running game for the same credentials", async () => {
            const dataDir = newDataDir();
            const first = await serve(dataDir);
            const cat = await signUp(first, "Cat");
            await seat([cat], 1);
            const ann = await signUp(first, "Ann");
            const runningId = await seat([ann], 1);
            (await ann.start()).throwIfFailed();
            // Nothing moves on a human's turn, so the game holds still.
            await ann.waitFor(isTurnOf(ann));
            const annBefore = ann.screens.at(-1) as Playing;
            const catBefore = cat.screens.at(-1)!;

            // Close the clients first, so they cannot reconnect to the new server.
            ann.close();
            cat.close();
            await stop(first);
            const second = await serve(dataDir, 2);
            expect(second.running.port).not.toBe(first.running.port);

            const ann2 = track(await connectScriptedPlayer(second.base, ann.authorization));
            const cat2 = track(await connectScriptedPlayer(second.base, cat.authorization));
            expect([ann2.playerId, ann2.name]).toEqual([ann.playerId, ann.name]);
            expect([cat2.playerId, cat2.name]).toEqual([cat.playerId, cat.name]);
            expect(cat2.screens[0]).toEqual(catBefore);
            const annAfter = ann2.screens[0]!;
            expect(isPlaying(annAfter) && annAfter.view).toEqual(annBefore.view);

            ann2.autoPlay();
            await ann2.waitFor(isGameOver(runningId), gameTimeoutMs);
        }, 20_000);

    });


    describe("reconnect", () => {

        it("starts the new stream at the current screen and replays nothing", async () => {
            const s = await serve(undefined, 3);
            const ann = await signUp(s, "Ann", 1);
            const bob = await signUp(s, "Bob", 2);
            const gameId = await seat([ann, bob], 2);
            ann.autoPlay();
            bob.autoPlay();
            (await ann.start()).throwIfFailed();

            await ann.waitFor(() => ann.screens.filter(isPlaying).length >= 15, gameTimeoutMs);
            ann.close();
            const seenBeforeClose = ann.screens.length;
            await delay(100);
            expect(ann.screens.length).withContext("screens after close").toBe(seenBeforeClose);

            const ann2 = track(await connectScriptedPlayer(s.base, ann.authorization));
            const first = ann2.screens[0]!;
            expect(isPlaying(first) && first.view.gameId).toBe(gameId);
            expect(isPlaying(first) && first.events).toEqual([]);
            ann2.autoPlay();
            await Promise.all([ann2, bob].map(async (p) => {
                return p.waitFor(isGameOver(gameId), gameTimeoutMs);
            }));

            // Every change after the reconnect arrives once, in order: the new
            // stream's events are exactly the tail of what Bob saw.
            const annEvents = batches(ann2);
            const bobEvents = batches(bob);
            expect(annEvents.length).toBeGreaterThan(0);
            expect(annEvents.length).toBeLessThan(bobEvents.length);
            expect(annEvents).toEqual(bobEvents.slice(-annEvents.length));
        }, 20_000);

    });


    describe("damage", () => {

        it("starts despite a corrupt game file and a stale .tmp, and plays", async () => {
            const dataDir = newDataDir();
            const gamesDir = path.join(dataDir, "games");
            fs.mkdirSync(gamesDir, { recursive: true });
            const corrupt = `${GameId.create()}.json`;
            const stale = `${GameId.create()}.json.tmp`;
            fs.writeFileSync(path.join(gamesDir, corrupt), "{ \"format\": 1, ");
            fs.writeFileSync(path.join(gamesDir, stale), "{}");

            const s = await serve(dataDir);
            expect(s.logger.lines.filter((l) => l.startsWith("WARN") && l.includes(corrupt)).length)
            .toBe(1);
            expect(fs.existsSync(path.join(gamesDir, stale))).toBeFalse();
            expect(s.running.hub.adminList()).toEqual([]);

            const ann = await signUp(s, "Ann");
            const gameId = await seat([ann], 1);
            ann.autoPlay();
            (await ann.start()).throwIfFailed();
            await ann.waitFor(isGameOver(gameId), gameTimeoutMs);
        }, 20_000);

    });


    describe("organizer ends the game", () => {

        it("sends every human to the Lobby and never shows the game again", async () => {
            const s = await serve();
            const ann = await signUp(s, "Ann", 1);
            const bob = await signUp(s, "Bob", 2);
            const cat = await signUp(s, "Cat", 3);
            const gameId = await seat([ann, bob, cat], 1);
            ann.autoPlay();
            cat.autoPlay();
            (await ann.start()).throwIfFailed();
            // Bob does not play, so the race cannot end on its own.
            await bob.waitFor(isTurnOf(bob), gameTimeoutMs);

            (await ann.endGame()).throwIfFailed();
            const notice = "The organizer ended the game.";
            const lobbies = await Promise.all([
                // The organizer ended it, so needs no notice.
                ann.waitFor((sc) => sc.kind === "Lobby" && sc.notice === null),
                ...[bob, cat].map(async (p) => {
                    return p.waitFor((sc) => sc.kind === "Lobby" && sc.notice === notice);
                })
            ]);

            const ends = [ann, bob, cat].map((p, i) => p.screens.indexOf(lobbies[i]!));
            await delay(200);
            [ann, bob, cat].forEach((p, i) => {
                const later = p.screens.slice(ends[i]);
                expect(later.some((sc) => isPlaying(sc) && sc.view.gameId === gameId)).toBeFalse();
            });
            expect(s.running.hub.adminList()).toEqual([]);
        }, 20_000);

    });


    describe("garbage", () => {

        it("answers malformed requests and a burst, then plays a game", async () => {
            const s = await serve();
            const malformed = await rawPost(s, "application/json", "{ \"name\": ");
            expect(malformed.status).toBe(400);
            const wrongType = await rawPost(s, "text/plain", JSON.stringify({ name: "Zed" }));
            expect(wrongType.status).toBeGreaterThanOrEqual(400);
            expect(wrongType.status).toBeLessThan(500);
            const megabyte = JSON.stringify({ name: "x".repeat(1 << 20) });
            const huge = await rawPost(s, "application/json", megabyte);
            expect(huge.status).toBe(413);

            const burst = await Promise.all(Array.from({ length: 50 }, async (_, i) => {
                const res = await fetch(`${s.base}trpc/session.create`, {
                    method:  "POST",
                    headers: [["content-type", "application/json"]],
                    body:    JSON.stringify({ name: `Player ${i.toString()}` })
                });
                return { status: res.status, body: await res.text() };
            }));
            expect(burst.map((r) => r.status)).toEqual(burst.map(() => 200));
            expect(new Set(burst.map((r) => r.body)).size).toBe(50);

            const ann = await signUp(s, "Ann");
            const gameId = await seat([ann], 1);
            ann.autoPlay();
            (await ann.start()).throwIfFailed();
            await ann.waitFor(isGameOver(gameId), gameTimeoutMs);
            expect(s.logger.lines.filter((l) => l.startsWith("ERROR"))).toEqual([]);
        }, 20_000);

    });


    describe("soak", () => {

        it("plays 30 four-seat games back to back and leaks nothing", async () => {
            const s = await serve(undefined, 30);
            const ann = await signUp(s, "Ann", 30);
            ann.autoPlay();
            for (let i = 0; i < 30; i++) {
                const gameId = await seat([ann], 3);
                (await ann.start()).throwIfFailed();
                await ann.waitFor(isGameOver(gameId), gameTimeoutMs);
                (await ann.leave()).throwIfFailed();
                await ann.waitFor((sc) => sc.kind === "Lobby");
            }
            expect(s.logger.lines.filter((l) => l.startsWith("ERROR"))).toEqual([]);
            expect(s.running.hub.adminList()).toEqual([]);
        }, 120_000);

    });

});
