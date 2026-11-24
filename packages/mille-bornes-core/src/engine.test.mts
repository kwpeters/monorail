import { Card, type DistanceCard } from "./card.mjs";
import { type Applied, type PlayerCommand } from "./commands.mjs";
import { createDeck, type DeckKind } from "./deck.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import { applyPlayerCommand, createGame, dealRace } from "./engine.mjs";
import { type Game, type GameConfig, type RaceResult } from "./game.mjs";
import { type PlayerId, type TeamIndex } from "./ids.mjs";
import { checkInvariants } from "./invariants.mjs";
import { type Points } from "./points.mjs";
import { describeRejection, type Rejection } from "./rejection.mjs";
import {
    buildGame, deckFor, oneOnOne, seatFor, threeByTwo, threeSolo, twoByTwo, type GameParts
} from "./testHelpers.mjs";


const configs: ReadonlyArray<[number, () => GameConfig, DeckKind, number]> = [
    [2, oneOnOne, "Reduced", 88],
    [3, threeSolo, "Reduced", 82],
    [4, twoByTwo, "Standard", 81],
    [6, threeByTwo, "Standard", 69],
];


const ann = seatFor("Ann").id;
const bob = seatFor("Bob").id;
const cy = seatFor("Cy").id;
const team0 = 0 as TeamIndex;
const team1 = 1 as TeamIndex;


function deepFreeze<T>(value: T): T {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
    }
    return value;
}


/** Applies a command that must be accepted, checking the invariants after it. */
function play(g: Game, by: PlayerId, cmd: PlayerCommand): Applied {
    const applied = applyPlayerCommand(deepFreeze(g), by, cmd).throwIfFailed();
    const valid = checkInvariants(applied.game);
    expect(valid.succeeded).withContext(valid.error ?? "").toBeTrue();
    return applied;
}


/** Applies a command that must be refused. */
function refuse(g: Game, by: PlayerId, cmd: PlayerCommand): Rejection {
    return applyPlayerCommand(deepFreeze(g), by, cmd).throwIfSucceeded();
}


function six(card: Card): Array<Card> {
    return Array.from({ length: 6 }, () => card);
}


function rollingAt(...distance: Array<DistanceCard>): DrivingZone {
    return { ...newZone(), status: { kind: "Rolling" }, distance };
}


function resultOf(g: Game): RaceResult {
    if (g.phase.kind !== "RaceOver" && g.phase.kind !== "GameOver") {
        throw new Error(`The race is not over: the phase is ${g.phase.kind}.`);
    }
    return g.phase.result;
}


/** A 4-seat game on Ann's turn with Ann holding `hand` and two cards to draw. */
function gameWhereAnnHolds(hand: ReadonlyArray<Card>, parts: Partial<GameParts> = {}): Game {
    return buildGame({
        config:   twoByTwo(),
        hands:    [hand, six(Card.roll), six(Card.dist50), six(Card.gasoline)],
        drawPile: [Card.dist200, Card.spareTire],
        ...parts,
    });
}


const annHand = [
    Card.roll, Card.dist75, Card.dist100, Card.drivingAce, Card.accident, Card.dist25, Card.repairs,
];


/** A 4-seat game where Ann's team is at 900 miles and Ann holds a 100. */
function annAt900(parts: Partial<GameParts> = {}): Game {
    return gameWhereAnnHolds(annHand, {
        zones:  [rollingAt(...Array.from({ length: 9 }, () => Card.dist100)), newZone()],
        points: [1200, 900],
        ...parts,
    });
}


/** A 2-seat game where Ann is at 650 miles and holds a 100 and a 50. */
function annAt650(parts: Partial<GameParts> = {}): Game {
    return buildGame({
        config: oneOnOne(),
        hands:  [
            [Card.dist100, Card.dist50, Card.roll, Card.dist25, Card.dist75, Card.repairs, Card.stop],
            six(Card.roll),
        ],
        zones: [
            rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist50),
            newZone(),
        ],
        drawPile: [Card.spareTire],
        ...parts,
    });
}


