import { FailedResult, type Result } from "@repo/depot/result";
import { Card, cardSchema } from "@repo/mille-bornes-core/card";
import { type PlayerCommand } from "@repo/mille-bornes-core/commands";
import { cardCounts, shuffleDeck } from "@repo/mille-bornes-core/deck";
import { newZone, type DrivingZone } from "@repo/mille-bornes-core/drivingZone";
import { createGame } from "@repo/mille-bornes-core/engine";
import {
    seatOrder, type Game, type GameConfig, type Phase, type Seat, type SeatKind
} from "@repo/mille-bornes-core/game";
import { GameId, PlayerId, type TeamIndex } from "@repo/mille-bornes-core/ids";
import { checkInvariants, physicalCards } from "@repo/mille-bornes-core/invariants";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import { type Points } from "@repo/mille-bornes-core/points";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { initialExtension, variantForSeatCount } from "@repo/mille-bornes-core/variant";
import { defaultTimings } from "./config.mjs";
import { FakeClock } from "./fakeClock.mjs";
import { collectingLogger } from "./logger.mjs";
import { Table, type TableOptions, type TableUpdate } from "./table.mjs";


// Test helpers copied (cut down) from core's testHelpers.mts, which core does
// not export.

function seatFor(name: string, kind: SeatKind = "Human"): Seat {
    const hex = Array.from(name, (ch) => ch.codePointAt(0)!.toString(16))
    .join("")
    .padStart(12, "0")
    .slice(-12);
    return {
        id:   PlayerId.tryCreate(`00000000-0000-4000-8000-${hex}`).throwIfFailed(),
        name: PlayerName.tryCreate(name).throwIfFailed(),
        kind,
    };
}


function configOf(
    teams: ReadonlyArray<ReadonlyArray<Seat>>,
    length: GameConfig["length"] = "Full"
): GameConfig {
    const id = GameId.tryCreate("00000000-0000-4000-8000-000000000000").throwIfFailed();
    return { id, length, teams };
}


interface GameParts {
    readonly config:    GameConfig;
    /** Hands in turn order (default: empty). */
    readonly hands?:    ReadonlyArray<ReadonlyArray<Card>>;
    /** Zones by team (default: `newZone()`). */
    readonly zones?:    ReadonlyArray<DrivingZone>;
    readonly drawPile?: ReadonlyArray<Card>;
    /** Default: the first player's turn. */
    readonly phase?:    Phase;
}


// Builds a valid game from the parts; every card of the variant's deck that
// the parts do not place goes to the discard pile.
function buildGame(parts: GameParts): Game {
    const { config } = parts;
    const variant = variantForSeatCount(config.teams.flat().length).throwIfFailed();
    const order = seatOrder(config.teams);
    const placed: Game = {
        config,
        players: order.map(({ seat, team }, i) => ({ seat, team, hand: parts.hands?.[i] ?? [] })),
        teams:   config.teams.map((_, t) => ({
            zone:   parts.zones?.[t] ?? newZone(),
            points: 0 as Points,
        })),
        drawPile:    parts.drawPile ?? [],
        discardPile: [],
        raceNumber:  1,
        extension:   initialExtension(variant),
        phase:       parts.phase ?? { kind: "Turn", player: order[0]!.seat.id },
    };
    const remaining = { ...cardCounts(variant.deck) };
    for (const card of physicalCards(placed)) {
        if (--remaining[card] < 0) {
            throw new Error(`buildGame: too many "${card}" cards.`);
        }
    }
    const discardPile = cardSchema.options
    .flatMap((card) => Array.from({ length: remaining[card] }, () => card));
    const game = { ...placed, discardPile };
    checkInvariants(game).throwIfFailed();
    return game;
}


const rolling: DrivingZone = { ...newZone(), status: { kind: "Rolling" } };
const at700: DrivingZone = {
    ...rolling,
    distance: [Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist100],
};
const team0 = 0 as TeamIndex;
const team1 = 1 as TeamIndex;


function oneOnOne(
    annKind: SeatKind,
    bobKind: SeatKind,
    length: GameConfig["length"] = "Full"
): GameConfig {
    return configOf([[seatFor("Ann", annKind)], [seatFor("Bob", bobKind)]], length);
}


const ann = seatFor("Ann").id;
const bob = seatFor("Bob").id;
const drive25: PlayerCommand = { type: "Drive", card: Card.dist25 };
const attackBob: PlayerCommand = { type: "Attack", card: Card.stop, targetTeam: team1 };
const coupFourre: PlayerCommand = { type: "CoupFourre", card: Card.rightOfWay };


