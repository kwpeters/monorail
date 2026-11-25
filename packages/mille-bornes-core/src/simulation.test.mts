import { isDeepStrictEqual } from "node:util";
import fc from "fast-check";
import { chooseCommand } from "./bot.mjs";
import {
    cardSchema, distanceCardSchema, hazardCardSchema, remedyCardSchema, safetyCardSchema, safetyFor
} from "./card.mjs";
import { type PlayerCommand, type SystemCommand } from "./commands.mjs";
import { shuffleDeck } from "./deck.mjs";
import { applyPlayerCommand, applySystemCommand } from "./engine.mjs";
import { type Game, type GameConfig, type RaceResult } from "./game.mjs";
import { PlayerId, type TeamIndex } from "./ids.mjs";
import { checkInvariants } from "./invariants.mjs";
import { type GameLength } from "./scoring.mjs";
import { playGame, seededRandom } from "./simulation.mjs";
import { oneOnOne, threeByTwo, threeSolo, twoByTwo } from "./testHelpers.mjs";
import { candidateCommands, legalPlays, viewFor } from "./view.mjs";


interface Layout {
    readonly seats:  number;
    readonly config: () => GameConfig;
}


const layouts: ReadonlyArray<Layout> = [
    { seats: 2, config: oneOnOne },
    { seats: 3, config: threeSolo },
    { seats: 4, config: twoByTwo },
    { seats: 6, config: threeByTwo },
];
const extensionLayouts = layouts.filter((l) => l.seats !== 4);
const lengths: ReadonlyArray<GameLength> = ["Quick", "Short", "Full"];

// A fixed batch, so the Extension tests always exercise the same races.
const extensionSeeds = Array.from({ length: 20 }, (_, i) => i + 1);

// The games whose states the engine properties sample.
const reachableSeeds = Array.from({ length: 10 }, (_, i) => i + 1);


function deepFreeze<T>(value: T): T {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
    }
    return value;
}


// Throws, so fast-check sees the failure and shrinks it.
function check(condition: boolean, message: () => string): void {
    if (!condition) {
        throw new Error(message());
    }
}


function commandKey(c: PlayerCommand): string {
    return JSON.stringify([c.type, "card" in c ? c.card : null, "targetTeam" in c ? c.targetTeam : null]);
}


function label(layout: Layout, length: GameLength, seed: number): string {
    return `${layout.seats} seats, ${length}, seed ${seed}`;
}


/** Plays a game and unwraps the result. */
function played(layout: Layout, length: GameLength, seed: number, onStep?: (g: Game) => void): Game {
    const result = playGame(
        { ...layout.config(), length },
        seededRandom(seed),
        undefined,
        { label: label(layout, length, seed), ...(onStep ? { onStep } : {}) }
    );
    return result.throwIfFailed().game;
}


/** Every state a game passes through, the dealt game first. */
function statesOf(layout: Layout, length: GameLength, seed: number): ReadonlyArray<Game> {
    const states: Array<Game> = [];
    played(layout, length, seed, (g) => states.push(g));
    return states;
}


function holdsCounter(g: Game): boolean {
    const phase = g.phase;
    return phase.kind === "HazardIncoming" &&
        g.players.some((p) => p.team === phase.target && p.hand.includes(safetyFor(phase.hazard)));
}


let reachableCache: ReadonlyArray<ReadonlyArray<Game>> | undefined;


/**
 * States captured from simulated games, in buckets by what the game waits
 * for, so sampling reaches the rarer phases.  Every state is deep-frozen, so
 * any engine mutation throws a TypeError.
 */
function reachable(): ReadonlyArray<ReadonlyArray<Game>> {
    if (!reachableCache) {
        const all = layouts
        .flatMap((layout) => reachableSeeds.flatMap((seed) => statesOf(layout, "Short", seed)))
        .map(deepFreeze);
        const kind = (g: Game): Game["phase"]["kind"] => g.phase.kind;
        reachableCache = [
            // Turns are most states; every 5th bounds the number kept.
            all.filter((g) => kind(g) === "Turn").filter((_, i) => i % 5 === 0),
            all.filter((g) => kind(g) === "HazardIncoming" && !holdsCounter(g)),
            all.filter(holdsCounter),
            all.filter((g) => kind(g) === "ExtensionOffer"),
            all.filter((g) => kind(g) === "RaceOver" || kind(g) === "GameOver"),
        ];
    }
    return reachableCache;
}


