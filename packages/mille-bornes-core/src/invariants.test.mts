import { Card } from "./card.mjs";
import { createDeck } from "./deck.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import { createGame } from "./engine.mjs";
import { type Game, type GameConfig } from "./game.mjs";
import { PlayerId, type TeamIndex } from "./ids.mjs";
import { checkInvariants } from "./invariants.mjs";
import { buildGame, oneOnOne, threeByTwo, threeSolo, twoByTwo } from "./testHelpers.mjs";


function fresh(config: GameConfig): Game {
    const deck = createDeck(config.teams.flat().length < 4 ? "Reduced" : "Standard");
    return createGame(config, deck).throwIfFailed().game;
}


function failure(game: Game): string {
    return checkInvariants(game).throwIfSucceeded();
}


const rolling: DrivingZone = { ...newZone(), status: { kind: "Rolling" } };


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
                hazard:   Card.stop,
                target:   1 as TeamIndex,
            } as const;
            // The in-flight Stop is an extra card unless one is taken away.
            expect(failure({ ...game, players, phase, discardPile: [card!] })).toContain("Stop");
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
                phase: { kind: "HazardIncoming", attacker, hazard: Card.stop, target: 1 as TeamIndex },
            });
            const phase = { ...game.phase, target: 0 as TeamIndex } as Game["phase"];
            expect(failure({ ...game, phase })).toContain("cannot be in flight");
        });


        it("fails on an ExtensionOffer for a team other than the decider's", () => {
            const config = oneOnOne();
            const decider = config.teams[0]![0]!.id;
            const game = buildGame({ config, phase: { kind: "ExtensionOffer", decider, team: 0 as TeamIndex } });
            const phase = { ...game.phase, team: 1 as TeamIndex } as Game["phase"];
            expect(failure({ ...game, phase })).toContain("decider is on team 0");
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
