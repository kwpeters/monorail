import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { discriminatedResultSchema } from "@repo/depot/schemaUtility";
import { type PlayerCommand } from "@repo/mille-bornes-core/commands";
import { GameId, PlayerId } from "@repo/mille-bornes-core/ids";
import { describeRejection } from "@repo/mille-bornes-core/rejection";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { legalPlays } from "@repo/mille-bornes-core/view";
import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { z } from "zod";
import { defaultTimings } from "./config.mjs";
import { contextFromRequest, createContextFromHeader, type ContextDeps } from "./context.mjs";
import { FakeClock } from "./fakeClock.mjs";
import { Hub } from "./hub.mjs";
import { collectingLogger } from "./logger.mjs";
import { appRouter, t } from "./router.mjs";
import { type Screen } from "./screens.mjs";
import { SessionRegistry } from "./sessions.mjs";
import { MemorySnapshotStore } from "./snapshotStore.mjs";


const createCaller = t.createCallerFactory(appRouter);
type Caller = ReturnType<typeof createCaller>;

const notValid = "Your session is not valid. Please enter your name again.";
const credentialSchema = discriminatedResultSchema(
    z.object({ playerId: z.string(), token: z.string(), name: z.string() }),
    z.string()
);
const voidSchema = discriminatedResultSchema(z.void(), z.string());
const succeeded = { succeeded: true as const, value: undefined };


interface Harness extends ContextDeps {
    readonly clock: FakeClock;
}


interface Member {
    readonly id:     PlayerId;
    readonly token:  string;
    readonly header: string;
    readonly caller: Caller;
    readonly signal: (signal: AbortSignal) => Caller;
}


async function openHarness(): Promise<Harness> {
    const store = new MemorySnapshotStore();
    const rand = seededRandom(7);
    const sessions = await SessionRegistry.load(store, rand);
    const clock = new FakeClock();
    const hub = await Hub.open({
        store, sessions, clock, rand, timings: defaultTimings, logger: collectingLogger()
    });
    return { hub, sessions, clock };
}


// A caller takes its abort signal when it is made, not per call.
function callerFor(h: Harness, header: string | undefined, signal?: AbortSignal): Caller {
    return createCaller(
        createContextFromHeader(h, Option.fromNullable(header)),
        signal ? { signal } : undefined
    );
}


async function signUp(h: Harness, name: string | null): Promise<Member> {
    const wire = await callerFor(h, undefined).session.create({ name });
    const { playerId, token } = credentialSchema.parse(wire).throwIfFailed();
    return {
        id:     PlayerId.tryCreate(playerId).throwIfFailed(),
        token,
        header: `Bearer ${playerId}.${token}`,
        caller: callerFor(h, `Bearer ${playerId}.${token}`),
        signal: (signal) => callerFor(h, `Bearer ${playerId}.${token}`, signal)
    };
}


async function codeOf(p: Promise<unknown>): Promise<{ code: string; message: string } | null> {
    try {
        await p;
        return null;
    }
    catch (e) {
        if (e instanceof TRPCError) {
            return { code: e.code, message: e.message };
        }
        throw e;
    }
}


async function openWatch(
    m:      Member,
    signal: AbortSignal = new AbortController().signal
): Promise<AsyncIterator<Screen>> {
    const watched = await m.signal(signal).watch();
    return watched[Symbol.asyncIterator]();
}


async function nextScreen(it: AsyncIterator<Screen>): Promise<Screen> {
    const r = await it.next();
    if (r.done) {
        throw new Error("The watch ended.");
    }
    return r.value;
}


function playing(s: Screen): Extract<Screen, { kind: "Playing" }> {
    if (s.kind !== "Playing") {
        throw new Error(`Expected Playing but got ${s.kind}.`);
    }
    return s;
}


function waitingId(s: Screen): GameId {
    if (s.kind !== "Waiting") {
        throw new Error(`Expected Waiting but got ${s.kind}.`);
    }
    return s.pending.id;
}