/** Samples reachable states evenly across the phases they wait for. */
function reachableState(): fc.Arbitrary<Game> {
    const buckets = reachable().filter((b) => b.length > 0);
    return fc.oneof(...buckets.map((b) => fc.constantFrom(...b)));
}


const commandTypes = [
    "Drive", "Attack", "Remedy", "PlaySafety", "Discard", "CoupFourre", "CallExtension",
    "DeclineExtension",
] as const;


/** Every well-formed command shape: the right kind of card, a real team. */
function wellFormedCommand(teamCount: number): fc.Arbitrary<PlayerCommand> {
    const team = fc.integer({ min: 0, max: teamCount - 1 }).map((t) => t as TeamIndex);
    const command: fc.Arbitrary<PlayerCommand> = fc.oneof(
        fc.record({ type: fc.constant("Drive" as const), card: fc.constantFrom(...distanceCardSchema.options) }),
        fc.record({
            type:       fc.constant("Attack" as const),
            card:       fc.constantFrom(...hazardCardSchema.options),
            targetTeam: team,
        }),
        fc.record({ type: fc.constant("Remedy" as const), card: fc.constantFrom(...remedyCardSchema.options) }),
        fc.record({
            type: fc.constantFrom("PlaySafety" as const, "CoupFourre" as const),
            card: fc.constantFrom(...safetyCardSchema.options),
        }),
        fc.record({ type: fc.constant("Discard" as const), card: fc.constantFrom(...cardSchema.options) }),
        fc.constantFrom({ type: "CallExtension" as const }, { type: "DeclineExtension" as const })
    );
    return command;
}


/** Commands with a real or junk type and hostile fields, or anything at all. */
const hostileCommand: fc.Arbitrary<unknown> = fc.oneof(
    fc.record({
        type: fc.oneof(
            fc.constantFrom(...commandTypes),
            fc.constantFrom("__proto__", "constructor", "toString", ""),
            fc.string()
        ),
        card: fc.oneof(
            fc.constantFrom(...cardSchema.options),
            fc.constantFrom("__proto__", "constructor"),
            fc.string(),
            fc.anything()
        ),
        targetTeam: fc.oneof(
            fc.integer({ min: -2, max: 5 }),
            fc.constantFrom(NaN, -0, 1.5, Infinity, "1"),
            fc.anything()
        ),
    }, { requiredKeys: [] }),
    fc.constantFrom(null, undefined, 0, "", [], {}),
    fc.anything()
);


const unknownPlayer = PlayerId.tryCreate("99999999-9999-4999-8999-999999999999").throwIfFailed();


/** A player id: someone in the game, a stranger, or not an id at all. */
function anyPlayer(g: Game): fc.Arbitrary<unknown> {
    return fc.oneof(
        fc.constantFrom(...g.players.map((p) => p.seat.id)),
        fc.constant(unknownPlayer),
        fc.uuid(),
        fc.anything()
    );
}


const deckKinds = ["Standard", "Reduced"] as const;


/** Valid system commands, decks that are wrong in every way, and junk. */
const anySystemCommand: fc.Arbitrary<unknown> = fc.oneof(
    fc.constantFrom({ type: "CloseHazardWindow" }, { type: "CloseExtensionOffer" }),
    fc.tuple(fc.constantFrom(...deckKinds), fc.integer())
    .map(([kind, seed]) => ({ type: "StartNextRace", deck: shuffleDeck(kind, seededRandom(seed)) })),
    fc.tuple(fc.constantFrom(...deckKinds), fc.integer(), fc.nat({ max: 100 }))
    .map(([kind, seed, n]) => ({ type: "StartNextRace", deck: shuffleDeck(kind, seededRandom(seed)).slice(n) })),
    fc.record({ type: fc.constant("StartNextRace"), deck: fc.array(fc.constantFrom(...cardSchema.options)) }),
    fc.record({ type: fc.constant("StartNextRace"), deck: fc.anything() }, { requiredKeys: [] }),
    fc.record({
        type: fc.oneof(
            fc.constantFrom("CloseHazardWindow", "CloseExtensionOffer", "StartNextRace", "__proto__"),
            fc.string()
        ),
        deck: fc.anything(),
    }, { requiredKeys: [] }),
    fc.anything()
);


