import { type Result } from "@repo/depot/result";
import { Card, type DistanceCard, type HazardCard } from "./card.mjs";
import { type Applied, type PlayerCommand, type SystemCommand } from "./commands.mjs";
import { createDeck, type DeckKind, type ShuffledDeck } from "./deck.mjs";
import { newZone, zoneMiles, type DrivingZone } from "./drivingZone.mjs";
import { applyPlayerCommand, applySystemCommand, createGame, dealRace } from "./engine.mjs";
import { type Game, type GameConfig, type RaceResult } from "./game.mjs";
import { type PlayerId, type TeamIndex } from "./ids.mjs";
import { checkInvariants } from "./invariants.mjs";
import { type Miles } from "./miles.mjs";
import { type Points } from "./points.mjs";
import { describeRejection, type Rejection } from "./rejection.mjs";
import { contextFromGame } from "./rules.mjs";
import {
    buildGame, deckFor, deepFreeze, oneOnOne, seatFor, threeByTwo, threeSolo, twoByTwo, type GameParts
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
const di = seatFor("Di").id;
const team0 = 0 as TeamIndex;
const team1 = 1 as TeamIndex;


/** Unwraps an accepted command, checking the invariants after it. */
function checked(result: Result<Applied, Rejection>): Applied {
    const applied = result.throwIfFailed();
    const valid = checkInvariants(applied.game);
    expect(valid.succeeded).withContext(valid.error ?? "").toBeTrue();
    return applied;
}


/** Applies a command that must be accepted, checking the invariants after it. */
function play(g: Game, by: PlayerId, cmd: PlayerCommand): Applied {
    return checked(applyPlayerCommand(deepFreeze(g), by, cmd));
}


/** Applies a command that must be refused. */
function refuse(g: Game, by: PlayerId, cmd: PlayerCommand): Rejection {
    return applyPlayerCommand(deepFreeze(g), by, cmd).throwIfSucceeded();
}


const closeWindow: SystemCommand = { type: "CloseHazardWindow" };
const closeOffer: SystemCommand = { type: "CloseExtensionOffer" };
const callExtension: PlayerCommand = { type: "CallExtension" };
const declineExtension: PlayerCommand = { type: "DeclineExtension" };
const discardRoll: PlayerCommand = { type: "Discard", card: Card.roll };


/** Applies a system command (by default CloseHazardWindow) that must be accepted. */
function close(g: Game, cmd: SystemCommand = closeWindow): Applied {
    return checked(applySystemCommand(deepFreeze(g), deepFreeze(cmd)));
}


/** Applies a system command that must be refused. */
function refuseSystem(g: Game, cmd: SystemCommand): Rejection {
    return applySystemCommand(deepFreeze(g), deepFreeze(cmd)).throwIfSucceeded();
}


function six(card: Card): Array<Card> {
    return Array.from({ length: 6 }, () => card);
}


function rollingAt(...distance: Array<DistanceCard>): DrivingZone {
    return { ...newZone(), status: { kind: "Rolling" }, distance };
}


/** 700 miles, as an Extension caller must have. */
const annAt700 = rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist100);
/** 700 miles without 200s, so it fits beside another zone's. */
const bobAt700 = rollingAt(
    Card.dist75, Card.dist75, Card.dist75, Card.dist75, Card.dist100, Card.dist100, Card.dist100, Card.dist100
);


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


/** Ann plays a 50 in `annAt650()`, reaching exactly 700 and opening the offer. */
function annReaches700(parts: Partial<GameParts> = {}): Game {
    return play(annAt650(parts), ann, { type: "Drive", card: Card.dist50 }).game;
}


/**
 * A 3-seat game where Ann (650 miles) has just played a 50 to reach 700 and
 * holds the Extension offer.  Bob is at 600 and holds two 200s; Cy holds Rolls.
 */
function threeSeatOffer(parts: Partial<GameParts> = {}): Game {
    const g = buildGame({
        config: threeSolo(),
        hands:  [
            [Card.dist50, Card.roll, Card.dist25, Card.dist75, Card.repairs, Card.stop, Card.gasoline],
            [Card.dist200, Card.dist200, Card.roll, Card.roll, Card.roll, Card.roll],
            six(Card.roll),
        ],
        zones: [
            rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist75, Card.dist75),
            rollingAt(...Array.from({ length: 6 }, () => Card.dist100)),
            newZone(),
        ],
        ...parts,
    });
    return play(g, ann, { type: "Drive", card: Card.dist50 }).game;
}


/**
 * A 4-seat game on Ann's turn with both teams rolling.  Ann holds hazards;
 * Bob (Team 1) holds Puncture Proof and Right of Way; Di (Team 1) holds
 * Driving Ace.
 */
