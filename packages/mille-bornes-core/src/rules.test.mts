import { Card } from "./card.mjs";
import { type PlayerCommand } from "./commands.mjs";
import { newZone } from "./drivingZone.mjs";
import { type TeamIndex } from "./ids.mjs";
import { type Miles } from "./miles.mjs";
import { Points } from "./points.mjs";
import { type Rejection } from "./rejection.mjs";
import { checkCommand, contextFromGame, type PlayContext } from "./rules.mjs";
import { scoreRace, standardScoring } from "./scoring.mjs";
import { buildGame, oneOnOne, seatFor } from "./testHelpers.mjs";


const ann = seatFor("Ann");
const bob = seatFor("Bob");
const team0 = 0 as TeamIndex;
const team1 = 1 as TeamIndex;


const otherCommands: ReadonlyArray<PlayerCommand> = [
    { type: "Drive", card: Card.dist100 },
    { type: "Attack", card: Card.accident, targetTeam: team1 },
    { type: "Remedy", card: Card.roll },
    { type: "PlaySafety", card: Card.drivingAce },
    { type: "Discard", card: Card.roll },
    { type: "CoupFourre", card: Card.drivingAce },
];
const extensionCommands: ReadonlyArray<PlayerCommand> = [
    { type: "CallExtension" },
    { type: "DeclineExtension" },
];
const allCommands = [...otherCommands, ...extensionCommands];


const annsTurn: PlayContext["phase"] = { kind: "Turn", player: ann.id, playerName: ann.name };
const annDeciding: PlayContext["phase"] = {
    kind:        "ExtensionOffer",
    decider:     ann.id,
    deciderName: ann.name,
};


function accidentOn(target: TeamIndex): PlayContext["phase"] {
    return { kind: "HazardIncoming", attacker: bob.id, hazard: Card.accident, target };
}


/** Ann's context, holding a Roll, a 100, Driving Ace and an Accident. */
function annsContext(phase: PlayContext["phase"]): PlayContext {
    return {
        me:           ann.id,
        myTeam:       team0,
        hand:         [Card.roll, Card.dist100, Card.drivingAce, Card.accident],
        zones:        [newZone(), newZone()],
        tripDistance: 700 as Miles,
        phase,
    };
}


function refusal(ctx: PlayContext, cmd: PlayerCommand): Rejection {
    return checkCommand(ctx, cmd).throwIfSucceeded();
}


