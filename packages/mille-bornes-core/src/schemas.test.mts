import { Card, type DistanceCard } from "./card.mjs";
import { type PlayerCommand } from "./commands.mjs";
import { createDeck, type DeckKind } from "./deck.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import { applyPlayerCommand, createGame } from "./engine.mjs";
import { type Game, type GameConfig } from "./game.mjs";
import { GameId, type PlayerId, type TeamIndex } from "./ids.mjs";
import { createPending, type PendingCommand, type PendingGame } from "./pendingGame.mjs";
import {
    decodeGame, decodePendingGame, encodeGame, encodePendingGame, pendingCommandSchema,
    playerCommandSchema
} from "./schemas.mjs";
import {
    buildGame, oneOnOne, seatFor, threeByTwo, threeSolo, twoByTwo, unlandableHazard
} from "./testHelpers.mjs";


const ann = seatFor("Ann");
const bob = seatFor("Bob");
const team1 = 1 as TeamIndex;
const team2 = 2 as TeamIndex;


type Json = Record<string, unknown>;


function play(g: Game, by: PlayerId, cmd: PlayerCommand): Game {
    return applyPlayerCommand(g, by, cmd).throwIfFailed().game;
}


function rollingAt(...distance: Array<DistanceCard>): DrivingZone {
    return { ...newZone(), status: { kind: "Rolling" }, distance };
}


function six(card: Card): Array<Card> {
    return Array.from({ length: 6 }, () => card);
}


function fresh(config: GameConfig, kind: DeckKind): Game {
    return createGame(config, createDeck(kind)).throwIfFailed().game;
}


function wire(g: Game): Json {
    return JSON.parse(JSON.stringify(encodeGame(g))) as Json;
}


function roundTrip(g: Game): Game {
    return decodeGame(wire(g)).throwIfFailed();
}


/** Ann attacks Bob's team with an Accident in a 4-seat game: HazardIncoming. */
function hazardInFlight(): Game {
    const g = buildGame({
        config: twoByTwo(),
        hands:  [
            [Card.accident, Card.roll, Card.dist25, Card.dist50, Card.dist75, Card.dist100, Card.extraTank],
            [Card.drivingAce, ...Array.from({ length: 5 }, () => Card.roll)],
            six(Card.dist50),
            six(Card.dist75),
        ],
        zones:    [rollingAt(), rollingAt()],
        drawPile: [Card.punctureProof, Card.spareTire, Card.gasoline, Card.repairs],
    });
    return play(g, ann.id, { type: "Attack", card: Card.accident, targetTeam: team1 });
}


/** Bob answers with a Coup Fourré, then plays Puncture Proof. */
function safetiesInPlay(): Game {
    const afterCoupFourre = play(hazardInFlight(), bob.id, { type: "CoupFourre", card: Card.drivingAce });
    return play(afterCoupFourre, bob.id, { type: "PlaySafety", card: Card.punctureProof });
}


/** Ann (2 seats) drives from 650 to 700 and is offered Extension. */
function extensionOffer(config: GameConfig = oneOnOne()): Game {
    const g = buildGame({
        config,
        hands: [
            [Card.dist50, Card.roll, Card.dist25, Card.dist75, Card.repairs, Card.stop, Card.gasoline],
            six(Card.roll),
        ],
        zones:    [rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist50), newZone()],
        drawPile: [Card.spareTire],
    });
    return play(g, ann.id, { type: "Drive", card: Card.dist50 });
}


const validCommands: ReadonlyArray<PlayerCommand> = [
    { type: "Drive", card: Card.dist100 },
    { type: "Attack", card: Card.stop, targetTeam: team2 },
    { type: "Remedy", card: Card.roll },
    { type: "PlaySafety", card: Card.rightOfWay },
    { type: "Discard", card: Card.accident },
    { type: "CoupFourre", card: Card.drivingAce },
    { type: "CallExtension" },
    { type: "DeclineExtension" },
];


const validPendingCommands: ReadonlyArray<PendingCommand> = [
    { type: "AddHuman", seat: bob },
    { type: "AddRobot", seat: seatFor("Robo", "Robot") },
    { type: "RemoveSeat", id: bob.id },
    { type: "SwapSeats", a: ann.id, b: bob.id },
    { type: "SetLength", length: "Full" },
];