// Ann (human) is on turn holding a Stop; Bob is rolling and holds `bobHand`.
function hazardGame(bobKind: SeatKind, bobHand: ReadonlyArray<Card>): Game {
    return buildGame({
        config:   oneOnOne("Human", bobKind),
        hands:    [[Card.stop, Card.dist25], bobHand],
        zones:    [rolling, rolling],
        drawPile: [Card.dist50, Card.dist50, Card.dist75, Card.dist75],
    });
}


// Ann's Stop is in flight at Bob (human, holding Right of Way).
function hazardInFlight(): Game {
    return buildGame({
        config:   oneOnOne("Human", "Human"),
        hands:    [[Card.dist25], [Card.rightOfWay, Card.dist25]],
        zones:    [rolling, rolling],
        drawPile: [Card.dist50, Card.dist50],
        phase:    { kind: "HazardIncoming", attacker: ann, hazard: Card.stop, target: team1 },
    });
}


// Ann's team has just reached 700 miles and Ann decides on Extension.
function extensionGame(annKind: SeatKind, length: GameConfig["length"] = "Full"): Game {
    return buildGame({
        config:   oneOnOne(annKind, "Human", length),
        hands:    [[Card.dist25], [Card.dist25, Card.dist50]],
        zones:    [at700, newZone()],
        drawPile: [Card.dist75, Card.dist75],
        phase:    { kind: "ExtensionOffer", decider: ann, team: team0 },
    });
}


// Ann is on turn (and rolling, holding `annHand`); Bob is human.
function turnGame(annKind: SeatKind, annHand: ReadonlyArray<Card>): Game {
    return buildGame({
        config:   oneOnOne(annKind, "Human"),
        hands:    [annHand, [Card.dist25, Card.stop]],
        zones:    [rolling, rolling],
        drawPile: [Card.dist75, Card.dist75],
    });
}


interface HarnessOptions {
    readonly clock?:       FakeClock;
    readonly seq?:         number;
    readonly rand?:        () => number;
    readonly applySystem?: TableOptions["applySystem"];
    readonly onUpdate?:    (u: TableUpdate, table: Table) => void;
}


interface Harness {
    readonly table:   Table;
    readonly clock:   FakeClock;
    readonly updates: Array<TableUpdate>;
    readonly stuck:   Array<string>;
    readonly logger:  ReturnType<typeof collectingLogger>;
}


// Creates and starts a table on `game`.
function harness(game: Game, opts: HarnessOptions = {}): Harness {
    const clock = opts.clock ?? new FakeClock();
    const updates: Array<TableUpdate> = [];
    const stuck: Array<string> = [];
    const logger = collectingLogger();
    const table: Table = new Table({
        game,
        seq:      opts.seq ?? 0,
        clock,
        rand:     opts.rand ?? ((): number => 0),
        timings:  defaultTimings,
        logger,
        onUpdate: (u) => {
            updates.push(u);
            opts.onUpdate?.(u, table);
        },
        onStuck:  (reason) => { stuck.push(reason); },
        ...(opts.applySystem ? { applySystem: opts.applySystem } : {}),
    });
    table.start();
    return { table, clock, updates, stuck, logger };
}


function eventTypes(u: TableUpdate | undefined): Array<string> {
    return (u?.events ?? []).map((e) => e.type);
}


function errorLines(h: Harness): Array<string> {
    return h.logger.lines.filter((line) => line.startsWith("ERROR"));
}


// core requires a human in every game, so an all-robot game is checked with
// its seats turned back into humans; nothing else in the game changes.
function checkAsHumans(g: Game): Result<void, string> {
    const human = (s: Seat): Seat => ({ ...s, kind: "Human" });
    return checkInvariants({
        ...g,
        config:  { ...g.config, teams: g.config.teams.map((team) => team.map(human)) },
        players: g.players.map((p) => ({ ...p, seat: human(p.seat) })),
    });
}


// Team names by seat count.
const robotTeams = new Map<number, ReadonlyArray<ReadonlyArray<string>>>([
    [2, [["Ann"], ["Bob"]]],
    [3, [["Ann"], ["Bob"], ["Cy"]]],
    [4, [["Ann", "Cy"], ["Bob", "Di"]]],
    [6, [["Ann", "Di"], ["Bob", "Ed"], ["Cy", "Flo"]]],
]);