/** A 4-seat game on Ann's turn with an empty draw pile. */
function exhaustedGame(
    hands: ReadonlyArray<ReadonlyArray<Card>>,
    zones: ReadonlyArray<DrivingZone> = [newZone(), newZone()]
): Game {
    return buildGame({ config: twoByTwo(), hands, zones, drawPile: [] });
}


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


    describe("applyPlayerCommand()", () => {

        it("Drive moves the card to the zone and passes the turn", () => {
            const g = gameWhereAnnHolds(annHand);
            const afterRoll = play(g, ann, { type: "Remedy", card: Card.roll });
            expect(afterRoll.events.map((e) => e.type)).toEqual(["RemedyPlayed", "TurnStarted", "CardDrawn"]);
            expect(afterRoll.game.phase).toEqual({ kind: "Turn", player: bob });
        });


        it("plays a Remedy onto the zone, discarding it", () => {
            const { game, events } = play(gameWhereAnnHolds(annHand), ann, { type: "Remedy", card: Card.roll });
            expect(game.teams[0]!.zone.status).toEqual({ kind: "Rolling" });
            expect(game.discardPile.at(-1)).toBe(Card.roll);
            expect(game.players[0]!.hand).toEqual(annHand.filter((c) => c !== Card.roll));
            expect(game.players[1]!.hand).toEqual([...six(Card.roll), Card.dist200]);
            expect(game.drawPile).toEqual([Card.spareTire]);
            expect(events).toEqual([
                { type: "RemedyPlayed", player: ann, card: Card.roll, team: team0 },
                { type: "TurnStarted", player: bob },
                { type: "CardDrawn", player: bob, card: Card.dist200 },
            ]);
        });


        it("plays a Drive onto the zone and passes the turn", () => {
            const g = gameWhereAnnHolds(annHand, { zones: [rollingAt(), newZone()] });
            const { game, events } = play(g, ann, { type: "Drive", card: Card.dist75 });
            expect(game.teams[0]!.zone.distance).toEqual([Card.dist75]);
            expect(game.players[0]!.hand).toEqual(annHand.filter((c) => c !== Card.dist75));
            expect(game.phase).toEqual({ kind: "Turn", player: bob });
            expect(events.map((e) => e.type)).toEqual(["DistancePlayed", "TurnStarted", "CardDrawn"]);
        });


        it("removes only one copy of a card held twice", () => {
            const hand = [Card.dist25, Card.dist25, Card.roll, Card.roll, Card.roll, Card.roll, Card.roll];
            const g = gameWhereAnnHolds(hand, { zones: [rollingAt(), newZone()] });
            const { game } = play(g, ann, { type: "Drive", card: Card.dist25 });
            expect(game.players[0]!.hand).toEqual(hand.slice(1));
        });


        it("refuses a player whose turn it is not", () => {
            expect(refuse(gameWhereAnnHolds(annHand), bob, { type: "Discard", card: Card.roll }))
            .toEqual({ reason: "NotYourTurn", current: seatFor("Ann").name });
        });


        it("refuses a card the player does not hold", () => {
            expect(refuse(gameWhereAnnHolds(annHand), ann, { type: "Discard", card: Card.stop }))
            .toEqual({ reason: "CardNotInHand", card: Card.stop });
        });


        it("cannot represent a Drive of a Roll", () => {
            // @ts-expect-error A Roll is not a distance card.
            const cmd: PlayerCommand = { type: "Drive", card: Card.roll };
            expect(cmd.type).toBe("Drive");
        });


        it("Discard puts the card on top of the discard pile and passes the turn", () => {
            const { game, events } = play(gameWhereAnnHolds(annHand), ann, { type: "Discard", card: Card.accident });
            expect(game.discardPile.at(-1)).toBe(Card.accident);
            expect(game.players[0]!.hand.length).toBe(6);
            expect(game.phase).toEqual({ kind: "Turn", player: bob });
            expect(events.map((e) => e.type)).toEqual(["CardDiscarded", "TurnStarted", "CardDrawn"]);
        });


        it("PlaySafety keeps the turn with the same player", () => {
            const cmd = { type: "PlaySafety", card: Card.drivingAce } as const;
            const { game, events } = play(gameWhereAnnHolds(annHand), ann, cmd);
            expect(events.map((e) => e.type)).toEqual(["SafetyPlayed", "TurnStarted", "CardDrawn"]);
            expect(game.phase).toEqual({ kind: "Turn", player: ann });
            expect(game.players[0]!.hand.length).toBe(7);
            expect(game.teams[0]!.zone.safeties).toEqual([{ card: Card.drivingAce, coupFourre: false }]);
        });


        it("surfaces zone rejections unchanged", () => {
            const g = gameWhereAnnHolds([...annHand.slice(1), Card.dist200], {
                zones:    [rollingAt(Card.dist200, Card.dist200), newZone()],
                drawPile: [Card.spareTire],
            });
            expect(refuse(g, ann, { type: "Drive", card: Card.dist200 })).toEqual({ reason: "TooManyTwoHundreds" });
        });


        it("keeps the invariants through a round of play", () => {
            let g = gameWhereAnnHolds(annHand);
            g = play(g, ann, { type: "Remedy", card: Card.roll }).game;
            g = play(g, bob, { type: "Remedy", card: Card.roll }).game;
            g = play(g, cy, { type: "Discard", card: Card.dist50 }).game;
            g = play(g, seatFor("Di").id, { type: "Discard", card: Card.gasoline }).game;
            expect(g.drawPile).toEqual([]);
            g = play(g, ann, { type: "Drive", card: Card.dist100 }).game;
            expect(g.phase).toEqual({ kind: "Turn", player: bob });
        });


        it("ends a Full game's race when a team completes 1,000 miles", () => {
            const before = annAt900();
            const { game, events } = play(before, ann, { type: "Drive", card: Card.dist100 });
            expect(game.phase.kind).toBe("RaceOver");
            const result = resultOf(game);
            expect(result.outcome)
            .toEqual({ kind: "TripCompleted", team: team0, delayedAction: false, extensionCaller: null });
            expect(result.scores.length).toBe(2);
            expect(result.scores.map((s) => s.broughtForward)).toEqual(before.teams.map((t) => t.points));
            expect(game.teams.map((t) => t.points)).toEqual(result.scores.map((s) => s.combinedTotal));
            expect(game.teams.map((t) => t.points)).toEqual([3400 as Points, 900 as Points]);
            expect(game.teams[0]!.zone.distance.length).toBe(10);
            expect(events.map((e) => e.type)).toEqual(["DistancePlayed", "RaceEnded"]);
            expect(events.at(-1)).toEqual({ type: "RaceEnded", result });
        });


        it("scores Delayed Action when the trip is completed with an empty draw pile", () => {
            const { game } = play(annAt900({ drawPile: [] }), ann, { type: "Drive", card: Card.dist100 });
            expect(resultOf(game).outcome)
            .toEqual({ kind: "TripCompleted", team: team0, delayedAction: true, extensionCaller: null });
            expect(game.teams[0]!.points).toBe(3700 as Points);
        });


        it("ends a Quick game when a team completes the trip", () => {
            const { game, events } = play(annAt900({ config: { ...twoByTwo(), length: "Quick" } }), ann, {
                type: "Drive",
                card: Card.dist100,
            });
            expect(game.phase).toEqual({ kind: "GameOver", winner: team0, result: resultOf(game) });
            expect(events.map((e) => e.type)).toEqual(["DistancePlayed", "RaceEnded", "GameEnded"]);
            expect(events.at(-1)).toEqual({ type: "GameEnded", winner: team0 });
        });


        it("refuses a 2-seat Drive that would overshoot 700", () => {
            expect(refuse(annAt650(), ann, { type: "Drive", card: Card.dist100 }))
            .toEqual({ reason: "WouldOvershoot", remaining: 50, trip: 700 } as Rejection);
        });


        it("offers Extension to a 2-seat player who reaches exactly 700", () => {
            const { game, events } = play(annAt650(), ann, { type: "Drive", card: Card.dist50 });
            expect(game.phase).toEqual({ kind: "ExtensionOffer", decider: ann, team: team0 });
            expect(game.extension).toEqual({ kind: "Available" });
            expect(events).toEqual([
                { type: "DistancePlayed", player: ann, card: Card.dist50, team: team0 },
                { type: "ExtensionOffered", player: ann, team: team0 },
            ]);
        });


        it("refuses other commands during an Extension offer", () => {
            const offered = play(annAt650(), ann, { type: "Drive", card: Card.dist50 }).game;
            const annName = seatFor("Ann").name;
            expect(refuse(offered, ann, { type: "Discard", card: Card.roll }))
            .toEqual({ reason: "ExtensionOfferOpen", decider: annName });
            expect(refuse(offered, bob, { type: "Remedy", card: Card.roll }))
            .toEqual({ reason: "ExtensionOfferOpen", decider: annName });
            expect(refuse(offered, bob, { type: "CallExtension" }))
            .toEqual({ reason: "NotTheCaller", decider: annName });
        });


        it("refuses an Extension decision during a turn", () => {
            expect(refuse(annAt650(), ann, { type: "CallExtension" })).toEqual({ reason: "NoExtensionOffer" });
            expect(refuse(annAt650(), ann, { type: "DeclineExtension" })).toEqual({ reason: "NoExtensionOffer" });
        });


        it("refuses malformed commands before anything else, without changing the game", () => {
            const g = deepFreeze(gameWhereAnnHolds(annHand));
            const snapshot = structuredClone(g);
            const malformed: ReadonlyArray<[string, unknown]> = [
                ["a Drive of a Roll", { type: "Drive", card: Card.roll }],
                ["a Remedy of a distance card", { type: "Remedy", card: Card.dist100 }],
                ["a PlaySafety of a remedy", { type: "PlaySafety", card: Card.roll }],
                ["a CoupFourre of a hazard", { type: "CoupFourre", card: Card.accident }],
                ["an Attack with a remedy", { type: "Attack", card: Card.roll, targetTeam: 1 }],
                ["an Attack on a team out of range", { type: "Attack", card: Card.accident, targetTeam: 2 }],
                ["an Attack on a negative team", { type: "Attack", card: Card.accident, targetTeam: -1 }],
                ["an Attack on a fractional team", { type: "Attack", card: Card.accident, targetTeam: 0.5 }],
                ["an Attack on a team given as text", { type: "Attack", card: Card.accident, targetTeam: "1" }],
                ["an Attack with no team", { type: "Attack", card: Card.accident }],
                ["a Discard of an unknown card", { type: "Discard", card: "Joker" }],
                ["a Discard with no card", { type: "Discard" }],
                ["an unknown command type", { type: "Cheat" }],
                ["a command with no type", {}],
                ["null", null],
                ["a string", "Drive"],
            ];
            for (const [name, cmd] of malformed) {
                for (const by of [ann, bob]) {
                    expect(refuse(g, by, cmd as PlayerCommand)).withContext(name)
                    .toEqual({ reason: "MalformedCommand" });
                }
            }
            expect(g).toEqual(snapshot);
        });


        it("ends the race with the Extension caller when a team completes 1,000 miles", () => {
            for (const caller of [team0, team1]) {
                const g = buildGame({
                    config:    oneOnOne(),
                    hands:     [[Card.dist100], six(Card.roll)],
                    zones:     [rollingAt(...Array.from({ length: 9 }, () => Card.dist100)), newZone()],
                    drawPile:  [Card.spareTire],
                    extension: { kind: "Called", caller },
                });
                const { game } = play(g, ann, { type: "Drive", card: Card.dist100 });
                expect(resultOf(game).outcome).withContext(`caller ${caller}`)
                .toEqual({ kind: "TripCompleted", team: team0, delayedAction: false, extensionCaller: caller });
            }
        });


        it("opens no offer when a team reaches 700 after Extension is called", () => {
            const { game, events } = play(annAt650({ extension: { kind: "Called", caller: team1 } }), ann, {
                type: "Drive",
                card: Card.dist50,
            });
            expect(game.phase).toEqual({ kind: "Turn", player: bob });
            expect(events.map((e) => e.type)).toEqual(["DistancePlayed", "TurnStarted", "CardDrawn"]);
        });


        describe("when the draw pile is exhausted", () => {

            it("starts the next turn without a draw", () => {
                const g = exhaustedGame([[Card.roll, Card.stop], [Card.roll], [Card.roll], [Card.roll]]);
                const { game, events } = play(g, ann, { type: "Discard", card: Card.stop });
                expect(events).toEqual([
                    { type: "CardDiscarded", player: ann, card: Card.stop },
                    { type: "TurnStarted", player: bob },
                ]);
                expect(game.players[1]!.hand).toEqual([Card.roll]);
            });


            it("skips players with empty hands", () => {
                const g = exhaustedGame([[Card.roll, Card.stop], [], [Card.roll], []]);
                expect(play(g, ann, { type: "Discard", card: Card.stop }).game.phase)
                .toEqual({ kind: "Turn", player: cy });
            });


            it("comes back to the same player when nobody else holds cards", () => {
                const g = exhaustedGame([[Card.roll, Card.stop], [], [], []]);
                expect(play(g, ann, { type: "Discard", card: Card.stop }).game.phase)
                .toEqual({ kind: "Turn", player: ann });
            });


            it("passes on after a Safety that empties the player's hand", () => {
                const g = exhaustedGame([[Card.drivingAce], [], [Card.roll], []]);
                const { game, events } = play(g, ann, { type: "PlaySafety", card: Card.drivingAce });
                expect(events.map((e) => e.type)).toEqual(["SafetyPlayed", "TurnStarted"]);
                expect(game.phase).toEqual({ kind: "Turn", player: cy });
            });


            it("ends the race as Exhausted when the last card is played", () => {
                const g = exhaustedGame(
                    [[Card.dist25], [], [], []],
                    [rollingAt(Card.dist100), rollingAt(Card.dist200)]
                );
                const { game, events } = play(g, ann, { type: "Drive", card: Card.dist25 });
                expect(resultOf(game).outcome).toEqual({ kind: "Exhausted", winner: team1, extensionCaller: null });
                expect(game.phase.kind).toBe("RaceOver");
                expect(events.map((e) => e.type)).toEqual(["DistancePlayed", "RaceEnded"]);
            });


            it("ends the race as a Tie when the teams have equal miles", () => {
                const g = exhaustedGame(
                    [[Card.dist25], [], [], []],
                    [rollingAt(Card.dist100, Card.dist75), rollingAt(Card.dist200)]
                );
                const { game } = play(g, ann, { type: "Drive", card: Card.dist25 });
                expect(resultOf(game).outcome).toEqual({ kind: "Exhausted", winner: "Tie", extensionCaller: null });
            });


            it("ends the race as Exhausted when the last card is a Safety", () => {
                const g = exhaustedGame([[Card.drivingAce], [], [], []], [rollingAt(Card.dist100), newZone()]);
                const { game, events } = play(g, ann, { type: "PlaySafety", card: Card.drivingAce });
                expect(events.map((e) => e.type)).toEqual(["SafetyPlayed", "RaceEnded"]);
                expect(resultOf(game).outcome).toEqual({ kind: "Exhausted", winner: team0, extensionCaller: null });
            });


            it("records the Extension caller when the race ends Exhausted", () => {
                const g = buildGame({
                    config:    oneOnOne(),
                    hands:     [[Card.dist25], []],
                    zones:     [rollingAt(Card.dist100), newZone()],
                    extension: { kind: "Called", caller: team1 },
                });
                const { game } = play(g, ann, { type: "Drive", card: Card.dist25 });
                expect(resultOf(game).outcome).toEqual({ kind: "Exhausted", winner: team0, extensionCaller: team1 });
            });

        });

    });

});