/** Every hostile seat, as it might arrive in a command or a snapshot. */
const hostileSeats: ReadonlyArray<[string, unknown]> = [
    ["an uppercase id", { ...bob, id: bob.id.toUpperCase() }],
    ["a non-UUID id", { ...bob, id: "bob" }],
    ["a name that is not normalized", { ...bob, name: "  Bob " }],
    ["an empty name", { ...bob, name: "" }],
    ["an unknown kind", { ...bob, kind: "Alien" }],
    ["an extra property", { ...bob, secret: "x" }],
    ["a missing name", { id: bob.id, kind: "Human" }],
    ["null", null],
];


/** Replaces the value at `path` in a deep copy of `obj`. */
function withValue(obj: unknown, path: ReadonlyArray<string | number>, value: unknown): unknown {
    const copy = structuredClone(obj) as Json;
    let parent: Json = copy;
    for (const key of path.slice(0, -1)) {
        parent = parent[key] as Json;
    }
    parent[path.at(-1)!] = value;
    return copy;
}


function huge(): Array<unknown> {
    // Never stringified or spread: only its length is cheap.
    return new Array(4_294_967_295);
}


function quicklyFails(decode: () => { succeeded: boolean }): void {
    const start = Date.now();
    expect(decode().succeeded).toBeFalse();
    expect(Date.now() - start).toBeLessThan(1000);
}