function attackGame(parts: Partial<GameParts> = {}): Game {
    const rolls = (n: number): Array<Card> => Array.from({ length: n }, () => Card.roll);
    return buildGame({
        config: twoByTwo(),
        hands:  [
            [
                Card.accident, Card.flatTire, Card.stop, Card.speedLimit, Card.outOfGas, Card.dist25,
                Card.roll,
            ],
            [Card.punctureProof, Card.rightOfWay, ...rolls(4)],
            six(Card.dist50),
            [Card.drivingAce, ...rolls(5)],
        ],
        zones:    [rollingAt(), rollingAt()],
        drawPile: [Card.dist200, Card.spareTire],
        ...parts,
    });
}


/** Ann attacks Team 1 with a hazard in `attackGame()`, opening the window. */
function annAttacks(hazard: HazardCard, parts: Partial<GameParts> = {}): Game {
    return play(attackGame(parts), ann, { type: "Attack", card: hazard, targetTeam: team1 }).game;
}


/** A 4-seat game on Ann's turn with an empty draw pile. */
function exhaustedGame(
    hands: ReadonlyArray<ReadonlyArray<Card>>,
    zones: ReadonlyArray<DrivingZone> = [newZone(), newZone()]
): Game {
    return buildGame({ config: twoByTwo(), hands, zones, drawPile: [] });
}


/** A 2-seat game where Ann has completed the trip and declined Extension: RaceOver. */
function annWinsRace(parts: Partial<GameParts> = {}): Game {
    return play(annReaches700(parts), ann, declineExtension).game;
}


const startRace = (deck: ShuffledDeck): SystemCommand => ({ type: "StartNextRace", deck });


/** A 4-seat game where Ann has completed the 1,000 miles: RaceOver. */
function annWinsFourSeatRace(): Game {
    return play(annAt900(), ann, { type: "Drive", card: Card.dist100 }).game;
}


/**
 * A 6-seat game (3 teams of 2) where Ann reaches 700 and declines Extension
 * while the other teams are in `others`: RaceOver.
 */
