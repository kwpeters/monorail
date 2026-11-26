import { type Result } from "@repo/depot/result";
import { Card, type DistanceCard } from "./card.mjs";
import { type Applied, type PlayerCommand, type SystemCommand } from "./commands.mjs";
import { isDeadPosition } from "./deadPosition.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import { applyPlayerCommand, applySystemCommand } from "./engine.mjs";
import { type Game, type RaceResult } from "./game.mjs";
import { checkInvariants } from "./invariants.mjs";
import { type PlayerId, type TeamIndex } from "./ids.mjs";
import { type Rejection } from "./rejection.mjs";
import {
    buildGame, deepFreeze, oneOnOne, scoresTheLongWay, seatFor, twoByTwo, type GameParts
} from "./testHelpers.mjs";


const ann = seatFor("Ann").id;
const bob = seatFor("Bob").id;
const cy = seatFor("Cy").id;
const team0 = 0 as TeamIndex;
const team1 = 1 as TeamIndex;


function rollingAt(...distance: Array<DistanceCard>): DrivingZone {
    return { ...newZone(), status: { kind: "Rolling" }, distance };
}


/** 950 miles on a 1,000-mile trip: nothing above a 50 can be driven. */
const at950 = (): DrivingZone => rollingAt(
    Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist100, Card.dist100, Card.dist100,
    Card.dist50
);
const stoppedAt950 = (): DrivingZone => ({
    ...at950(),
    status: { kind: "Hazard", hazard: Card.accident },
});


// Hands in seat order: Ann, Bob, Cy, Di.  None of these cards can be played
// on a team at 950 miles, or on one that an Accident stops.
const stuckHands: Array<Array<Card>> = [
    [Card.dist75, Card.dist100, Card.spareTire],
    [Card.dist75, Card.gasoline, Card.endOfSpeedLimit],
    [Card.dist75, Card.dist100],
    [Card.dist75, Card.dist75],
];


/** A 4-seat game with an empty draw pile; both teams are at 950 unless told otherwise. */
function stuckGame(parts: Partial<GameParts> = {}): Game {
    return buildGame({
        config:   twoByTwo(),
        hands:    stuckHands,
        zones:    [at950(), at950()],
        drawPile: [],
        ...parts,
    });
}


/** Replaces one card of one player's hand. */
function withHand(seat: number, hand: Array<Card>): Array<Array<Card>> {
    return stuckHands.map((h, i) => i === seat ? hand : h);
}


function resultOf(g: Game): RaceResult {
    if (g.phase.kind !== "RaceOver" && g.phase.kind !== "GameOver") {
        throw new Error(`The race is not over: the phase is ${g.phase.kind}.`);
    }
    return g.phase.result;
}


function checked(result: Result<Applied, Rejection>): Applied {
    const applied = result.throwIfFailed();
    const valid = checkInvariants(applied.game);
    expect(valid.succeeded).withContext(valid.error ?? "").toBeTrue();
    return applied;
}


function play(g: Game, by: PlayerId, cmd: PlayerCommand): Applied {
    return checked(applyPlayerCommand(deepFreeze(g), by, cmd));
}


function close(g: Game, cmd: SystemCommand = { type: "CloseHazardWindow" }): Applied {
    return checked(applySystemCommand(deepFreeze(g), cmd));
}


/**
 * Expects the race to have ended as Exhausted with cards still in hands, and
 * the scores to be those of playing the discards out.
 */
function expectEndedEarly(g: Game): void {
    expect(g.phase.kind).toBe("RaceOver");
    expect(resultOf(g).outcome.kind).toBe("Exhausted");
    expect(g.players.reduce((n, p) => n + p.hand.length, 0)).toBeGreaterThan(0);
    expect(scoresTheLongWay(g).throwIfFailed()).toEqual(resultOf(g).scores);
}