describe("schemas", () => {

    describe("playerCommandSchema", () => {

        it("accepts one valid example of each command type", () => {
            for (const cmd of validCommands) {
                expect(playerCommandSchema.parse(cmd)).withContext(cmd.type).toEqual(cmd);
            }
        });


        it("rejects malformed commands", () => {
            const hostile: ReadonlyArray<unknown> = [
                { type: "Teleport" },
                { type: "Drive", card: Card.dist100, extra: 1 },
                { type: "CallExtension", extra: 1 },
                { type: "Drive", card: Card.roll },
                { type: "Remedy", card: Card.stop },
                { type: "PlaySafety", card: Card.roll },
                { type: "CoupFourre", card: Card.accident },
                { type: "Attack", card: Card.roll, targetTeam: team1 },
                { type: "Attack", card: Card.stop, targetTeam: 5 },
                { type: "Attack", card: Card.stop, targetTeam: 0.5 },
                { type: "Attack", card: Card.stop },
                { type: "Discard", card: "Banana" },
                { type: "Discard" },
                null,
                [],
                "Drive",
            ];
            for (const cmd of hostile) {
                expect(playerCommandSchema.safeParse(cmd).success).withContext(JSON.stringify(cmd)).toBeFalse();
            }
        });

    });


    describe("pendingCommandSchema", () => {

        it("accepts one valid example of each command type", () => {
            for (const cmd of validPendingCommands) {
                expect(pendingCommandSchema.parse(cmd)).withContext(cmd.type).toEqual(cmd);
            }
        });


        it("rejects malformed commands", () => {
            const hostile: ReadonlyArray<unknown> = [
                { type: "Kick" },
                { type: "SetLength", length: "Full", extra: 1 },
                { type: "SetLength", length: "Endless" },
                { type: "RemoveSeat", id: "bob" },
                { type: "SwapSeats", a: ann.id },
                null,
                [],
            ];
            for (const cmd of hostile) {
                expect(pendingCommandSchema.safeParse(cmd).success).withContext(JSON.stringify(cmd)).toBeFalse();
            }
        });


        it("rejects a seat that PlayerId and PlayerName could not have made", () => {
            for (const [label, seat] of hostileSeats) {
                for (const type of ["AddHuman", "AddRobot"]) {
                    expect(pendingCommandSchema.safeParse({ type, seat }).success)
                    .withContext(`${type} with ${label}`)
                    .toBeFalse();
                }
            }
        });

    });


    describe("decodeGame()", () => {

        it("round-trips a fresh game of each seat count", () => {
            const configs: ReadonlyArray<[GameConfig, DeckKind]> = [
                [oneOnOne(), "Reduced"],
                [threeSolo(), "Reduced"],
                [twoByTwo(), "Standard"],
                [threeByTwo(), "Standard"],
            ];
            for (const [config, kind] of configs) {
                const g = fresh(config, kind);
                expect(roundTrip(g)).withContext(`${config.teams.flat().length} seats`).toEqual(g);
            }
        });


        it("round-trips mid-game states", () => {
            const offer = extensionOffer();
            const called = play(offer, ann.id, { type: "CallExtension" });
            const raceOver = play(offer, ann.id, { type: "DeclineExtension" });
            const gameOver = play(extensionOffer({ ...oneOnOne(), length: "Quick" }), ann.id, {
                type: "DeclineExtension",
            });
            const safeties = safetiesInPlay();
            const states: ReadonlyArray<[string, Game]> = [
                ["HazardIncoming", hazardInFlight()],
                ["safeties", safeties],
                ["ExtensionOffer", offer],
                ["Called", called],
                ["RaceOver", raceOver],
                ["GameOver", gameOver],
            ];
            expect(safeties.teams[1]!.zone.safeties).toEqual([
                { card: Card.drivingAce, coupFourre: true },
                { card: Card.punctureProof, coupFourre: false },
            ]);
            expect(called.extension.kind).toBe("Called");
            expect(raceOver.phase.kind).toBe("RaceOver");
            expect(gameOver.phase.kind).toBe("GameOver");
            for (const [label, g] of states) {
                expect(roundTrip(g)).withContext(label).toEqual(g);
            }
        });


        it("encodes to a plain JSON value that does not share the game's objects", () => {
            const g = fresh(oneOnOne(), "Reduced");
            const encoded = encodeGame(g) as Json;
            expect(encoded).toEqual(JSON.parse(JSON.stringify(g)) as Json);
            expect(encoded.players).not.toBe(g.players);
        });


        it("returns a failed result for hostile JSON", () => {
            const g = wire(fresh(twoByTwo(), "Standard"));
            const offer = wire(extensionOffer());
            const players = g.players as Array<Json>;
            const drawPile = g.drawPile as Array<string>;
            const offerTeams = offer.teams as Array<{ zone: { distance: Array<string> } }>;
            const offerDiscards = offer.discardPile as Array<string>;
            const hostile: ReadonlyArray<[string, unknown]> = [
                ["null", null],
                ["{}", {}],
                ["an array", []],
                ["a duplicated card", { ...g, drawPile: [...drawPile, Card.rightOfWay] }],
                ["a missing card", { ...g, drawPile: drawPile.slice(1) }],
                [
                    "a hand of 8",
                    {
                        ...g,
                        players: players.map((p, i) => i === 0 ?
                            { ...p, hand: [...(p.hand as Array<string>), drawPile[0]] } :
                            p),
                        drawPile: drawPile.slice(1),
                    },
                ],
                ["a phase naming an unknown player", { ...g, phase: { kind: "Turn", player: seatFor("Zed").id } }],
                ["a mismatched team count", { ...g, teams: (g.teams as Array<unknown>).slice(0, 1) }],
                ["an unknown card string", { ...g, drawPile: [...drawPile.slice(1), "Banana"] }],
                ["an extra top-level property", { ...g, secret: "x" }],
                ["an extra nested property", withValue(g, ["teams", 0, "zone", "secret"], 1)],
                ["Extension Available in a 4-seat game", { ...g, extension: { kind: "Available" } }],
                [
                    "an ExtensionOffer whose team is not at 700 miles",
                    {
                        ...offer,
                        teams: offerTeams.map((t, i) => i === 0 ?
                            { ...t, zone: { ...t.zone, distance: t.zone.distance.slice(0, -1) } } :
                            t),
                        discardPile: [...offerDiscards, Card.dist50],
                    },
                ],
                ["a Roll among distance cards", withValue(g, ["teams", 0, "zone", "distance"], [Card.roll])],
                ["a remedy as the blocking hazard", withValue(g, ["teams", 0, "zone", "status"], {
                    kind:   "Hazard",
                    hazard: Card.roll,
                })],
                ["a null card", withValue(g, ["drawPile", 0], null)],
                ["a gap in a hand", withValue(g, ["players", 1, "hand"], [Card.roll, undefined])],
                ["an array as the phase", { ...g, phase: [] }],
                ["a string race number", { ...g, raceNumber: "1" }],
                ["race number 0", { ...g, raceNumber: 0 }],
                ["a non-canonical game id", withValue(g, ["config", "id"], "ABC")],
                ["a non-normalized name", withValue(g, ["players", 0, "seat", "name"], " Ann")],
                ["negative points", withValue(g, ["teams", 0, "points"], -1)],
                ["fractional points", withValue(g, ["teams", 0, "points"], 0.5)],
                ["an unknown phase", { ...g, phase: { kind: "Intermission" } }],
                ["an unknown Extension state", { ...g, extension: { kind: "Maybe" } }],
            ];
            for (const [label, json] of hostile) {
                const result = decodeGame(json);
                expect(result.succeeded).withContext(label).toBeFalse();
            }
            const notAt700 = hostile.find(([label]) => label.startsWith("an ExtensionOffer"))![1];
            expect(decodeGame(notAt700).error).toContain("not 700");
        });


        it("rejects a race result naming a team that does not exist", () => {
            const raceOver = wire(play(extensionOffer(), ann.id, { type: "DeclineExtension" }));
            const outcome = ["phase", "result", "outcome"];
            const cases: ReadonlyArray<[unknown, string]> = [
                [withValue(raceOver, [...outcome, "team"], 2), "completing the trip"],
                [withValue(raceOver, outcome, { kind: "Exhausted", winner: 2, extensionCaller: null }), "winner"],
                [withValue(raceOver, [...outcome, "extensionCaller"], 2), "Extension caller team 2"],
            ];
            expect(decodeGame(raceOver).succeeded).toBeTrue();
            for (const [json, problem] of cases) {
                const error = decodeGame(json).error ?? "";
                expect(error).withContext(problem).toContain("team 2");
                expect(error).withContext(problem).toContain(problem);
            }
        });


        it("rejects a turn for a player who holds no cards", () => {
            const g = wire(fresh(oneOnOne(), "Reduced"));
            const players = g.players as Array<{ hand: Array<string> }>;
            const emptied = {
                ...g,
                players:     players.map((p, i) => i === 0 ? { ...p, hand: [] } : p),
                discardPile: [...(g.discardPile as Array<string>), ...players[0]!.hand],
            };
            expect(decodeGame(emptied).error).toContain("holds no cards");
        });


        it("rejects a game that could never move on", () => {
            expect(decodeGame(wire(unlandableHazard("TargetNotMoving"))).error).toContain("cannot land");
            // Team 0 has reached the 1,000-mile trip, but the race is still on.
            const at900 = rollingAt(
                Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist100, Card.dist100, Card.dist100
            );
            const g = wire(buildGame({ config: twoByTwo(), zones: [at900, newZone()] }));
            const discardPile = [...(g.discardPile as Array<string>)];
            discardPile.splice(discardPile.indexOf(Card.dist100), 1);
            const at1000 = withValue(g, ["teams", 0, "zone", "distance"], [...at900.distance, Card.dist100]);
            expect(decodeGame(g).succeeded).toBeTrue();
            expect(decodeGame({ ...(at1000 as Json), discardPile }).error).toContain("1000-mile trip");
        });


        it("keeps the failure message short for huge hostile strings and keys", () => {
            const g = wire(fresh(oneOnOne(), "Reduced"));
            const tenMegabytes = 10_000_000;
            const manyKeys = Object.fromEntries(Array.from({ length: 200_000 }, (_, i) => [`k${i}`, 1]));
            const hostile: ReadonlyArray<[string, () => { error: string | undefined; succeeded: boolean }]> = [
                ["a 10 MB id", () => decodeGame(withValue(g, ["config", "id"], "x".repeat(tenMegabytes)))],
                [
                    "a 10 MB padded name",
                    () => decodeGame(withValue(g, ["players", 0, "seat", "name"], `${" ".repeat(tenMegabytes)}Ann`)),
                ],
                ["200,000 extra keys", () => decodeGame({ ...g, ...manyKeys })],
                [
                    "a 10 MB pending organizer",
                    () => decodePendingGame({
                        ...(encodePendingGame(createPending(GameId.create(), ann)) as Json),
                        organizer: "y".repeat(tenMegabytes),
                    }),
                ],
            ];
            for (const [label, decode] of hostile) {
                const start = Date.now();
                const result = decode();
                expect(result.succeeded).withContext(label).toBeFalse();
                expect(result.error!.length).withContext(label).toBeLessThan(1000);
                expect(Date.now() - start).withContext(label).toBeLessThan(1000);
            }
        });


        it("rejects bad miles and counts in a race result", () => {
            const raceOver = wire(play(extensionOffer(), ann.id, { type: "DeclineExtension" }));
            const score = ["phase", "result", "scores", 0];
            for (const [key, value] of [
                ["miles", 710], ["miles", -25], ["miles", 2.5], ["safetyCount", -1], ["totalForRace", "1"],
            ] as const) {
                expect(decodeGame(withValue(raceOver, [...score, key], value)).succeeded)
                .withContext(`${key}: ${value}`)
                .toBeFalse();
            }
        });


        it("rejects a huge or sparse array before visiting its elements", () => {
            const g = wire(fresh(twoByTwo(), "Standard"));
            const raceOver = wire(play(extensionOffer(), ann.id, { type: "DeclineExtension" }));
            const paths: ReadonlyArray<[Json, ReadonlyArray<string | number>]> = [
                [g, ["config", "teams"]],
                [g, ["config", "teams", 0]],
                [g, ["players"]],
                [g, ["players", 0, "hand"]],
                [g, ["teams"]],
                [g, ["teams", 0, "zone", "distance"]],
                [g, ["teams", 0, "zone", "safeties"]],
                [g, ["drawPile"]],
                [g, ["discardPile"]],
                [raceOver, ["phase", "result", "scores"]],
            ];
            quicklyFails(() => decodeGame(huge()));
            quicklyFails(() => decodeGame(new Array(1e9)));
            for (const [base, path] of paths) {
                quicklyFails(() => decodeGame(withValue(base, path, huge())));
            }
            const manyCards = Array.from({ length: 10_000 }, () => Card.roll);
            quicklyFails(() => decodeGame({ ...g, drawPile: manyCards }));
        });


        it("never throws on a structurally valid but semantically hostile game", () => {
            const g = wire(fresh(oneOnOne(), "Reduced"));
            const ids = (g.players as Array<{ seat: { id: string } }>).map((p) => p.seat.id);
            const hostile: ReadonlyArray<unknown> = [
                withValue(g, ["players", 0, "team"], 2),
                { ...g, phase: { kind: "HazardIncoming", attacker: ids[0], hazard: Card.stop, target: 2 } },
                { ...g, phase: { kind: "ExtensionOffer", decider: ids[0], team: 2 } },
                { ...g, extension: { kind: "Called", caller: 2 } },
                { ...g, players: [] },
                { ...g, teams: [] },
                withValue(g, ["config", "teams"], []),
                withValue(g, ["config", "teams"], [[], []]),
            ];
            for (const json of hostile) {
                expect(() => decodeGame(json)).not.toThrow();
                expect(decodeGame(json).succeeded).toBeFalse();
            }
        });


        it("returns a failed result instead of throwing when reading the input throws", () => {
            const booby = Object.defineProperty({}, "config", {
                enumerable: true,
                get:        () => {
                    throw new Error("boom");
                },
            });
            expect(() => decodeGame(booby)).not.toThrow();
            expect(decodeGame(booby).error).toContain("boom");
        });

    });


    describe("decodePendingGame()", () => {

        const gameId = GameId.tryCreate("00000000-0000-4000-8000-0000000000aa").throwIfFailed();


        function pendingWith(...others: ReadonlyArray<unknown>): Json {
            const p = createPending(gameId, ann);
            return { ...(encodePendingGame(p) as Json), seats: [ann, ...others] };
        }


        it("round-trips a pending game", () => {
            const p: PendingGame = {
                ...createPending(gameId, ann),
                length: "Short",
                seats:  [ann, bob, seatFor("Robo", "Robot")],
            };
            const json: unknown = JSON.parse(JSON.stringify(encodePendingGame(p)));
            expect(decodePendingGame(json).throwIfFailed()).toEqual(p);
        });


        it("rejects duplicate seat ids", () => {
            expect(decodePendingGame(pendingWith(bob, { ...seatFor("Cy"), id: bob.id })).error).toContain(bob.id);
        });


        it("rejects names that differ only by case", () => {
            expect(decodePendingGame(pendingWith(seatFor("ANN"))).succeeded).toBeFalse();
        });


        it("rejects more than 6 seats", () => {
            const others = ["Bob", "Cy", "Di", "Ed", "Flo", "Gus"].map((n) => seatFor(n));
            expect(decodePendingGame(pendingWith(...others.slice(0, 5))).succeeded).toBeTrue();
            expect(decodePendingGame(pendingWith(...others)).succeeded).toBeFalse();
            quicklyFails(() => decodePendingGame({ ...pendingWith(), seats: huge() }));
        });


        it("rejects an organizer without a human seat", () => {
            expect(decodePendingGame({ ...pendingWith(bob), organizer: seatFor("Cy").id }).succeeded).toBeFalse();
            const robotAnn = { ...ann, kind: "Robot" };
            expect(decodePendingGame({ ...pendingWith(), seats: [robotAnn] }).succeeded).toBeFalse();
        });


        it("rejects hostile JSON", () => {
            const hostile: ReadonlyArray<unknown> = [
                null,
                {},
                [],
                { ...pendingWith(), secret: "x" },
                { ...pendingWith(), length: "Endless" },
                { ...pendingWith(), id: "game" },
                ...hostileSeats.map(([, seat]) => pendingWith(seat)),
            ];
            for (const json of hostile) {
                expect(() => decodePendingGame(json)).not.toThrow();
                expect(decodePendingGame(json).succeeded).withContext(JSON.stringify(json)).toBeFalse();
            }
        });

    });

});