function threeTeamWin(others: [DrivingZone, DrivingZone]): Game {
    const g = buildGame({
        config: threeByTwo(),
        hands:  [
            [Card.dist50, Card.roll, Card.dist25, Card.dist75, Card.repairs, Card.stop, Card.gasoline],
            six(Card.roll), six(Card.dist50), six(Card.dist75), six(Card.spareTire),
            six(Card.endOfSpeedLimit),
        ],
        zones:    [rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist50), ...others],
        drawPile: [Card.gasoline],
    });
    const offered = play(g, ann, { type: "Drive", card: Card.dist50 }).game;
    return play(offered, ann, declineExtension).game;
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
            const before = buildGame({
                config,
                zones:     [annAt700, newZone()],
                extension: { kind: "Called", caller: 0 as TeamIndex },
            });
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
                    config: oneOnOne(),
                    hands:  [[Card.dist100], six(Card.roll)],
                    zones:  [
                        rollingAt(...Array.from({ length: 9 }, () => Card.dist100)),
                        rollingAt(Card.dist200, Card.dist200, Card.dist75, Card.dist75, Card.dist75, Card.dist75),
                    ],
                    drawPile:  [Card.spareTire],
                    extension: { kind: "Called", caller },
                });
                const { game } = play(g, ann, { type: "Drive", card: Card.dist100 });
                expect(resultOf(game).outcome).withContext(`caller ${caller}`)
                .toEqual({ kind: "TripCompleted", team: team0, delayedAction: false, extensionCaller: caller });
            }
        });


        it("opens no offer when a team reaches 700 after Extension is called", () => {
            const g = annAt650({
                zones:     [rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist50), bobAt700],
                extension: { kind: "Called", caller: team1 },
            });
            const { game, events } = play(g, ann, { type: "Drive", card: Card.dist50 });
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
                    zones:     [annAt700, bobAt700],
                    extension: { kind: "Called", caller: team1 },
                });
                const { game } = play(g, ann, { type: "Drive", card: Card.dist25 });
                expect(resultOf(game).outcome).toEqual({ kind: "Exhausted", winner: team0, extensionCaller: team1 });
            });

        });


        describe("attacks and Coup Fourré", () => {

            it("opens the hazard window without changing any zone", () => {
                const before = attackGame();
                const { game, events } = play(before, ann, {
                    type:       "Attack",
                    card:       Card.accident,
                    targetTeam: team1,
                });
                expect(game.phase).toEqual({
                    kind:     "HazardIncoming",
                    attacker: ann,
                    hazard:   Card.accident,
                    target:   team1,
                });
                expect(game.players[0]!.hand.length).toBe(6);
                expect(game.teams).toEqual(before.teams);
                expect(events).toEqual([
                    { type: "HazardPlayed", player: ann, card: Card.accident, targetTeam: team1 },
                ]);
            });


            it("refuses every other player command while the window is open", () => {
                const g = annAttacks(Card.accident);
                for (const by of [ann, bob, cy, di]) {
                    expect(refuse(g, by, { type: "Drive", card: Card.dist25 })).withContext(by)
                    .toEqual({ reason: "WindowOpen" });
                }
            });


            it("refuses an attack on the attacker's own team", () => {
                expect(refuse(attackGame(), ann, { type: "Attack", card: Card.accident, targetTeam: team0 }))
                .toEqual({ reason: "CannotAttackOwnTeam" });
            });


            it("refuses an attack on a protected team", () => {
                const safeties = [{ card: Card.extraTank, coupFourre: false }];
                const g = attackGame({ zones: [rollingAt(), { ...rollingAt(), safeties }] });
                expect(refuse(g, ann, { type: "Attack", card: Card.outOfGas, targetTeam: team1 }))
                .toEqual({ reason: "TargetProtected", safety: Card.extraTank });
            });


            it("lets the victim answer with a Coup Fourré and take the turn", () => {
                const g = annAttacks(Card.flatTire);
                const { game, events } = play(g, bob, { type: "CoupFourre", card: Card.punctureProof });
                expect(game.teams[1]!.zone.status).toEqual({ kind: "Rolling" });
                expect(game.teams[1]!.zone.safeties).toEqual([{ card: Card.punctureProof, coupFourre: true }]);
                expect(game.discardPile.at(-1)).toBe(Card.flatTire);
                expect(game.players[1]!.hand.length).toBe(7);
                expect(game.phase).toEqual({ kind: "Turn", player: bob });
                expect(events).toEqual([
                    {
                        type:   "CoupFourrePlayed",
                        player: bob,
                        card:   Card.punctureProof,
                        team:   team1,
                        hazard: Card.flatTire,
                    },
                    { type: "CardDrawn", player: bob, card: Card.dist200 },
                    { type: "TurnStarted", player: bob },
                    { type: "CardDrawn", player: bob, card: Card.spareTire },
                ]);
                expect(play(game, bob, { type: "Discard", card: Card.roll }).game.phase)
                .toEqual({ kind: "Turn", player: cy });
            });


            it("lets the victim's teammate answer, skipping the players between", () => {
                const g = annAttacks(Card.accident);
                const { game } = play(g, di, { type: "CoupFourre", card: Card.drivingAce });
                expect(game.teams[1]!.zone.safeties).toEqual([{ card: Card.drivingAce, coupFourre: true }]);
                expect(game.players[3]!.hand.length).toBe(7);
                expect(game.phase).toEqual({ kind: "Turn", player: di });
                expect(play(game, di, { type: "Discard", card: Card.roll }).game.phase)
                .toEqual({ kind: "Turn", player: ann });
            });


            it("refuses a Coup Fourré from the other team", () => {
                const g = annAttacks(Card.accident);
                for (const by of [ann, cy]) {
                    expect(refuse(g, by, { type: "CoupFourre", card: Card.drivingAce })).withContext(by)
                    .toEqual({ reason: "NotOnTargetTeam" });
                }
            });


            it("refuses a Coup Fourré with a card not in hand", () => {
                expect(refuse(annAttacks(Card.accident), bob, { type: "CoupFourre", card: Card.drivingAce }))
                .toEqual({ reason: "CardNotInHand", card: Card.drivingAce });
            });


            it("refuses a Coup Fourré with the wrong safety", () => {
                expect(refuse(annAttacks(Card.flatTire), bob, { type: "CoupFourre", card: Card.rightOfWay }))
                .toEqual({ reason: "WrongSafetyForHazard", hazard: Card.flatTire, card: Card.rightOfWay });
            });


            it("lets Right of Way answer a Stop and a Speed Limit", () => {
                for (const hazard of [Card.stop, Card.speedLimit]) {
                    const { game } = play(annAttacks(hazard), bob, { type: "CoupFourre", card: Card.rightOfWay });
                    expect(game.teams[1]!.zone).withContext(hazard)
                    .toEqual({ ...rollingAt(), safeties: [{ card: Card.rightOfWay, coupFourre: true }] });
                    expect(game.discardPile.at(-1)).withContext(hazard).toBe(hazard);
                }
            });


            it("discards a Speed Limit showing when Right of Way answers a Stop", () => {
                const g = annAttacks(Card.stop, { zones: [rollingAt(), { ...rollingAt(), speedLimit: true }] });
                const { game } = play(g, bob, { type: "CoupFourre", card: Card.rightOfWay });
                expect(game.teams[1]!.zone.speedLimit).toBeFalse();
                expect(game.discardPile.slice(-2)).toEqual([Card.stop, Card.speedLimit]);
            });


            it("discards a Stop showing when Right of Way answers a Speed Limit", () => {
                const stopped: DrivingZone = { ...newZone(), status: { kind: "Hazard", hazard: Card.stop } };
                const g = annAttacks(Card.speedLimit, { zones: [rollingAt(), stopped] });
                const { game } = play(g, bob, { type: "CoupFourre", card: Card.rightOfWay });
                expect(game.teams[1]!.zone.status).toEqual({ kind: "Rolling" });
                expect(game.teams[1]!.zone.speedLimit).toBeFalse();
                expect(game.discardPile.slice(-2)).toEqual([Card.speedLimit, Card.stop]);
            });


            it("refuses a second Coup Fourré after the first", () => {
                const answered = play(annAttacks(Card.accident), di, { type: "CoupFourre", card: Card.drivingAce });
                expect(refuse(answered.game, bob, { type: "CoupFourre", card: Card.punctureProof }))
                .toEqual({ reason: "NoWindowOpen" });
            });


            it("does not draw for a Coup Fourré when the draw pile is empty", () => {
                const g = annAttacks(Card.flatTire, { drawPile: [] });
                const { game, events } = play(g, bob, { type: "CoupFourre", card: Card.punctureProof });
                expect(events.map((e) => e.type)).toEqual(["CoupFourrePlayed", "TurnStarted"]);
                expect(game.players[1]!.hand.length).toBe(5);
                expect(game.phase).toEqual({ kind: "Turn", player: bob });
            });


            it("passes the turn on when a Coup Fourré empties the player's hand", () => {
                const g = exhaustedGame(
                    [[Card.flatTire], [Card.punctureProof], [Card.dist50], []],
                    [rollingAt(), rollingAt()]
                );
                const opened = play(g, ann, { type: "Attack", card: Card.flatTire, targetTeam: team1 });
                const { game, events } = play(opened.game, bob, { type: "CoupFourre", card: Card.punctureProof });
                expect(events.map((e) => e.type)).toEqual(["CoupFourrePlayed", "TurnStarted"]);
                expect(game.phase).toEqual({ kind: "Turn", player: cy });
            });

        });


        describe("the Extension offer", () => {

            it("declining Extension at 700 completes the trip and ends the race", () => {
                const offered = annReaches700();
                const { game } = checked(applyPlayerCommand(deepFreeze(offered), ann, { type: "DeclineExtension" }));
                expect(game.phase).toEqual(jasmine.objectContaining({ kind: "RaceOver" }));
                const result = (game.phase as { result: RaceResult }).result;
                expect(result.outcome).toEqual({ kind: "TripCompleted", team: team0, delayedAction: false, extensionCaller: null });
                expect(result.scores[0]!.tripCompleted).toBe(400 as Points);
                expect(result.scores.every((s) => s.extension === 0)).toBeTrue();
            });


            it("CloseExtensionOffer (the timeout) gives the same result as DeclineExtension", () => {
                const offered = annReaches700();
                const closed = close(offered, closeOffer);
                expect(closed).toEqual(play(offered, ann, declineExtension));
                expect(closed.events.map((e) => e.type)).toEqual(["ExtensionDeclined", "RaceEnded"]);
                expect(closed.events[0]).toEqual({ type: "ExtensionDeclined", player: ann, team: team0 });
            });


            it("scores Delayed Action when Extension is declined with an empty draw pile", () => {
                const { game } = play(annReaches700({ drawPile: [] }), ann, declineExtension);
                expect(resultOf(game).outcome)
                .toEqual({ kind: "TripCompleted", team: team0, delayedAction: true, extensionCaller: null });
            });


            it("CallExtension makes the trip 1,000 miles for every team and passes the turn", () => {
                const { game, events } = play(annReaches700(), ann, callExtension);
                expect(game.extension).toEqual({ kind: "Called", caller: team0 });
                expect(game.phase).toEqual({ kind: "Turn", player: bob });
                expect(events).toEqual([
                    { type: "ExtensionCalled", player: ann, team: team0 },
                    { type: "TurnStarted", player: bob },
                    { type: "CardDrawn", player: bob, card: Card.spareTire },
                ]);
                const annsTurn = play(game, bob, discardRoll).game;
                const { game: at800 } = play(annsTurn, ann, { type: "Drive", card: Card.dist100 });
                expect(zoneMiles(at800.teams[0]!.zone)).toBe(800 as Miles);
                expect(contextFromGame(at800, bob).throwIfFailed().tripDistance).toBe(1000 as Miles);
            });


            it("pays the caller 200 when the caller reaches 1,000 first", () => {
                const hands = [
                    [Card.dist50, Card.dist100, Card.dist100, Card.dist100, Card.roll, Card.roll, Card.roll],
                    six(Card.roll),
                ];
                let g = play(annReaches700({ hands, drawPile: [] }), ann, callExtension).game;
                for (let i = 0; i < 3; i++) {
                    g = play(g, bob, discardRoll).game;
                    g = play(g, ann, { type: "Drive", card: Card.dist100 }).game;
                }
                const result = resultOf(g);
                expect(result.outcome)
                .toEqual({ kind: "TripCompleted", team: team0, delayedAction: true, extensionCaller: team0 });
                expect(result.scores.map((s) => s.tripCompleted)).toEqual([400 as Points, 0 as Points]);
                expect(result.scores.map((s) => s.extension)).toEqual([200 as Points, 0 as Points]);
            });


            it("pays every other team 200 when another team reaches 1,000 first", () => {
                let g = play(threeSeatOffer(), ann, callExtension).game;
                g = play(g, bob, { type: "Drive", card: Card.dist200 }).game;
                g = play(g, cy, discardRoll).game;
                g = play(g, ann, { type: "Discard", card: Card.stop }).game;
                const { game } = play(g, bob, { type: "Drive", card: Card.dist200 });
                const result = resultOf(game);
                expect(result.outcome)
                .toEqual({ kind: "TripCompleted", team: team1, delayedAction: true, extensionCaller: team0 });
                expect(result.scores.map((s) => s.tripCompleted)).toEqual([0, 400, 0] as Array<Points>);
                expect(result.scores.map((s) => s.extension)).toEqual([0, 200, 200] as Array<Points>);
            });


            it("opens the offer on the last card, then ends the race either way", () => {
                const lastCard = (): Game => threeSeatOffer({ hands: [[Card.dist50], [], []], drawPile: [] });
                const called = play(lastCard(), ann, callExtension);
                expect(called.events.map((e) => e.type)).toEqual(["ExtensionCalled", "RaceEnded"]);
                const result = resultOf(called.game);
                expect(result.outcome).toEqual({ kind: "Exhausted", winner: team0, extensionCaller: team0 });
                expect(result.scores.map((s) => s.extension)).toEqual([0, 200, 200] as Array<Points>);

                const declined = play(lastCard(), ann, declineExtension);
                expect(resultOf(declined.game).outcome)
                .toEqual({ kind: "TripCompleted", team: team0, delayedAction: true, extensionCaller: null });
            });


            it("opens no offer when a second team reaches 700 after the call", () => {
                const g = annReaches700({
                    hands: [annAt650().players[0]!.hand, [Card.dist50, ...Array.from({ length: 5 }, () => Card.roll)]],
                    zones: [
                        rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist50),
                        rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist50),
                    ],
                });
                const bobsTurn = play(g, ann, callExtension).game;
                const { game, events } = play(bobsTurn, bob, { type: "Drive", card: Card.dist50 });
                expect(zoneMiles(game.teams[1]!.zone)).toBe(700 as Miles);
                expect(game.phase).toEqual({ kind: "Turn", player: ann });
                expect(events.map((e) => e.type)).toEqual(["DistancePlayed", "TurnStarted"]);
            });


            it("refuses Extension decisions once the offer is resolved", () => {
                const offered = annReaches700();
                const called = play(offered, ann, callExtension).game;
                const declined = play(offered, ann, declineExtension).game;
                expect(refuseSystem(called, closeOffer)).toEqual({ reason: "NoExtensionOffer" });
                expect(refuseSystem(declined, closeOffer)).toEqual({ reason: "NoExtensionOffer" });
                expect(refuse(called, ann, callExtension)).toEqual({ reason: "NoExtensionOffer" });
                expect(refuse(declined, ann, callExtension)).toEqual({ reason: "WrongPhase" });
            });


            it("refuses a decision from anyone but the decider", () => {
                expect(refuse(annReaches700(), bob, declineExtension))
                .toEqual({ reason: "NotTheCaller", decider: seatFor("Ann").name });
            });


            it("refuses CloseHazardWindow during the offer", () => {
                expect(refuseSystem(annReaches700(), closeWindow)).toEqual({ reason: "NoWindowOpen" });
            });


            it("refuses every Extension command when there is no offer", () => {
                for (const g of [annAt650(), gameWhereAnnHolds(annHand)]) {
                    const seats = g.players.length;
                    expect(refuse(g, ann, callExtension)).withContext(`${seats} seats`)
                    .toEqual({ reason: "NoExtensionOffer" });
                    expect(refuse(g, ann, declineExtension)).withContext(`${seats} seats`)
                    .toEqual({ reason: "NoExtensionOffer" });
                    expect(refuseSystem(g, closeOffer)).withContext(`${seats} seats`)
                    .toEqual({ reason: "NoExtensionOffer" });
                }
            });

        });

    });


    describe("applySystemCommand()", () => {

        it("CloseHazardWindow lands the hazard and starts the next player's turn", () => {
            const { game, events } = close(annAttacks(Card.accident));
            expect(game.teams[1]!.zone.status).toEqual({ kind: "Hazard", hazard: Card.accident });
            expect(game.phase).toEqual({ kind: "Turn", player: bob });
            expect(events).toEqual([
                { type: "HazardLanded", card: Card.accident, targetTeam: team1 },
                { type: "TurnStarted", player: bob },
                { type: "CardDrawn", player: bob, card: Card.dist200 },
            ]);
        });


        it("CloseHazardWindow is refused after a Coup Fourré", () => {
            const answered = play(annAttacks(Card.accident), di, { type: "CoupFourre", card: Card.drivingAce });
            expect(applySystemCommand(deepFreeze(answered.game), closeWindow).throwIfSucceeded())
            .toEqual({ reason: "NoWindowOpen" });
        });


        it("CloseHazardWindow is refused during a turn", () => {
            expect(applySystemCommand(deepFreeze(attackGame()), closeWindow).throwIfSucceeded())
            .toEqual({ reason: "NoWindowOpen" });
        });


        it("ends the race Exhausted when the attack was the last card", () => {
            const g = exhaustedGame([[Card.accident], [], [], []], [newZone(), rollingAt(Card.dist100)]);
            const opened = play(g, ann, { type: "Attack", card: Card.accident, targetTeam: team1 });
            expect(opened.game.phase.kind).toBe("HazardIncoming");
            const { game, events } = close(opened.game);
            expect(events.map((e) => e.type)).toEqual(["HazardLanded", "RaceEnded"]);
            expect(resultOf(game).outcome).toEqual({ kind: "Exhausted", winner: team1, extensionCaller: null });
        });


        describe("StartNextRace", () => {

            it("deals race 2 from the front of the deck onto the same teams, keeping points", () => {
                const over = annWinsRace({ points: [100, 200] });
                const totals = resultOf(over).scores.map((s) => s.combinedTotal);
                expect(totals[0]).toBeGreaterThan(400);
                const hands = [
                    [Card.dist25, Card.dist25, Card.dist25, Card.dist50, Card.dist50, Card.dist50],
                    [Card.stop, Card.stop, Card.accident, Card.repairs, Card.gasoline, Card.spareTire],
                ];
                const deck = deckFor(hands, [Card.dist200, Card.roll], "Reduced");
                const { game, events } = close(over, startRace(deck));
                expect(game.raceNumber).toBe(2);
                expect(game.teams.map((t) => t.points)).toEqual(totals);
                expect(game.teams.map((t) => t.zone)).toEqual([newZone(), newZone()]);
                expect(game.discardPile).toEqual([]);
                expect(game.extension).toEqual({ kind: "Available" });
                // Race 2 starts with the second player, Bob, who draws the card after the hands.
                expect(game.phase).toEqual({ kind: "Turn", player: bob });
                expect(game.players[0]!.hand).toEqual(hands[0]!);
                expect(game.players[1]!.hand).toEqual([...hands[1]!, Card.dist200]);
                expect(game.drawPile).toEqual(deck.slice(13));
                expect(events).toEqual([
                    { type: "RaceDealt", race: 2 },
                    { type: "TurnStarted", player: bob },
                    { type: "CardDrawn", player: bob, card: Card.dist200 },
                ]);
            });


            it("does not advance on its own: RaceOver persists until StartNextRace", () => {
                const over = annWinsRace();
                expect(over.phase.kind).toBe("RaceOver");
                for (const by of [ann, bob]) {
                    const commands: ReadonlyArray<PlayerCommand> = [
                        { type: "Drive", card: Card.dist25 },
                        { type: "Attack", card: Card.accident, targetTeam: team1 },
                        { type: "Remedy", card: Card.roll },
                        { type: "PlaySafety", card: Card.drivingAce },
                        discardRoll,
                        { type: "CoupFourre", card: Card.drivingAce },
                        callExtension,
                        declineExtension,
                    ];
                    for (const cmd of commands) {
                        expect(refuse(over, by, cmd)).withContext(`${by} ${cmd.type}`)
                        .toEqual({ reason: "WrongPhase" });
                    }
                }
                expect(over.phase.kind).toBe("RaceOver");
            });


            it("carries each team's total into the next race's broughtForward", () => {
                const race1 = annWinsRace();
                const totals = resultOf(race1).scores.map((s) => s.combinedTotal);
                // Bob reaches exactly 700 with 5 drives; Ann discards in between.
                const bobsHand = [
                    Card.roll, Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist100,
                ];
                let g = close(race1, startRace(deckFor([six(Card.dist25), bobsHand], [], "Reduced"))).game;
                const bobsPlays: ReadonlyArray<PlayerCommand> = [
                    { type: "Remedy", card: Card.roll },
                    { type: "Drive", card: Card.dist200 },
                    { type: "Drive", card: Card.dist200 },
                    { type: "Drive", card: Card.dist100 },
                    { type: "Drive", card: Card.dist100 },
                    { type: "Drive", card: Card.dist100 },
                ];
                bobsPlays.forEach((cmd, i) => {
                    g = play(g, bob, cmd).game;
                    if (i < bobsPlays.length - 1) {
                        g = play(g, ann, { type: "Discard", card: g.players[0]!.hand[0]! }).game;
                    }
                });
                expect(g.phase.kind).toBe("ExtensionOffer");
                g = play(g, bob, declineExtension).game;
                const result = resultOf(g);
                expect(result.outcome)
                .toEqual({ kind: "TripCompleted", team: team1, delayedAction: false, extensionCaller: null });
                expect(result.scores.map((s) => s.broughtForward)).toEqual(totals);
                expect(g.teams.map((t) => t.points))
                .toEqual(result.scores.map((s) => s.combinedTotal));
            });


            it("makes Extension Available again after a race that ended with it Called", () => {
                const hands = [
                    [Card.dist50, Card.dist100, Card.dist100, Card.dist100, Card.roll, Card.roll, Card.roll],
                    six(Card.roll),
                ];
                let twoSeat = play(annReaches700({ hands, drawPile: [] }), ann, callExtension).game;
                for (let i = 0; i < 3; i++) {
                    twoSeat = play(twoSeat, bob, discardRoll).game;
                    twoSeat = play(twoSeat, ann, { type: "Drive", card: Card.dist100 }).game;
                }
                let threeSeat = play(threeSeatOffer(), ann, callExtension).game;
                threeSeat = play(threeSeat, bob, { type: "Drive", card: Card.dist200 }).game;
                threeSeat = play(threeSeat, cy, discardRoll).game;
                threeSeat = play(threeSeat, ann, { type: "Discard", card: Card.stop }).game;
                threeSeat = play(threeSeat, bob, { type: "Drive", card: Card.dist200 }).game;
                for (const over of [twoSeat, threeSeat]) {
                    const seats = over.players.length;
                    expect(over.phase.kind).withContext(`${seats} seats`).toBe("RaceOver");
                    expect(over.extension.kind).withContext(`${seats} seats`).toBe("Called");
                    const { game } = close(over, startRace(createDeck("Reduced")));
                    expect(game.extension).withContext(`${seats} seats`).toEqual({ kind: "Available" });
                    expect(contextFromGame(game, ann).throwIfFailed().tripDistance)
                    .withContext(`${seats} seats`).toBe(700 as Miles);
                }
            });


            it("leaves Extension NotApplicable in a 4-seat game", () => {
                const { game } = close(annWinsFourSeatRace(), startRace(createDeck()));
                expect(game.extension).toEqual({ kind: "NotApplicable" });
                expect(contextFromGame(game, bob).throwIfFailed().tripDistance).toBe(1000 as Miles);
                expect(game.teams.map((t) => t.points)).not.toEqual([0, 0] as Array<Points>);
            });


            it("rotates the first player one seat per race: 4 seats play first in turn 0, 1, 2, 3, 0", () => {
                const over = annWinsFourSeatRace();
                const names = [ann, bob, cy, di];
                const first = createGame(twoByTwo(), createDeck()).throwIfFailed().game;
                expect(first.phase).toEqual({ kind: "Turn", player: ann });
                for (let race = 1; race <= 4; race++) {
                    const deck = createDeck();
                    const { game, events } = close({ ...over, raceNumber: race }, startRace(deck));
                    const firstSeat = race % 4;
                    expect(game.raceNumber).withContext(`race ${race + 1}`).toBe(race + 1);
                    expect(game.phase).withContext(`race ${race + 1}`)
                    .toEqual({ kind: "Turn", player: names[firstSeat]! });
                    expect(game.players.map((p) => p.hand)).withContext(`race ${race + 1}`)
                    .toEqual(game.players.map((_, i) => [
                        ...deck.slice(6 * i, 6 * i + 6),
                        ...(i === firstSeat ? [deck[24]!] : []),
                    ]));
                    expect(game.drawPile).withContext(`race ${race + 1}`).toEqual(deck.slice(25));
                    expect(game.discardPile).toEqual([]);
                    expect(events.map((e) => e.type)).toEqual(["RaceDealt", "TurnStarted", "CardDrawn"]);
                }
            });


            it("is refused outside RaceOver: Turn, HazardIncoming, ExtensionOffer and GameOver", () => {
                const shortOver = annWinsRace({ config: { ...oneOnOne(), length: "Short" }, points: [1500, 0] });
                expect(shortOver.phase.kind).toBe("GameOver");
                const cases: ReadonlyArray<[string, Game, DeckKind]> = [
                    ["Turn", gameWhereAnnHolds(annHand), "Standard"],
                    ["HazardIncoming", annAttacks(Card.accident), "Standard"],
                    ["ExtensionOffer", annReaches700(), "Reduced"],
                    ["GameOver", shortOver, "Reduced"],
                ];
                for (const [name, g, kind] of cases) {
                    const snapshot = structuredClone(g);
                    expect(refuseSystem(g, startRace(createDeck(kind)))).withContext(name)
                    .toEqual({ reason: "WrongPhase" });
                    expect(g).withContext(name).toEqual(snapshot);
                }
            });


            it("refuses a deck of the wrong kind for the variant with WrongDeck", () => {
                const twoSeat = annWinsRace();
                const fourSeat = annWinsFourSeatRace();
                expect(refuseSystem(twoSeat, startRace(createDeck("Standard"))))
                .toEqual({ reason: "WrongDeck" });
                expect(refuseSystem(fourSeat, startRace(createDeck("Reduced"))))
                .toEqual({ reason: "WrongDeck" });
                expect(twoSeat.phase.kind).toBe("RaceOver");
            });


            it("refuses a card list that is not a whole deck with WrongDeck", () => {
                const over = annWinsRace();
                const short = createDeck("Reduced").slice(1) as unknown as ShuffledDeck;
                const doubled = [...createDeck("Reduced"), ...createDeck("Reduced")] as unknown as ShuffledDeck;
                for (const deck of [short, doubled, [] as unknown as ShuffledDeck]) {
                    expect(refuseSystem(over, startRace(deck))).withContext(String(deck.length))
                    .toEqual({ reason: "WrongDeck" });
                }
            });


            it("refuses a missing, non-array or unknown-card deck with MalformedCommand, never throwing", () => {
                const over = annWinsRace();
                const snapshot = structuredClone(over);
                const unknownCard = [...createDeck("Reduced").slice(1), "Nope"];
                const badDecks: ReadonlyArray<[string, unknown]> = [
                    ["a missing deck", undefined],
                    ["null", null],
                    ["a string", "Roll"],
                    ["an object with a length", { length: 101 }],
                    ["a deck with an unknown card", unknownCard],
                ];
                for (const [name, deck] of badDecks) {
                    const cmd = { type: "StartNextRace", deck } as unknown as SystemCommand;
                    expect(refuseSystem(over, cmd)).withContext(name).toEqual({ reason: "MalformedCommand" });
                }
                const noDeck = { type: "StartNextRace" } as unknown as SystemCommand;
                expect(refuseSystem(over, noDeck)).toEqual({ reason: "MalformedCommand" });
                // The shape is checked before the phase.
                expect(refuseSystem(annReaches700(), noDeck)).toEqual({ reason: "MalformedCommand" });
                expect(over).toEqual(snapshot);
            });


            it("ends a Short game through the engine when a team reaches 2,000", () => {
                const config = { ...oneOnOne(), length: "Short" as const };
                const { game } = play(annReaches700({ config, points: [1500, 0] }), ann, declineExtension);
                expect(game.phase).toEqual(jasmine.objectContaining({ kind: "GameOver", winner: team0 }));
                expect(game.teams[0]!.points).toBeGreaterThanOrEqual(2000);
            });


            it("keeps a Short game going when the totals are [2000, 2000], then plays another race", () => {
                const config = { ...oneOnOne(), length: "Short" as const };
                const raceScores = resultOf(annWinsRace({ config })).scores.map((s) => s.totalForRace);
                const points = raceScores.map((s) => 2000 - s);
                const over = annWinsRace({ config, points });
                expect(over.phase.kind).toBe("RaceOver");
                expect(over.teams.map((t) => t.points)).toEqual([2000, 2000] as Array<Points>);
                const { game } = close(over, startRace(createDeck("Reduced")));
                expect(game.raceNumber).toBe(2);
                expect(game.phase.kind).toBe("Turn");
                expect(game.teams.map((t) => t.points)).toEqual([2000, 2000] as Array<Points>);
            });


            it("ends a Quick race tied on miles as RaceOver, not GameOver", () => {
                const config = { ...twoByTwo(), length: "Quick" as const };
                const g = buildGame({
                    config,
                    hands:    [[Card.dist25], [], [], []],
                    zones:    [rollingAt(Card.dist100, Card.dist75), rollingAt(Card.dist200)],
                    drawPile: [],
                });
                const { game } = play(g, ann, { type: "Drive", card: Card.dist25 });
                expect(resultOf(game).outcome).toEqual({ kind: "Exhausted", winner: "Tie", extensionCaller: null });
                expect(game.phase.kind).toBe("RaceOver");
                expect(close(game, startRace(createDeck())).game.raceNumber).toBe(2);
            });


            it("scores the shutout row (500) in a 3-team game only when both opponents have 0 miles", () => {
                const shutout = threeTeamWin([newZone(), newZone()]);
                expect(resultOf(shutout).scores.map((s) => s.shutout)).toEqual([500, 0, 0] as Array<Points>);
                const notShutout = threeTeamWin([newZone(), rollingAt(Card.dist25)]);
                expect(resultOf(notShutout).scores.map((s) => s.shutout)).toEqual([0, 0, 0] as Array<Points>);
            });

        });


        it("refuses malformed commands without throwing or changing the game", () => {
            const g = deepFreeze(annReaches700());
            const snapshot = structuredClone(g);
            const malformed: ReadonlyArray<[string, unknown]> = [
                ["null", null],
                ["a string", "CloseExtensionOffer"],
                ["a number", 7],
                ["a command with no type", {}],
                ["an unknown command type", { type: "Nope" }],
                ["a non-string type", { type: 7 }],
                ["the prototype key constructor", { type: "constructor" }],
                ["the prototype key __proto__", { type: "__proto__" }],
                ["the prototype key toString", { type: "toString" }],
            ];
            for (const [name, cmd] of malformed) {
                expect(refuseSystem(g, cmd as SystemCommand)).withContext(name)
                .toEqual({ reason: "MalformedCommand" });
            }
            expect(g).toEqual(snapshot);
        });

    });

});
