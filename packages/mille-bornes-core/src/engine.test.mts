import { Card } from "./card.mjs";
import { createDeck, type DeckKind } from "./deck.mjs";
import { newZone } from "./drivingZone.mjs";
import { createGame, dealRace } from "./engine.mjs";
import { type GameConfig } from "./game.mjs";
import { type TeamIndex } from "./ids.mjs";
import { checkInvariants } from "./invariants.mjs";
import { type Points } from "./points.mjs";
import { describeRejection } from "./rejection.mjs";
import { buildGame, deckFor, oneOnOne, threeByTwo, threeSolo, twoByTwo } from "./testHelpers.mjs";


const configs: ReadonlyArray<[number, () => GameConfig, DeckKind, number]> = [
    [2, oneOnOne, "Reduced", 88],
    [3, threeSolo, "Reduced", 82],
    [4, twoByTwo, "Standard", 81],
    [6, threeByTwo, "Standard", 69],
];


describe("engine", () => {

    describe("createGame()", () => {

        it("createGame deals 6 cards each in turn order and auto-draws for the first player", () => {
            const { game, events } = createGame(twoByTwo(), createDeck()).throwIfFailed();
            expect(game.players.map((p): string => p.seat.name)).toEqual(["Ann", "Bob", "Cy", "Di"]);
            expect(game.players.map((p) => p.hand.length)).toEqual([7, 6, 6, 6]);
            expect(game.drawPile.length).toBe(106 - 24 - 1);
            expect(game.extension).toEqual({ kind: "NotApplicable" });
            expect(game.phase).toEqual({ kind: "Turn", player: game.players[0]!.seat.id });
            expect(events.map((e) => e.type)).toEqual(["RaceDealt", "TurnStarted", "CardDrawn"]);
        });


        it("leaves the expected draw pile and Extension state for each seat count", () => {
            for (const [seats, config, deck, drawPile] of configs) {
                const { game } = createGame(config(), createDeck(deck)).throwIfFailed();
                expect(game.drawPile.length).withContext(`${seats} seats`).toBe(drawPile);
                expect(game.extension).withContext(`${seats} seats`)
                .toEqual({ kind: seats === 4 ? "NotApplicable" : "Available" });
                expect(game.raceNumber).toBe(1);
                expect(game.discardPile).toEqual([]);
                expect(checkInvariants(game).succeeded).withContext(`${seats} seats`).toBeTrue();
            }
        });


        it("fails when the deck does not match the variant", () => {
            const wrongDeck = describeRejection({ reason: "WrongDeck" });
            expect(createGame(oneOnOne(), createDeck("Standard")).throwIfSucceeded()).toBe(wrongDeck);
            expect(createGame(twoByTwo(), createDeck("Reduced")).throwIfSucceeded()).toBe(wrongDeck);
        });


        it("deals hands from the front of the deck, then draws the next card", () => {
            const hands = [
                [Card.roll, Card.roll, Card.dist25, Card.dist50, Card.dist75, Card.dist100],
                [Card.stop, Card.stop, Card.accident, Card.repairs, Card.gasoline, Card.spareTire],
            ];
            const { game, events } = createGame(oneOnOne(), deckFor(hands, [Card.dist200], "Reduced")).throwIfFailed();
            expect(game.players[0]!.hand).toEqual([...hands[0]!, Card.dist200]);
            expect(game.players[1]!.hand).toEqual(hands[1]!);
            expect(events[2]).toEqual({ type: "CardDrawn", player: game.players[0]!.seat.id, card: Card.dist200 });
        });


        it("emits the race number and the first player's turn", () => {
            const { game, events } = createGame(twoByTwo(), createDeck()).throwIfFailed();
            const ann = game.players[0]!.seat.id;
            expect(events.slice(0, 2)).toEqual([{ type: "RaceDealt", race: 1 }, { type: "TurnStarted", player: ann }]);
        });


        it("rejects invalid configs", () => {
            const config = twoByTwo();
            const robots = { ...config, teams: config.teams.map((team) => team.map((s) => ({ ...s, kind: "Robot" as const }))) };
            expect(createGame(robots, createDeck()).throwIfSucceeded()).toContain("human");
        });

    });


    describe("dealRace()", () => {

        it("deals a new race onto existing teams, keeping points", () => {
            const config = twoByTwo();
            const before = buildGame({
                config,
                zones:  [{ ...newZone(), distance: [Card.dist100] }, newZone()],
                points: [1200, 900],
            });
            const { game } = dealRace(config, before.players, before.teams, createDeck(), 2).throwIfFailed();
            expect(game.teams.map((t) => t.points)).toEqual([1200 as Points, 900 as Points]);
            expect(game.teams.map((t) => t.zone)).toEqual([newZone(), newZone()]);
            expect(game.discardPile).toEqual([]);
            expect(game.raceNumber).toBe(2);
            expect(checkInvariants(game).succeeded).toBeTrue();
        });


        it("resets Extension for the new race", () => {
            const config = oneOnOne();
            const before = buildGame({ config, extension: { kind: "Called", caller: 0 as TeamIndex } });
            const { game } = dealRace(config, before.players, before.teams, createDeck("Reduced"), 2).throwIfFailed();
            expect(game.extension).toEqual({ kind: "Available" });
        });


        it("advances the first player one seat per race", () => {
            const config = twoByTwo();
            const { game: first } = createGame(config, createDeck()).throwIfFailed();
            for (const [race, seat] of [[1, 0], [2, 1], [4, 3], [5, 0]] as const) {
                const { game, events } = dealRace(config, first.players, first.teams, createDeck(), race)
                .throwIfFailed();
                const firstPlayer = game.players[seat]!;
                expect(game.phase).withContext(`race ${race}`).toEqual({ kind: "Turn", player: firstPlayer.seat.id });
                expect(game.players.map((p) => p.hand.length))
                .toEqual(game.players.map((_, i) => i === seat ? 7 : 6));
                expect(events).toEqual([
                    { type: "RaceDealt", race },
                    { type: "TurnStarted", player: firstPlayer.seat.id },
                    { type: "CardDrawn", player: firstPlayer.seat.id, card: createDeck()[24]! },
                ]);
            }
        });


        it("deals hand i to players[i] in every race", () => {
            const config = oneOnOne();
            const hands = [
                [Card.dist25, Card.dist25, Card.dist25, Card.dist25, Card.dist25, Card.dist25],
                [Card.dist50, Card.dist50, Card.dist50, Card.dist50, Card.dist50, Card.dist50],
            ];
            const { game: first } = createGame(config, createDeck("Reduced")).throwIfFailed();
            const deck = deckFor(hands, [Card.roll], "Reduced");
            const { game } = dealRace(config, first.players, first.teams, deck, 2).throwIfFailed();
            expect(game.players[0]!.hand).toEqual(hands[0]!);
            expect(game.players[1]!.hand).toEqual([...hands[1]!, Card.roll]);
        });


        it("rejects a deck that does not match the variant", () => {
            const config = oneOnOne();
            const { game: first } = createGame(config, createDeck("Reduced")).throwIfFailed();
            expect(dealRace(config, first.players, first.teams, createDeck("Standard"), 2).throwIfSucceeded())
            .toEqual({ reason: "WrongDeck" });
        });

    });

});