// Creates a game whose every seat is a robot (core's createGame() refuses
// one, so the seats are made robots after the deal).
function allRobotGame(seats: number, rand: () => number, length: GameConfig["length"]): Game {
    const teams = robotTeams.get(seats)!.map((team) => team.map((n) => seatFor(n)));
    const variant = variantForSeatCount(seats).throwIfFailed();
    const deck = shuffleDeck(variant.deck, rand);
    const dealt = createGame(configOf(teams, length), deck).throwIfFailed().game;
    const robot = (s: Seat): Seat => ({ ...s, kind: "Robot" });
    return {
        ...dealt,
        config:  { ...dealt.config, teams: dealt.config.teams.map((team) => team.map(robot)) },
        players: dealt.players.map((p) => ({ ...p, seat: robot(p.seat) })),
    };
}


interface WholeGame {
    readonly harness:  Harness;
    readonly problems: Array<string>;
}


// Plays an all-robot game to the end using only the clock.
function playWholeGame(seats: number, seed: number, length: GameConfig["length"]): WholeGame {
    const rand = seededRandom(seed);
    const problems: Array<string> = [];
    const h = harness(allRobotGame(seats, rand, length), {
        seq:      100,
        rand,
        onUpdate: (u) => {
            const valid = checkAsHumans(u.game);
            if (valid.failed) {
                problems.push(`seq ${u.seq}: ${valid.error}`);
            }
        },
    });
    // 12 simulated hours is far more than any game needs.
    const limit = 12 * 60 * 60 * 1000;
    const running = (): boolean => h.table.game.phase.kind !== "GameOver" && h.stuck.length === 0;
    while (running() && h.clock.now() < limit) {
        h.clock.advance(500);
    }
    return { harness: h, problems };
}