describe("isDeadPosition()", () => {

    it("is true when the draw pile is empty and nobody can do more than discard", () => {
        expect(isDeadPosition(stuckGame())).toBeTrue();
    });


    it("is true when a team is stopped and nobody holds its remedy", () => {
        expect(isDeadPosition(stuckGame({ zones: [at950(), stoppedAt950()] }))).toBeTrue();
    });


    it("is false when the draw pile is not empty", () => {
        expect(isDeadPosition(stuckGame({ drawPile: [Card.dist25] }))).toBeFalse();
    });


    for (const [seat, name] of ["Ann", "Bob", "Cy", "Di"].entries()) {
        it(`is false when ${name}, whoever is on turn, holds a card that can be driven`, () => {
            const hands = withHand(seat, [Card.dist25, Card.dist75]);
            expect(isDeadPosition(stuckGame({ hands }))).toBeFalse();
        });
    }


    it("is false when a player holds a safety, which can always be played", () => {
        expect(isDeadPosition(stuckGame({ hands: withHand(1, [Card.drivingAce]) }))).toBeFalse();
    });


    it("is false when a player holds a hazard that can land on a moving team", () => {
        expect(isDeadPosition(stuckGame({ hands: withHand(2, [Card.flatTire]) }))).toBeFalse();
    });


    it("is true when the only hazards held cannot land", () => {
        // Team 1 is stopped, so it cannot be hit by a Flat Tire; Speed Limit can.
        const game = stuckGame({
            zones: [at950(), stoppedAt950()],
            hands: withHand(2, [Card.flatTire, Card.outOfGas]),
        });
        expect(isDeadPosition(game)).toBeTrue();
        const limit = stuckGame({
            zones: [at950(), stoppedAt950()],
            hands: withHand(2, [Card.speedLimit]),
        });
        expect(isDeadPosition(limit)).toBeFalse();
    });


    it("is false when a remedy fixes a blocked team", () => {
        const game = stuckGame({
            zones: [at950(), stoppedAt950()],
            hands: withHand(1, [Card.repairs, Card.gasoline]),
        });
        expect(isDeadPosition(game)).toBeFalse();
    });


    it("is false when a teammate can play although the player on turn cannot", () => {
        const game = stuckGame({ hands: [[Card.dist75], [Card.dist75], [Card.dist25], [Card.dist75]] });
        expect(game.phase).toEqual({ kind: "Turn", player: ann });
        expect(isDeadPosition(game)).toBeFalse();
    });


    it("is false when a team needs a Roll and a player holds one", () => {
        const zones = [{ ...at950(), status: { kind: "NeedsRoll" } as const }, at950()];
        expect(isDeadPosition(stuckGame({ zones, hands: withHand(0, [Card.roll]) }))).toBeFalse();
    });

});