/** Every card with every command type, and attacks on every team. */
function everyCommand(teamCount: number): ReadonlyArray<PlayerCommand> {
    const teams = Array.from({ length: teamCount }, (_, t) => t as TeamIndex);
    return [
        ...cardSchema.options.flatMap((card) => [
            ...["Drive", "Remedy", "PlaySafety", "CoupFourre", "Discard"].map((type) => ({ type, card })),
            ...teams.map((targetTeam) => ({ type: "Attack", card, targetTeam })),
        ] as unknown as Array<PlayerCommand>),
        { type: "CallExtension" },
        { type: "DeclineExtension" },
    ];
}


/** The result of every race in the Extension batch. */
function extensionBatchResults(): ReadonlyArray<{ seats: number; result: RaceResult }> {
    const results: Array<{ seats: number; result: RaceResult }> = [];
    for (const layout of extensionLayouts) {
        for (const seed of extensionSeeds) {
            played(layout, "Short", seed, (g) => {
                if (g.phase.kind === "RaceOver" || g.phase.kind === "GameOver") {
                    results.push({ seats: layout.seats, result: g.phase.result });
                }
            });
        }
    }
    return results;
}


describe("simulation", () => {

    describe("seededRandom()", () => {

        it("produces the same sequence on every call", () => {
            const sequence = (): Array<number> => {
                const rand = seededRandom(7);
                return Array.from({ length: 20 }, () => rand());
            };
            const first = sequence();
            expect(sequence()).toEqual(first);
            expect(first.every((x) => x >= 0 && x < 1)).toBeTrue();
            expect(new Set(first).size).toBe(first.length);
        });

    });


    describe("playGame()", () => {

        for (const layout of layouts) {
            for (const length of lengths) {
                it(`plays ${layout.seats}-seat ${length} games to GameOver, invariants holding`, () => {
                    fc.assert(fc.property(fc.nat(), (seed) => {
                        const g = played(layout, length, seed);
                        check(g.phase.kind === "GameOver", () => `${label(layout, length, seed)}: not over`);
                    }), { numRuns: 200 });
                });
            }
        }


        it("fails, naming the label, when the game outlasts maxSteps", () => {
            const result = playGame(oneOnOne(), seededRandom(1), 3, { label: "seed 1" });
            expect(result.failed).toBeTrue();
            expect(result.failed && result.error).toMatch(/^seed 1: .*3 steps/);
        });


        it("calls onStep with every state, the dealt game first and GameOver last", () => {
            const states: Array<Game> = [];
            const result = playGame(
                { ...oneOnOne(), length: "Quick" },
                seededRandom(1),
                undefined,
                { onStep: (g) => states.push(g) }
            ).throwIfFailed();
            expect(states.length).toBe(result.steps + 1);
            expect(states[0]!.raceNumber).toBe(1);
            expect(states.at(-1)).toBe(result.game);
            expect(result.racesPlayed).toBe(result.game.raceNumber);
        });


        it("plays whole games on deep-frozen states without a TypeError", () => {
            for (const layout of layouts) {
                for (const seed of [1, 2]) {
                    expect(() => played(layout, "Short", seed, deepFreeze)).not.toThrow();
                }
            }
        });


        it("reaches an Extension offer and a called Extension in 2-, 3- and 6-seat games", () => {
            for (const layout of extensionLayouts) {
                const states = extensionSeeds.flatMap((seed) => statesOf(layout, "Short", seed));
                expect(states.some((g) => g.phase.kind === "ExtensionOffer"))
                .withContext(`${layout.seats} seats offered`)
                .toBeTrue();
                expect(states.some((g) => g.extension.kind === "Called"))
                .withContext(`${layout.seats} seats called`)
                .toBeTrue();
            }
        });


        it("pays Extension to the caller only when it completes the trip, else to everyone else", () => {
            let callerCompleted = 0;
            let callerFailed = 0;
            for (const { seats, result } of extensionBatchResults()) {
                const caller = result.outcome.extensionCaller;
                if (caller === null) {
                    expect(result.scores.every((s) => s.extension === 0)).toBeTrue();
                    continue;
                }
                const completed = result.outcome.kind === "TripCompleted" && result.outcome.team === caller;
                if (completed) {
                    callerCompleted++;
                }
                else {
                    callerFailed++;
                }
                const expected = result.scores.map((_, t) => (completed ? t === caller : t !== caller) ? 200 : 0);
                expect(result.scores.map((s): number => s.extension))
                .withContext(`${seats} seats: ${JSON.stringify(result.outcome)}`)
                .toEqual(expected);
            }
            expect(callerCompleted).withContext("races the caller completed").toBeGreaterThan(0);
            expect(callerFailed).withContext("races the caller did not complete").toBeGreaterThan(0);
        });

    });


    describe("engine", () => {

        it("never throws on well-formed commands from anyone, and a rejection changes nothing", () => {
            const sample = reachableState().chain((g) => fc.tuple(
                fc.constant(g),
                anyPlayer(g),
                wellFormedCommand(g.teams.length)
            ));
            fc.assert(fc.property(sample, ([g, by, cmd]) => {
                const before = structuredClone(g);
                const result = applyPlayerCommand(g, by as PlayerId, deepFreeze(cmd));
                if (result.failed) {
                    check(isDeepStrictEqual(g, before), () => "a rejected command changed the game");
                }
                else {
                    const valid = checkInvariants(result.value.game);
                    check(valid.succeeded, () => `${JSON.stringify(cmd)}: ${valid.failed && valid.error}`);
                }
            }), { numRuns: 2000 });
        });


        it("never throws on malformed or hostile player commands", () => {
            const sample = reachableState().chain((g) => fc.tuple(fc.constant(g), anyPlayer(g), hostileCommand));
            fc.assert(fc.property(sample, ([g, by, cmd]) => {
                const before = structuredClone(g);
                const result = applyPlayerCommand(g, by as PlayerId, deepFreeze(cmd) as PlayerCommand);
                if (result.failed) {
                    check(isDeepStrictEqual(g, before), () => "a rejected command changed the game");
                }
                else {
                    check(checkInvariants(result.value.game).succeeded, () => "an invariant broke");
                }
            }), { numRuns: 2000 });
        });


        it("never throws on valid or invalid system commands", () => {
            fc.assert(fc.property(reachableState(), anySystemCommand, (g, cmd) => {
                const before = structuredClone(g);
                const result = applySystemCommand(g, deepFreeze(cmd) as SystemCommand);
                if (result.failed) {
                    check(isDeepStrictEqual(g, before), () => "a rejected command changed the game");
                }
                else {
                    check(checkInvariants(result.value.game).succeeded, () => "an invariant broke");
                }
            }), { numRuns: 2000 });
        });


        it("accepts every command in legalPlays() and rejects every other candidate", () => {
            fc.assert(fc.property(reachableState(), (g) => {
                for (const { seat } of g.players) {
                    const v = viewFor(g, seat.id).throwIfFailed();
                    const legal = legalPlays(v);
                    const legalKeys = new Set(legal.map(commandKey));
                    for (const cmd of legal) {
                        check(applyPlayerCommand(g, seat.id, cmd).succeeded, () => `refused ${commandKey(cmd)}`);
                    }
                    const others = [...candidateCommands(v), ...everyCommand(g.teams.length)]
                    .filter((cmd) => !legalKeys.has(commandKey(cmd)));
                    for (const cmd of others) {
                        check(applyPlayerCommand(g, seat.id, cmd).failed, () => `accepted ${commandKey(cmd)}`);
                    }
                }
            }), { numRuns: 200 });
        });


        it("accepts every command chooseCommand() returns, whatever rand returns", () => {
            fc.assert(fc.property(reachableState(), fc.double(), (g, x) => {
                for (const { seat } of g.players) {
                    const cmd = chooseCommand(viewFor(g, seat.id).throwIfFailed(), () => x);
                    const onTurn = g.phase.kind === "Turn" && g.phase.player === seat.id;
                    check(cmd !== null || !onTurn, () => "the robot on turn made no play");
                    if (cmd !== null) {
                        check(applyPlayerCommand(g, seat.id, cmd).succeeded, () => `refused ${commandKey(cmd)}`);
                    }
                }
            }), { numRuns: 500 });
        });

    });

});
