import { Card } from "./card.mjs";
import { createDeck } from "./deck.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import { createGame } from "./engine.mjs";
import { type Game, type GameConfig } from "./game.mjs";
import { PlayerId, type TeamIndex } from "./ids.mjs";
import { checkInvariants } from "./invariants.mjs";
import { Points } from "./points.mjs";
import { scoreRace, standardScoring, type RaceOutcome } from "./scoring.mjs";
import {
    buildGame, oneOnOne, threeByTwo, threeSolo, twoByTwo, unlandableHazard
} from "./testHelpers.mjs";
import { type ExtensionState } from "./variant.mjs";


function fresh(config: GameConfig): Game {
    const deck = createDeck(config.teams.flat().length < 4 ? "Reduced" : "Standard");
    return createGame(config, deck).throwIfFailed().game;
}


function failure(game: Game): string {
    return checkInvariants(game).throwIfSucceeded();
}


const rolling: DrivingZone = { ...newZone(), status: { kind: "Rolling" } };
const at700: DrivingZone = {
    ...rolling,
    distance: [Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist100],
};


const at1000: DrivingZone = {
    ...at700,
    distance: [...at700.distance, Card.dist100, Card.dist100, Card.dist100],
};


/** A valid 2-seat RaceOver, then the same game with `outcome` in its result. */
function raceOverWith(outcome: RaceOutcome, extension?: ExtensionState): [Game, Game] {
    const valid: RaceOutcome = {
        kind:            "TripCompleted",
        team:            0 as TeamIndex,
        delayedAction:   false,
        extensionCaller: extension?.kind === "Called" ? extension.caller : null,
    };
    const zones = [at700, newZone()];
    const scores = scoreRace(standardScoring, zones, valid, [Points.zero, Points.zero]);
    const game = buildGame({
        config: oneOnOne(),
        zones,
        phase:  { kind: "RaceOver", result: { outcome: valid, scores } },
        ...(extension ? { extension } : {}),
    });
    return [game, { ...game, phase: { kind: "RaceOver", result: { outcome, scores } } }];
}