describe("rules", () => {

    describe("contextFromGame()", () => {

        it("builds a player's context from the game", () => {
            const g = buildGame({
                config: oneOnOne(),
                hands:  [[Card.roll, Card.dist25], [Card.stop]],
                zones:  [{ ...newZone(), distance: [Card.dist25] }, newZone()],
            });
            expect(contextFromGame(g, bob.id).throwIfFailed()).toEqual({
                me:           bob.id,
                myTeam:       team1,
                hand:         [Card.stop],
                zones:        g.teams.map((t) => t.zone),
                tripDistance: 700 as Miles,
                phase:        annsTurn,
            });
        });


        it("names the decider of an Extension offer", () => {
            const g = buildGame({
                config: oneOnOne(),
                zones:  [
                    { ...newZone(), distance: [Card.dist200, Card.dist200, Card.dist100, Card.dist100, Card.dist100] },
                    newZone(),
                ],
                phase: { kind: "ExtensionOffer", decider: ann.id, team: team0 },
            });
            expect(contextFromGame(g, bob.id).throwIfFailed().phase).toEqual(annDeciding);
        });


        it("shows a finished race as Over", () => {
            const outcome = { kind: "Exhausted", winner: "Tie", extensionCaller: null } as const;
            const zones = [newZone(), newZone()];
            const scores = scoreRace(standardScoring, zones, outcome, [Points.zero, Points.zero]);
            const g = buildGame({
                config: oneOnOne(),
                phase:  { kind: "RaceOver", result: { outcome, scores } },
            });
            expect(contextFromGame(g, ann.id).throwIfFailed().phase).toEqual({ kind: "Over" });
        });


        it("rejects a player who is not in the game", () => {
            const g = buildGame({ config: oneOnOne() });
            expect(contextFromGame(g, seatFor("Zed").id).throwIfSucceeded())
            .toEqual({ reason: "WrongPhase" });
        });

    });


    describe("checkCommand()", () => {

        it("refuses a malformed command before checking the phase", () => {
            const cmd = { type: "Drive", card: Card.roll } as unknown as PlayerCommand;
            expect(refusal(annsContext({ kind: "Over" }), cmd)).toEqual({ reason: "MalformedCommand" });
        });


        it("lets the player discard any card in hand", () => {
            const ctx = annsContext(annsTurn);
            for (const card of ctx.hand) {
                expect(checkCommand(ctx, { type: "Discard", card }).succeeded).withContext(card)
                .toBeTrue();
            }
        });


        it("checks the turn before the hand", () => {
            const bobsTurn = { kind: "Turn", player: bob.id, playerName: bob.name } as const;
            expect(refusal(annsContext(bobsTurn), { type: "Discard", card: Card.dist200 }))
            .toEqual({ reason: "NotYourTurn", current: bob.name });
        });


        it("checks the hand before the zone rules", () => {
            const ctx = annsContext(annsTurn);
            expect(refusal(ctx, { type: "Drive", card: Card.dist200 }))
            .toEqual({ reason: "CardNotInHand", card: Card.dist200 });
            expect(refusal(ctx, { type: "Drive", card: Card.dist100 }))
            .toEqual({ reason: "NotRolling" });
        });


        it("allows a legal Remedy and Safety on the player's own zone", () => {
            const ctx = annsContext(annsTurn);
            expect(checkCommand(ctx, { type: "Remedy", card: Card.roll }).succeeded).toBeTrue();
            expect(checkCommand(ctx, { type: "PlaySafety", card: Card.drivingAce }).succeeded)
            .toBeTrue();
        });


        it("refuses Extension decisions and Coup Fourres during a turn", () => {
            for (const cmd of extensionCommands) {
                expect(refusal(annsContext(annsTurn), cmd)).toEqual({ reason: "NoExtensionOffer" });
            }
            expect(refusal(annsContext(annsTurn), { type: "CoupFourre", card: Card.drivingAce }))
            .toEqual({ reason: "NoWindowOpen" });
        });


        it("refuses everything but a Coup Fourre while a hazard is incoming", () => {
            const phase = {
                kind:     "HazardIncoming",
                attacker: bob.id,
                hazard:   Card.accident,
                target:   team0,
            } as const;
            for (const cmd of allCommands.filter((c) => c.type !== "CoupFourre")) {
                expect(refusal(annsContext(phase), cmd)).withContext(cmd.type)
                .toEqual({ reason: "WindowOpen" });
            }
        });


        it("checks a Coup Fourre's team, then the hand, then the safety", () => {
            const ctx = annsContext(accidentOn(team0));
            const bobsContext = { ...annsContext(accidentOn(team0)), me: bob.id, myTeam: team1 };
            expect(refusal(bobsContext, { type: "CoupFourre", card: Card.rightOfWay }))
            .toEqual({ reason: "NotOnTargetTeam" });
            expect(refusal(ctx, { type: "CoupFourre", card: Card.rightOfWay }))
            .toEqual({ reason: "CardNotInHand", card: Card.rightOfWay });
            const wrongSafety = { ...ctx, hand: [...ctx.hand, Card.rightOfWay] };
            expect(refusal(wrongSafety, { type: "CoupFourre", card: Card.rightOfWay }))
            .toEqual({ reason: "WrongSafetyForHazard", hazard: Card.accident, card: Card.rightOfWay });
            expect(checkCommand(ctx, { type: "CoupFourre", card: Card.drivingAce }).succeeded)
            .toBeTrue();
        });


        it("checks an attack's target team and zone", () => {
            const ctx = annsContext(annsTurn);
            const accident = { type: "Attack", card: Card.accident } as const;
            expect(refusal(ctx, { ...accident, targetTeam: team0 }))
            .toEqual({ reason: "CannotAttackOwnTeam" });
            expect(refusal(ctx, { ...accident, targetTeam: team1 }))
            .toEqual({ reason: "TargetNotMoving", hazard: Card.accident });
            const rolling = { ...ctx, zones: [newZone(), { ...newZone(), status: { kind: "Rolling" } as const }] };
            expect(checkCommand(rolling, { ...accident, targetTeam: team1 }).succeeded).toBeTrue();
        });


        it("lets only the decider call or decline Extension during an offer", () => {
            for (const cmd of extensionCommands) {
                expect(checkCommand(annsContext(annDeciding), cmd).succeeded).withContext(cmd.type)
                .toBeTrue();
                const bobsContext = { ...annsContext(annDeciding), me: bob.id, myTeam: team1 };
                expect(refusal(bobsContext, cmd)).withContext(cmd.type)
                .toEqual({ reason: "NotTheCaller", decider: ann.name });
            }
        });


        it("refuses every other command during an Extension offer", () => {
            for (const cmd of otherCommands) {
                expect(refusal(annsContext(annDeciding), cmd)).withContext(cmd.type)
                .toEqual({ reason: "ExtensionOfferOpen", decider: ann.name });
            }
        });


        it("refuses everything once the race is over", () => {
            for (const cmd of allCommands) {
                expect(refusal(annsContext({ kind: "Over" }), cmd)).withContext(cmd.type)
                .toEqual({ reason: "WrongPhase" });
            }
        });

    });

});