describe("Table", () => {

    describe("instance", () => {

        describe("start()", () => {

            describe("in a hazard window", () => {

                it("closes the window at 5,000 ms when nobody holds the counter", () => {
                    const h = harness(hazardGame("Human", [Card.dist25]));
                    h.table.submit(ann, attackBob).throwIfFailed();
                    expect(h.clock.pendingCount()).toEqual(1);

                    h.clock.advance(4999);
                    expect(h.updates.length).toEqual(1);

                    h.clock.advance(1);
                    expect(h.updates.length).toEqual(2);
                    expect(eventTypes(h.updates[1])).toContain("HazardLanded");
                });


                it("runs the full window when a human on the target team holds the counter", () => {
                    const h = harness(hazardGame("Human", [Card.rightOfWay, Card.dist25]));
                    h.table.submit(ann, attackBob).throwIfFailed();

                    h.clock.advance(4999);
                    expect(h.updates.length).toEqual(1);

                    h.clock.advance(1);
                    expect(eventTypes(h.updates[1])).toContain("HazardLanded");
                });


                it("applies a human's Coup Fourre and cancels the close timer", () => {
                    const h = harness(hazardGame("Human", [Card.rightOfWay, Card.dist25]));
                    h.table.submit(ann, attackBob).throwIfFailed();
                    h.clock.advance(1000);

                    expect(h.table.submit(bob, coupFourre).succeeded).toBeTrue();
                    expect(eventTypes(h.updates[1])).toContain("CoupFourrePlayed");
                    expect(h.clock.pendingCount()).toEqual(0);

                    h.clock.advance(9000);
                    expect(h.updates.length).toEqual(2);
                });


                it("refuses every other command without restarting the window", () => {
                    const h = harness(hazardGame("Human", [Card.rightOfWay, Card.dist25]));
                    h.table.submit(ann, attackBob).throwIfFailed();
                    h.clock.advance(2000);

                    expect(h.table.submit(ann, drive25).failed).toBeTrue();
                    expect(h.table.submit(bob, drive25).failed).toBeTrue();
                    expect(h.table.seq).toEqual(1);

                    h.clock.advance(2999);
                    expect(h.updates.length).toEqual(1);
                    h.clock.advance(1);
                    expect(eventTypes(h.updates[1])).toContain("HazardLanded");
                });


                it("lets a robot holding the counter answer at delay 0", () => {
                    const h = harness(hazardGame("Robot", [Card.rightOfWay, Card.dist25]));
                    h.table.submit(ann, attackBob).throwIfFailed();
                    expect(h.clock.pendingCount()).toEqual(2);

                    h.clock.advance(0);
                    expect(eventTypes(h.updates[1])).toContain("CoupFourrePlayed");
                });


                it("schedules nothing for a robot that does not hold the counter", () => {
                    const h = harness(hazardGame("Robot", [Card.dist25]));
                    h.table.submit(ann, attackBob).throwIfFailed();
                    expect(h.clock.pendingCount()).toEqual(1);

                    h.clock.advance(4999);
                    expect(h.updates.length).toEqual(1);
                    h.clock.advance(1);
                    expect(eventTypes(h.updates[1])).toContain("HazardLanded");
                });

            });


            describe("on a turn", () => {

                // [rand, the delay it gives] with the default 1,000..3,000 ms.
                const delays: ReadonlyArray<[number, number]> = [
                    [0, 1000], [0.5, 2000], [0.999, 2998], [NaN, 1000], [1, 3000],
                ];
                for (const [r, delay] of delays) {
                    it(`lets a robot play after ${delay} ms when rand returns ${r}`, () => {
                        const game = turnGame("Robot", [Card.dist25, Card.dist50]);
                        const h = harness(game, { rand: () => r });

                        h.clock.advance(delay - 1);
                        expect(h.updates.length).toEqual(0);

                        h.clock.advance(1);
                        expect(eventTypes(h.updates[0])).toContain("DistancePlayed");
                    });
                }


                it("schedules nothing on a human's turn", () => {
                    const h = harness(turnGame("Human", [Card.dist25]));

                    expect(h.clock.pendingCount()).toEqual(0);
                    expect(h.table.timer()).toBeNull();
                });

            });


            describe("in an Extension offer", () => {

                it("declines for a human decider after 30,000 ms", () => {
                    const h = harness(extensionGame("Human"));

                    h.clock.advance(29999);
                    expect(h.updates.length).toEqual(0);

                    h.clock.advance(1);
                    expect(eventTypes(h.updates[0])).toContain("ExtensionDeclined");
                });


                it("cancels the timeout when the human answers", () => {
                    const h = harness(extensionGame("Human"));
                    h.clock.advance(10000);

                    h.table.submit(ann, { type: "CallExtension" }).throwIfFailed();
                    h.clock.advance(30000);

                    expect(h.updates.length).toEqual(1);
                    expect(h.table.game.phase).toEqual({ kind: "Turn", player: bob });
                });


                it("lets a robot decider answer after its delay", () => {
                    const h = harness(extensionGame("Robot"), { rand: () => 0.5 });
                    expect(h.clock.pendingCount()).toEqual(2);

                    h.clock.advance(1999);
                    expect(h.updates.length).toEqual(0);

                    h.clock.advance(1);
                    expect(eventTypes(h.updates[0])).toContain("ExtensionCalled");
                });

            });


            describe("after a race", () => {

                it("deals the next race after 20,000 ms", () => {
                    const h = harness(extensionGame("Human"));
                    h.clock.advance(30000);
                    expect(h.table.game.phase.kind).toEqual("RaceOver");

                    h.clock.advance(19999);
                    expect(h.updates.length).toEqual(1);

                    h.clock.advance(1);
                    const dealt = h.table.game;
                    expect(eventTypes(h.updates[1])).toContain("RaceDealt");
                    expect(dealt.raceNumber).toEqual(2);
                    expect(dealt.players.every((p) => p.hand.length >= 6)).toBeTrue();
                    expect(checkInvariants(dealt).succeeded).toBeTrue();
                });


                it("schedules nothing when the game is over", () => {
                    const h = harness(extensionGame("Human", "Quick"));
                    h.clock.advance(30000);

                    expect(h.table.game.phase.kind).toEqual("GameOver");
                    expect(h.clock.pendingCount()).toEqual(0);
                    expect(h.table.timer()).toBeNull();
                });

            });


            describe("after a restore", () => {

                it("runs the hazard window again from zero", () => {
                    const clock = new FakeClock();
                    clock.advance(7000);
                    const h = harness(hazardInFlight(), { clock });

                    expect(h.table.timer()).toEqual({ kind: "HazardWindow", remainingMs: 5000 });
                    h.clock.advance(4999);
                    expect(h.updates.length).toEqual(0);

                    h.clock.advance(1);
                    expect(eventTypes(h.updates[0])).toContain("HazardLanded");
                });


                it("does not duplicate or restart timers when called again", () => {
                    const h = harness(hazardInFlight());
                    h.clock.advance(2000);

                    h.table.start();
                    expect(h.clock.pendingCount()).toEqual(1);

                    h.clock.advance(3000);
                    expect(eventTypes(h.updates[0])).toContain("HazardLanded");
                });

            });


            describe("stuck guard", () => {

                it("fires once when the engine rejects a timer's command", () => {
                    const h = harness(hazardInFlight(), {
                        applySystem: () => new FailedResult({ reason: "WrongPhase" }),
                    });

                    h.clock.advance(5000);

                    expect(h.stuck.length).toEqual(1);
                    expect(errorLines(h).length).toEqual(1);
                    expect(h.clock.pendingCount()).toEqual(0);
                    expect(h.table.submit(bob, coupFourre).failed).toBeTrue();
                });


                it("fires once when a timer's command throws", () => {
                    const h = harness(hazardInFlight(), {
                        applySystem: () => { throw new Error("boom"); },
                    });

                    h.clock.advance(5000);

                    expect(h.stuck.length).toEqual(1);
                    expect(h.stuck[0]).toContain("boom");
                    expect(errorLines(h).length).toEqual(1);
                    expect(h.clock.pendingCount()).toEqual(0);
                });


                it("fires once when a robot on turn has no move", () => {
                    // The engine never gives a turn to an empty hand, so the
                    // robot's only card is moved to the discard pile by hand.
                    const g = turnGame("Robot", [Card.dist25]);
                    const h = harness({
                        ...g,
                        players:     g.players.map((p, i) => i === 0 ? { ...p, hand: [] } : p),
                        discardPile: [...g.discardPile, Card.dist25],
                    });

                    h.clock.advance(3000);

                    expect(h.stuck.length).toEqual(1);
                    expect(errorLines(h).length).toEqual(1);
                    expect(h.clock.pendingCount()).toEqual(0);
                    expect(h.updates.length).toEqual(0);
                });

            });


            describe("whole games", () => {

                for (const seats of [2, 4, 6]) {
                    it(`plays a ${seats}-seat all-robot game to GameOver`, () => {
                        const { harness: h, problems } = playWholeGame(seats, seats, "Full");

                        expect(h.table.game.phase.kind).toEqual("GameOver");
                        expect(problems).toEqual([]);
                        expect(h.stuck).toEqual([]);
                        expect(h.clock.pendingCount()).toEqual(0);
                        expect(h.table.timer()).toBeNull();
                        expect(h.updates.map((u) => u.seq))
                        .toEqual(h.updates.map((_, i) => 101 + i));

                        const restored = harness(h.table.game);
                        expect(restored.clock.pendingCount()).toEqual(0);
                    });
                }


                it("plays a seeded batch of 20 games to GameOver", () => {
                    const failures: Array<string> = [];
                    for (let seed = 1; seed <= 20; seed++) {
                        const seats = [2, 3, 4, 6][seed % 4]!;
                        const { harness: h, problems } = playWholeGame(seats, 1000 + seed, "Full");
                        const phase = h.table.game.phase.kind;
                        const errors = [...problems, ...h.stuck];
                        if (phase !== "GameOver" || errors.length > 0) {
                            failures.push(`seed ${seed}: ${phase} ${errors.join("; ")}`);
                        }
                    }

                    expect(failures).toEqual([]);
                });

            });

        });


        describe("timer()", () => {

            it("reports the time left in the hazard window", () => {
                const h = harness(hazardGame("Human", [Card.rightOfWay]));
                h.table.submit(ann, attackBob).throwIfFailed();
                h.clock.advance(1000);

                expect(h.table.timer()).toEqual({ kind: "HazardWindow", remainingMs: 4000 });
            });


            it("reports the Extension offer, not the robot's delay", () => {
                const h = harness(extensionGame("Robot"), { rand: () => 1 });

                expect(h.table.timer()).toEqual({ kind: "ExtensionOffer", remainingMs: 30000 });
            });


            it("reports the pause after a race", () => {
                const h = harness(extensionGame("Human"));
                h.clock.advance(35000);

                expect(h.table.timer()).toEqual({ kind: "NextRace", remainingMs: 15000 });
            });

        });


        describe("submit()", () => {

            it("accepts a Drive once and refuses the double tap", () => {
                const h = harness(turnGame("Human", [Card.dist25, Card.dist25]));

                expect(h.table.submit(ann, drive25).succeeded).toBeTrue();
                const again = h.table.submit(ann, drive25);

                expect(again.failed).toBeTrue();
                expect(again.error).toMatch(/\w/);
                expect(h.table.seq).toEqual(1);
                expect(h.updates.length).toEqual(1);
            });


            it("refuses a player who is not on turn", () => {
                const h = harness(turnGame("Human", [Card.dist25]));

                expect(h.table.submit(bob, drive25).failed).toBeTrue();
                expect(h.table.seq).toEqual(0);
            });


            it("refuses a command after the race is over", () => {
                const h = harness(extensionGame("Human"));
                h.clock.advance(30000);

                expect(h.table.submit(bob, drive25).failed).toBeTrue();
                expect(h.table.seq).toEqual(1);
            });


            it("refuses a player who is not in the game", () => {
                const h = harness(turnGame("Human", [Card.dist25]));

                expect(h.table.submit(PlayerId.create(), drive25).failed).toBeTrue();
                expect(h.table.seq).toEqual(0);
            });


            it("refuses garbage without throwing", () => {
                const h = harness(turnGame("Human", [Card.dist25]));

                const garbage = [
                    null, undefined, 42, {}, { type: "Nope" }, { type: "Drive", card: 7 },
                ];
                for (const cmd of garbage) {
                    expect(h.table.submit(ann, cmd as unknown as PlayerCommand).failed).toBeTrue();
                }
                expect(h.table.seq).toEqual(0);
            });


            it("passes the update unredacted with seq one more than before", () => {
                const h = harness(turnGame("Human", [Card.dist25]), { seq: 41 });

                h.table.submit(ann, drive25).throwIfFailed();

                expect(h.updates[0]!.seq).toEqual(42);
                expect(h.updates[0]!.game).toBe(h.table.game);
                const drawn = h.updates[0]!.events.find((e) => e.type === "CardDrawn");
                expect(drawn).toEqual({ type: "CardDrawn", player: bob, card: Card.dist75 });
            });


            it("schedules the new phase before notifying, so onUpdate may submit", () => {
                const game = buildGame({
                    config:   oneOnOne("Human", "Human"),
                    hands:    [[Card.dist25], [Card.stop]],
                    zones:    [rolling, rolling],
                    drawPile: [Card.dist75, Card.dist75],
                });
                const h = harness(game, {
                    onUpdate: (u, table) => {
                        if (u.seq === 1) {
                            const attack: PlayerCommand = {
                                type:       "Attack",
                                card:       Card.stop,
                                targetTeam: team0,
                            };
                            table.submit(bob, attack).throwIfFailed();
                        }
                    },
                });

                h.table.submit(ann, drive25).throwIfFailed();

                expect(h.updates.map((u) => u.seq)).toEqual([1, 2]);
                expect(h.table.game.phase.kind).toEqual("HazardIncoming");
                expect(h.clock.pendingCount()).toEqual(1);
                h.clock.advance(5000);
                expect(eventTypes(h.updates[2])).toContain("HazardLanded");
            });


            it("leaves no timers when onUpdate disposes the table", () => {
                const h = harness(hazardGame("Human", [Card.dist25]), {
                    onUpdate: (_, table) => { table.dispose(); },
                });

                h.table.submit(ann, attackBob).throwIfFailed();

                expect(h.clock.pendingCount()).toEqual(0);
            });


            it("keeps an accepted change when onUpdate throws", () => {
                const h = harness(hazardGame("Human", [Card.dist25]), {
                    onUpdate: () => { throw new Error("hub down"); },
                });

                expect(h.table.submit(ann, attackBob).succeeded).toBeTrue();
                expect(h.table.seq).toEqual(1);
                expect(errorLines(h).length).toEqual(1);

                h.clock.advance(5000);
                expect(h.table.seq).toEqual(2);
                expect(h.stuck).toEqual([]);
            });

        });


        describe("dispose()", () => {

            it("cancels every timer and makes later calls no-ops", () => {
                const h = harness(hazardInFlight());

                h.table.dispose();
                h.clock.advance(24 * 60 * 60 * 1000);
                h.table.dispose();
                h.table.start();

                expect(h.updates).toEqual([]);
                expect(h.clock.pendingCount()).toEqual(0);
                expect(h.table.timer()).toBeNull();
                expect(h.table.submit(bob, coupFourre).error).toEqual("This game has ended.");
            });

        });

    });

});