describe("invariants", () => {

    describe("checkInvariants()", () => {

        it("passes on a fresh game of each seat count", () => {
            for (const config of [oneOnOne(), threeSolo(), twoByTwo(), threeByTwo()]) {
                expect(checkInvariants(fresh(config)).succeeded).toBeTrue();
            }
        });


        it("fails when a card is duplicated", () => {
            const game = fresh(twoByTwo());
            expect(failure({ ...game, drawPile: [...game.drawPile, Card.rightOfWay] })).toContain("Right of Way");
        });


        it("fails when a card is missing", () => {
            const game = fresh(twoByTwo());
            const index = game.drawPile.indexOf(Card.drivingAce);
            const drawPile = game.drawPile.filter((_, i) => i !== index);
            expect(failure({ ...game, drawPile })).toContain("Driving Ace");
        });


        it("fails on a hand of 8", () => {
            const game = fresh(twoByTwo());
            const [card, ...drawPile] = game.drawPile;
            const players = game.players.map((p, i) => i === 0 ? { ...p, hand: [...p.hand, card!] } : p);
            expect(failure({ ...game, players, drawPile })).toContain("8 cards");
        });


        it("fails when a player who is not on turn holds 7 cards", () => {
            const game = fresh(twoByTwo());
            const [card, ...drawPile] = game.drawPile;
            const players = game.players.map((p, i) => i === 1 ? { ...p, hand: [...p.hand, card!] } : p);
            expect(failure({ ...game, players, drawPile })).toContain("Bob");
        });


        it("fails on a phase naming an unknown player", () => {
            const game = fresh(twoByTwo());
            const stranger = PlayerId.create();
            expect(failure({ ...game, phase: { kind: "Turn", player: stranger } })).toContain(stranger);
        });


        it("fails when the team count does not match the config", () => {
            const game = fresh(twoByTwo());
            expect(failure({ ...game, teams: game.teams.slice(0, 1) })).toContain("its config has 2");
        });


        it("fails when Extension is Available in a 4-seat game", () => {
            expect(failure({ ...fresh(twoByTwo()), extension: { kind: "Available" } })).toContain("Extension");
        });


        it("fails when Extension is NotApplicable in a 2-seat game", () => {
            expect(failure({ ...fresh(oneOnOne()), extension: { kind: "NotApplicable" } })).toContain("Extension");
        });


        it("fails when Called names a missing team", () => {
            const game = fresh(oneOnOne());
            expect(failure({ ...game, extension: { kind: "Called", caller: 2 as TeamIndex } })).toContain("team 2");
        });


        it("fails on an ExtensionOffer while Extension is not Available", () => {
            const game = fresh(twoByTwo());
            const phase = { kind: "ExtensionOffer", decider: game.players[0]!.seat.id, team: 0 as TeamIndex } as const;
            const players = game.players.map((p, i) => i === 0 ? { ...p, hand: p.hand.slice(1) } : p);
            const discardPile = [game.players[0]!.hand[0]!];
            expect(failure({ ...game, phase, players, discardPile })).toContain("Extension");
        });


        it("fails on a zone beyond the current trip distance", () => {
            const zone: DrivingZone = { ...rolling, distance: Array.from({ length: 8 }, () => Card.dist100) };
            const called = buildGame({
                config:    oneOnOne(),
                zones:     [zone, newZone()],
                extension: { kind: "Called", caller: 0 as TeamIndex },
            });
            expect(checkInvariants(called).succeeded).toBeTrue();
            expect(failure({ ...called, extension: { kind: "Available" } })).toContain("700");
        });


        it("fails on a zone with three 200s", () => {
            const zone: DrivingZone = { ...rolling, distance: [Card.dist200, Card.dist200] };
            const game = buildGame({ config: twoByTwo(), zones: [zone, newZone()] });
            const index = game.discardPile.indexOf(Card.dist200);
            const discardPile = game.discardPile.filter((_, i) => i !== index);
            const teams = game.teams.map((t, i) => i === 0 ?
                { ...t, zone: { ...zone, distance: [...zone.distance, Card.dist200] } } :
                t);
            expect(failure({ ...game, teams, discardPile })).toContain("200");
        });


        it("counts the hazard in flight", () => {
            const game = fresh(twoByTwo());
            const [card, ...hand] = game.players[0]!.hand;
            const players = game.players.map((p, i) => i === 0 ? { ...p, hand } : p);
            const phase = {
                kind:     "HazardIncoming",
                attacker: game.players[0]!.seat.id,
                hazard:   Card.speedLimit,
                target:   1 as TeamIndex,
            } as const;
            // The in-flight Speed Limit is an extra card unless one is taken away.
            expect(failure({ ...game, players, phase, discardPile: [card!] })).toContain("Speed Limit");
        });


        it("fails when Right of Way is in play but the car needs a Roll", () => {
            const zone: DrivingZone = { ...rolling, safeties: [{ card: Card.rightOfWay, coupFourre: false }] };
            const game = buildGame({ config: twoByTwo(), zones: [zone, newZone()] });
            const teams = game.teams.map((t, i) => i === 0 ? { ...t, zone: { ...zone, status: newZone().status } } : t);
            expect(failure({ ...game, teams })).toContain("cannot need a Roll");
        });


        it("fails on an unknown card", () => {
            const game = fresh(twoByTwo());
            const drawPile = [...game.drawPile, "Banana" as Card];
            expect(failure({ ...game, drawPile })).toContain("but a Standard deck has 106");
        });


        it("fails on a hazard in flight against the attacker's own team", () => {
            const config = oneOnOne();
            const attacker = config.teams[0]![0]!.id;
            const game = buildGame({
                config,
                zones: [rolling, rolling],
                phase: { kind: "HazardIncoming", attacker, hazard: Card.stop, target: 1 as TeamIndex },
            });
            const phase = { ...game.phase, target: 0 as TeamIndex } as Game["phase"];
            expect(failure({ ...game, phase })).toContain("cannot be in flight");
        });


        it("fails on a hazard in flight that can never land", () => {
            const cases = [
                ["TargetNotMoving", "not moving"],
                ["TargetProtected", "Right of Way"],
                ["TargetAlreadySpeedLimited", "already has a Speed Limit"],
            ] as const;
            for (const [why, explained] of cases) {
                const problem = failure(unlandableHazard(why));
                expect(problem).withContext(why).toContain("cannot land");
                expect(problem).withContext(why).toContain(explained);
            }
        });


        it("fails on an ExtensionOffer for a team other than the decider's", () => {
            const config = oneOnOne();
            const decider = config.teams[0]![0]!.id;
            const game = buildGame({
                config,
                zones: [at700, newZone()],
                phase: { kind: "ExtensionOffer", decider, team: 0 as TeamIndex },
            });
            const phase = { ...game.phase, team: 1 as TeamIndex } as Game["phase"];
            expect(failure({ ...game, phase })).toContain("decider is on team 0");
        });


        it("fails on an ExtensionOffer whose team is not at 700 miles", () => {
            const config = oneOnOne();
            const decider = config.teams[0]![0]!.id;
            const phase = { kind: "ExtensionOffer", decider, team: 0 as TeamIndex } as const;
            expect(() => buildGame({ config, phase })).toThrowError(/0 miles/);
        });


        it("fails when Extension was called by a team below 700 miles", () => {
            const extension = { kind: "Called", caller: 1 as TeamIndex } as const;
            const called = buildGame({ config: oneOnOne(), zones: [newZone(), at700], extension });
            expect(failure({ ...called, extension: { kind: "Called", caller: 0 as TeamIndex } }))
            .toContain("0 miles");
        });


        it("fails on a team at 700 miles while Extension is Available and no offer is open", () => {
            const config = oneOnOne();
            const decider = config.teams[0]![0]!.id;
            const offer = buildGame({
                config,
                hands: [[Card.roll], []],
                zones: [at700, newZone()],
                phase: { kind: "ExtensionOffer", decider, team: 0 as TeamIndex },
            });
            expect(failure({ ...offer, phase: { kind: "Turn", player: decider } })).toContain("700");
        });


        it("fails on a team at the trip distance while the race is in play", () => {
            expect(() => buildGame({ config: twoByTwo(), zones: [at1000, newZone()] }))
            .toThrowError(/1000-mile trip/);
            expect(() => buildGame({
                config:    oneOnOne(),
                zones:     [at1000, newZone()],
                extension: { kind: "Called", caller: 0 as TeamIndex },
            })).toThrowError(/1000-mile trip/);
        });


        it("fails on an Extension offer while another team is also at 700 miles", () => {
            const config = oneOnOne();
            const decider = config.teams[0]![0]!.id;
            const phase = { kind: "ExtensionOffer", decider, team: 0 as TeamIndex } as const;
            expect(checkInvariants(buildGame({ config, zones: [at700, newZone()], phase })).succeeded).toBeTrue();
            expect(() => buildGame({ config, zones: [at700, at700], phase })).toThrowError(/Team 1/);
        });


        it("allows a team at 700 after Extension is called, and at the trip distance once the race is over", () => {
            const called = buildGame({
                config:    oneOnOne(),
                zones:     [at700, at700],
                extension: { kind: "Called", caller: 0 as TeamIndex },
            });
            expect(checkInvariants(called).succeeded).toBeTrue();
            const outcome: RaceOutcome = {
                kind:            "TripCompleted",
                team:            0 as TeamIndex,
                delayedAction:   false,
                extensionCaller: null,
            };
            const zones = [at1000, newZone()];
            const scores = scoreRace(standardScoring, zones, outcome, [Points.zero, Points.zero]);
            const phase = { kind: "RaceOver", result: { outcome, scores } } as const;
            expect(checkInvariants(buildGame({ config: twoByTwo(), zones, phase })).succeeded).toBeTrue();
        });


        it("fails on a race result naming a team that does not exist", () => {
            const team2 = 2 as TeamIndex;
            const cases: ReadonlyArray<[RaceOutcome, string]> = [
                [{ kind: "TripCompleted", team: team2, delayedAction: false, extensionCaller: null }, "trip"],
                [{ kind: "Exhausted", winner: team2, extensionCaller: null }, "winner"],
                [
                    { kind: "TripCompleted", team: 0 as TeamIndex, delayedAction: false, extensionCaller: team2 },
                    "Extension caller team 2",
                ],
            ];
            for (const [outcome, problem] of cases) {
                const [valid, hostile] = raceOverWith(outcome);
                expect(checkInvariants(valid).succeeded).toBeTrue();
                expect(failure(hostile)).withContext(problem).toContain("team 2");
                expect(failure(hostile)).withContext(problem).toContain(problem);
            }
        });


        it("fails on a race result whose Extension caller differs from the game's", () => {
            const caller = 0 as TeamIndex;
            const noCaller: RaceOutcome = { kind: "Exhausted", winner: "Tie", extensionCaller: null };
            const team1Called: RaceOutcome = { ...noCaller, extensionCaller: 1 as TeamIndex };
            expect(failure(raceOverWith(noCaller, { kind: "Called", caller })[1])).toContain("Extension caller");
            expect(failure(raceOverWith(team1Called)[1])).toContain("Extension caller");
            expect(checkInvariants(raceOverWith({ ...noCaller, extensionCaller: caller }, {
                kind: "Called",
                caller,
            })[1]).succeeded).toBeTrue();
        });


        it("fails when the player on turn holds no cards", () => {
            const game = fresh(oneOnOne());
            const hand = game.players[0]!.hand;
            const players = game.players.map((p, i) => i === 0 ? { ...p, hand: [] } : p);
            expect(failure({ ...game, players, discardPile: [...game.discardPile, ...hand] }))
            .toContain("holds no cards");
        });


        it("returns a failure instead of throwing on hostile input", () => {
            const game = fresh(twoByTwo());
            const hostile: ReadonlyArray<Game> = [
                { ...game, config: { ...game.config, teams: [] } },
                { ...game, players: game.players.map((p, i) => i === 0 ? { ...p, team: 5 as TeamIndex } : p) },
                { ...game, players: [] },
                { ...game, teams: [] },
                { ...game, raceNumber: 0 },
                { ...game, phase: { kind: "GameOver", winner: 7 as TeamIndex, result: { outcome: null!, scores: [] } } },
                {
                    ...game,
                    teams: game.teams.map((t) => ({
                        ...t,
                        zone: { ...t.zone, safeties: [{ card: Card.rightOfWay, coupFourre: false }] },
                    })),
                },
            ];
            for (const g of hostile) {
                expect(() => checkInvariants(g)).not.toThrow();
                expect(checkInvariants(g).succeeded).toBeFalse();
            }
        });

    });

});