describe("ending a race early", () => {

    it("ends the race when a play leaves nobody able to do more than discard", () => {
        const game = stuckGame({ hands: withHand(0, [Card.dist25, Card.dist75]) });
        const { game: ended, events } = play(game, ann, { type: "Drive", card: Card.dist25 });
        expect(events.map((e) => e.type)).toEqual(["DistancePlayed", "RaceEnded"]);
        expect(resultOf(ended).outcome).toEqual({ kind: "Exhausted", winner: team0, extensionCaller: null });
        expectEndedEarly(ended);
    });


    it("ends the race when a discard leaves nobody able to do more than discard", () => {
        const game = stuckGame({ hands: withHand(0, [Card.dist25, Card.dist75]) });
        const { game: ended, events } = play(game, ann, { type: "Discard", card: Card.dist25 });
        expect(events.map((e) => e.type)).toEqual(["CardDiscarded", "RaceEnded"]);
        // Both teams are at 950, so the race is a tie.
        expect(resultOf(ended).outcome).toEqual({ kind: "Exhausted", winner: "Tie", extensionCaller: null });
        expectEndedEarly(ended);
    });


    it("ends the race after a Safety play that leaves nobody able to do more", () => {
        const game = stuckGame({ hands: withHand(0, [Card.drivingAce, Card.dist75]) });
        const { game: ended, events } = play(game, ann, { type: "PlaySafety", card: Card.drivingAce });
        expect(events.map((e) => e.type)).toEqual(["SafetyPlayed", "RaceEnded"]);
        expectEndedEarly(ended);
    });


    it("scores the same as playing the discards out when a team is stopped", () => {
        const game = stuckGame({
            zones: [at950(), stoppedAt950()],
            hands: withHand(0, [Card.dist25, Card.dist75]),
        });
        const { game: ended } = play(game, ann, { type: "Drive", card: Card.dist25 });
        expect(resultOf(ended).outcome).toEqual({ kind: "Exhausted", winner: team0, extensionCaller: null });
        expectEndedEarly(ended);
    });


    it("does not end the race while the draw pile has a card", () => {
        const game = stuckGame({
            drawPile: [Card.dist25],
            hands:    withHand(0, [Card.dist25, Card.dist75]),
        });
        const { game: next } = play(game, ann, { type: "Drive", card: Card.dist25 });
        expect(next.phase).toEqual({ kind: "Turn", player: bob });
    });


    it("does not end the race while a player can still play", () => {
        const game = stuckGame({
            hands: [[Card.dist25, Card.dist75], [Card.dist75], [Card.dist50], [Card.dist75]],
        });
        const { game: next } = play(game, ann, { type: "Discard", card: Card.dist75 });
        expect(next.phase).toEqual({ kind: "Turn", player: bob });
    });


    it("ends the race when a hazard lands and stops the last team that could play", () => {
        // Team 0 is stuck; Ann's Flat Tire stops team 1 (which is at 950 too).
        const game = stuckGame({ hands: withHand(0, [Card.flatTire, Card.dist75]) });
        const attacked = play(game, ann, { type: "Attack", card: Card.flatTire, targetTeam: team1 }).game;
        expect(attacked.phase.kind).toBe("HazardIncoming");
        const { game: ended, events } = close(attacked);
        expect(events.map((e) => e.type)).toEqual(["HazardLanded", "RaceEnded"]);
        expectEndedEarly(ended);
    });


    it("ends the race when a hazard lands at once, no window being needed", () => {
        // Cy's team has Puncture Proof, so no one can hold it and no window opens.
        const zones = [
            { ...at950(), safeties: [{ card: Card.punctureProof, coupFourre: false }] },
            at950(),
        ];
        const game = stuckGame({ zones, hands: withHand(0, [Card.flatTire, Card.dist75]) });
        const { game: ended, events } = play(
            game, ann, { type: "Attack", card: Card.flatTire, targetTeam: team1 }
        );
        expect(events.map((e) => e.type)).toEqual(["HazardPlayed", "HazardLanded", "RaceEnded"]);
        expectEndedEarly(ended);
    });


    it("ends the race after a Coup Fourre when nobody can do more than discard", () => {
        const game = stuckGame({
            hands: [[Card.flatTire, Card.dist75], [Card.spareTire, Card.punctureProof], [Card.dist75], [Card.dist75]],
        });
        const attacked = play(game, ann, { type: "Attack", card: Card.flatTire, targetTeam: team1 }).game;
        const { game: ended, events } = play(attacked, bob, { type: "CoupFourre", card: Card.punctureProof });
        expect(events.map((e) => e.type)).toEqual(["CoupFourrePlayed", "RaceEnded"]);
        expectEndedEarly(ended);
    });


    it("ends the race when Extension is called and no one can play on", () => {
        // Ann (650, trip 700 now) drives a 50 to 700; after the call the trip is
        // 1,000 and Ann holds only a Spare Tire while Bob, who needs a Roll,
        // holds only Gasoline.
        const config = oneOnOne();
        const offered = play(
            buildGame({
                config,
                hands: [[Card.dist50, Card.spareTire], [Card.gasoline]],
                zones: [
                    rollingAt(Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist50),
                    newZone(),
                ],
            }),
            ann,
            { type: "Drive", card: Card.dist50 }
        ).game;
        expect(offered.phase.kind).toBe("ExtensionOffer");
        const { game: ended, events } = play(offered, ann, { type: "CallExtension" });
        expect(events.map((e) => e.type)).toEqual(["ExtensionCalled", "RaceEnded"]);
        expect(resultOf(ended).outcome).toEqual({ kind: "Exhausted", winner: team0, extensionCaller: team0 });
        expectEndedEarly(ended);
    });


    it("still ends a race the old way when the last card is played", () => {
        const game = stuckGame({ hands: [[Card.dist25], [], [], []] });
        const { game: ended, events } = play(game, ann, { type: "Drive", card: Card.dist25 });
        expect(events.map((e) => e.type)).toEqual(["DistancePlayed", "RaceEnded"]);
        expect(ended.players.every((p) => p.hand.length === 0)).toBeTrue();
        expect(scoresTheLongWay(ended).throwIfFailed()).toEqual(resultOf(ended).scores);
    });


    it("fails scoresTheLongWay() for a race that was not dead", () => {
        const dead = play(
            stuckGame({ hands: withHand(0, [Card.dist25, Card.dist75]) }),
            ann,
            { type: "Drive", card: Card.dist25 }
        ).game;
        // Give Cy a 25 that could still be driven: ending the race was wrong.
        const players = dead.players.map((p) => p.seat.id === cy ? { ...p, hand: [Card.dist25] } : p);
        expect(scoresTheLongWay({ ...dead, players }).failed).toBeTrue();
    });

});