describe("router", () => {

    describe("session", () => {

        describe("create", () => {

            it("returns a credential that createContextFromHeader accepts", async () => {
                const h = await openHarness();
                const ann = await signUp(h, "Ann");
                expect(createContextFromHeader(h, Option.fromNullable(ann.header)).player)
                .toEqual(new SomeOption(ann.id));
                const wrong = Option.fromNullable(`Bearer ${ann.id}.nope`);
                expect(createContextFromHeader(h, wrong).player).toEqual(NoneOption.get());
            });


            it("gives a whimsical name for null", async () => {
                const h = await openHarness();
                const wire = await callerFor(h, undefined).session.create({ name: null });
                const created = credentialSchema.parse(wire).throwIfFailed();
                expect(created.name.length).toBeGreaterThan(0);
                const id = PlayerId.tryCreate(created.playerId).throwIfFailed();
                expect(h.sessions.nameOf(id)).toEqual(new SomeOption(created.name as never));
            });


            it("returns a failed result for a blank name", async () => {
                const h = await openHarness();
                const wire = await callerFor(h, undefined).session.create({ name: "  " });
                expect(wire.succeeded).toBeFalse();
                expect(credentialSchema.parse(wire).failed).toBeTrue();
            });


            it("rejects a name over 200 characters as BAD_REQUEST", async () => {
                const h = await openHarness();
                const failure = await codeOf(
                    callerFor(h, undefined).session.create({ name: "a".repeat(201) })
                );
                expect(failure?.code).toBe("BAD_REQUEST");
            });

        });


        describe("rename and me", () => {

            it("renames the caller and reports the new name", async () => {
                const h = await openHarness();
                const ann = await signUp(h, "Ann");
                const wire = await ann.caller.session.rename({ name: "Anna" });
                expect(voidSchema.parse(wire).succeeded).toBeTrue();
                expect(await ann.caller.session.me()).toEqual({ playerId: ann.id, name: "Anna" });
            });


            it("returns a failed result for a blank name", async () => {
                const h = await openHarness();
                const ann = await signUp(h, "Ann");
                const wire = await ann.caller.session.rename({ name: "" });
                expect(wire.succeeded).toBeFalse();
                expect((await ann.caller.session.me()).name).toBe("Ann");
            });

        });

    });


    describe("authentication", () => {

        it("rejects every procedure but session.create for a hostile credential", async () => {
            const h = await openHarness();
            const ann = await signUp(h, "Ann");
            const bob = await signUp(h, "Bob");
            const someId = PlayerId.create();
            const procedures: Array<[string, (c: Caller) => Promise<unknown>]> = [
                ["session.rename", (c) => c.session.rename({ name: "X" })],
                ["session.me", (c) => c.session.me()],
                ["lobby.createGame", (c) => c.lobby.createGame()],
                ["lobby.join", (c) => c.lobby.join({ gameId: GameId.create() })],
                ["pending.leave", (c) => c.pending.leave()],
                ["pending.cancel", (c) => c.pending.cancel()],
                ["pending.addRobot", (c) => c.pending.addRobot()],
                ["pending.removeSeat", (c) => c.pending.removeSeat({ seat: someId })],
                ["pending.swapSeats", (c) => c.pending.swapSeats({ a: someId, b: someId })],
                ["pending.setLength", (c) => c.pending.setLength({ length: "Quick" })],
                ["pending.start", (c) => c.pending.start()],
                ["game.play", (c) => c.game.play({ type: "CallExtension" })],
                ["game.end", (c) => c.game.end()],
                ["game.leave", (c) => c.game.leave()],
                ["watch", (c) => c.watch()]
            ];
            // A new procedure must be added above.
            const others = Object.keys(appRouter._def.procedures)
            .filter((n) => n !== "session.create");
            expect(procedures.map(([name]) => name).sort()).toEqual(others.sort());
            const headers: Array<string | undefined> = [
                undefined,
                "Bearer",
                `Bearer ${ann.id}.wrong`,
                `Bearer ${bob.id}.${ann.token}`,
                `Bearer not-a-uuid.${ann.token}`,
                `Bearer ${ann.id}.${"a".repeat(10_000)}`,
                `Bearer ${ann.id}`,
                ann.token
            ];
            for (const [name, call] of procedures) {
                for (const header of headers) {
                    const failure = await codeOf(call(callerFor(h, header)));
                    expect(failure).withContext(`${name} with ${header?.slice(0, 20)}`)
                    .toEqual({ code: "UNAUTHORIZED", message: notValid });
                }
            }
        });

    });


    describe("contextFromRequest", () => {

        it("prefers the header and falls back to the connection parameter", async () => {
            const h = await openHarness();
            const ann = await signUp(h, "Ann");
            const bob = await signUp(h, "Bob");
            const both = contextFromRequest(
                h, { authorization: ann.header }, { authorization: bob.header }
            );
            expect(both.player).toEqual(new SomeOption(ann.id));
            expect(contextFromRequest(h, {}, { authorization: bob.header }).player)
            .toEqual(new SomeOption(bob.id));
            expect(contextFromRequest(h, {}, undefined).player).toEqual(NoneOption.get());
            expect(contextFromRequest(h, {}, { authorization: "Bearer x" }).player)
            .toEqual(NoneOption.get());
        });

    });


    describe("input validation", () => {

        it("rejects malformed input as BAD_REQUEST and changes nothing", async () => {
            const h = await openHarness();
            const ann = await signUp(h, "Ann");
            const bob = await signUp(h, "Bob");
            await ann.caller.lobby.createGame();
            const bad = async (p: Promise<unknown>): Promise<void> => {
                expect((await codeOf(p))?.code).toBe("BAD_REQUEST");
            };
            await bad(bob.caller.lobby.join({ gameId: "nope" }));
            await bad(ann.caller.pending.swapSeats({ a: "x", b: ann.id }));
            await bad(ann.caller.pending.removeSeat({ seat: "x" }));
            await bad(ann.caller.pending.setLength({ length: "Huge" as "Quick" }));
            await bad(ann.caller.game.play({ type: "Drive", card: "Roll" }));
            await bad(ann.caller.game.play({ type: "CallExtension", extra: 1 }));
            await bad(ann.caller.game.play({ card: "Roll" }));
            await bad(ann.caller.game.play(null));
            const screen = h.hub.screenFor(ann.id);
            expect(screen.kind === "Waiting" && screen.pending.seats.length === 1).toBeTrue();
            expect(h.hub.screenFor(bob.id).kind).toBe("Lobby");
        });

    });


    describe("failures are results", () => {

        it("returns a failed result for a caller who is not in a game", async () => {
            const h = await openHarness();
            const ann = await signUp(h, "Ann");
            const outcomes = [
                await ann.caller.game.play({ type: "CallExtension" }),
                await ann.caller.game.end(),
                await ann.caller.game.leave(),
                await ann.caller.pending.start(),
                await ann.caller.pending.leave()
            ];
            for (const outcome of outcomes) {
                expect(outcome).toEqual({ succeeded: false, error: "You are not in a game." });
            }
        });

    });


    describe("a game through the router", () => {

        it("goes from creation to a move that the other player sees", async () => {
            const h = await openHarness();
            const ann = await signUp(h, "Ann");
            const bob = await signUp(h, "Bob");
            expect(await ann.caller.lobby.createGame()).toEqual(succeeded);
            const gameId = waitingId(h.hub.screenFor(ann.id));
            expect(await bob.caller.lobby.join({ gameId })).toEqual(succeeded);
            expect(await ann.caller.pending.addRobot()).toEqual(succeeded);
            const abort = new AbortController();
            const annWatch = await openWatch(ann, abort.signal);
            expect((await nextScreen(annWatch)).kind).toBe("Waiting");

            expect(await ann.caller.pending.start()).toEqual(succeeded);
            expect((await nextScreen(annWatch)).kind).toBe("Playing");
            const bobWatch = await openWatch(bob);
            const bobFirst = playing(await nextScreen(bobWatch));
            expect(bobFirst.view.seats.length).toBe(3);

            // Let Ann play until it is Bob's turn (a robot's turn needs time).
            const playsOf = (m: Member): ReadonlyArray<PlayerCommand> => {
                return legalPlays(playing(h.hub.screenFor(m.id)).view);
            };
            for (let i = 0; i < 50 && playsOf(bob).length === 0; ++i) {
                const annPlays = playsOf(ann);
                if (annPlays.length > 0) {
                    expect((await ann.caller.game.play(annPlays[0]!)).succeeded).toBeTrue();
                }
                else {
                    h.clock.advance(1000);
                }
            }
            const bobPlays = playsOf(bob);
            expect(bobPlays.length).toBeGreaterThan(0);
            await nextScreen(annWatch);
            const annHand = playing(h.hub.screenFor(ann.id)).view.me.hand;
            const current = playing(h.hub.screenFor(bob.id)).view.me.name;
            expect(await ann.caller.game.play({ type: "Discard", card: annHand[0]! })).toEqual({
                succeeded: false,
                error:     describeRejection({ reason: "NotYourTurn", current })
            });

            const update = annWatch.next();
            const played = await bob.caller.game.play(bobPlays[0]!);
            expect(voidSchema.parse(played).succeeded).toBeTrue();
            expect(playing((await update).value as Screen).view.seats.length).toBe(3);
            abort.abort();
            expect((await annWatch.next()).done).toBeTrue();
        });

    });


    describe("watch", () => {

        it("ends and closes presence when the signal aborts", async () => {
            const h = await openHarness();
            const ann = await signUp(h, "Ann");
            const abort = new AbortController();
            const it = await openWatch(ann, abort.signal);
            expect((await nextScreen(it)).kind).toBe("Lobby");
            expect(h.hub.watcherCount(ann.id)).toBe(1);
            const next = it.next();
            abort.abort();
            expect((await next).done).toBeTrue();
            expect(h.hub.watcherCount(ann.id)).toBe(0);
        });


        it("closes the hub's watch when the stream is stopped early", async () => {
            const h = await openHarness();
            const ann = await signUp(h, "Ann");
            const it = await openWatch(ann);
            await nextScreen(it);
            expect(h.hub.watcherCount(ann.id)).toBe(1);
            // Suspended at its yield, as when tRPC stops a subscription.
            await it.return?.();
            expect(h.hub.watcherCount(ann.id)).toBe(0);
        });

    });


    describe("errors over HTTP", () => {

        it("hides the details of an unexpected failure", async () => {
            const h = await openHarness();
            const ann = await signUp(h, "Ann");
            const broken = Object.create(h.hub) as Hub;
            broken.endGame = (): never => {
                throw new Error(`secret detail ${ann.token}`);
            };
            const headers = new Headers({ authorization: ann.header });
            headers.set("content-type", "application/json");
            const response = await fetchRequestHandler({
                endpoint: "/trpc",
                req:      new Request("http://localhost/trpc/game.end", {
                    method: "POST",
                    headers
                }),
                router:        appRouter,
                createContext: () => createContextFromHeader(
                    { ...h, hub: broken }, Option.fromNullable(ann.header)
                )
            });
            const text = await response.text();
            expect(response.status).toBe(500);
            expect(text).not.toContain("secret detail");
            expect(text).not.toContain(ann.token);
            expect(text).not.toContain("stack");
        });

    });

});
