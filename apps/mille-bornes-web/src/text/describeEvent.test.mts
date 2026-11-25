import { Card } from "@repo/mille-bornes-core/card";
import { type GameEvent } from "@repo/mille-bornes-core/events";
import { PlayerId } from "@repo/mille-bornes-core/ids";
import { describe, expect, it } from "vitest";
import { idOf, team, viewForSeats } from "../testing/viewFixtures.mjs";
import { describeEvent, describeRaceResult } from "./describeEvent.mjs";


describe("describeEvent", () => {

    describe("describeEvent", () => {

        // Ann is the viewer; Bob is on team 1 (shown as "Team 2").
        const view = viewForSeats(2);
        const ann = idOf(view, "Ann");
        const bob = idOf(view, "Bob");

        // One sample of every event type; the Record type makes this table
        // fail to compile when a new event type is added.
        /* eslint-disable @typescript-eslint/naming-convention */
        const bobSamples: Readonly<Record<GameEvent["type"], readonly [GameEvent, string]>> = {
            RaceDealt:      [{ type: "RaceDealt", race: 2 }, "Race 2 is dealt."],
            TurnStarted:    [{ type: "TurnStarted", player: bob }, "It's Bob's turn."],
            CardDrawn:      [{ type: "CardDrawn", player: bob, card: null }, "Bob drew a card."],
            DistancePlayed: [
                { type: "DistancePlayed", player: bob, card: Card.dist50, team: team(1) },
                "Bob drove 50 miles.",
            ],
            HazardPlayed: [
                { type: "HazardPlayed", player: bob, card: Card.flatTire, targetTeam: team(0) },
                "Bob played Flat Tire on Team 1.",
            ],
            HazardLanded: [
                { type: "HazardLanded", card: Card.flatTire, targetTeam: team(0) },
                "Flat Tire hit Team 1.",
            ],
            RemedyPlayed: [
                { type: "RemedyPlayed", player: bob, card: Card.spareTire, team: team(1) },
                "Bob played Spare Tire.",
            ],
            SafetyPlayed: [
                { type: "SafetyPlayed", player: bob, card: Card.punctureProof, team: team(1) },
                "Bob played Puncture Proof.",
            ],
            CoupFourrePlayed: [
                {
                    type:   "CoupFourrePlayed",
                    player: bob,
                    card:   Card.punctureProof,
                    team:   team(1),
                    hazard: Card.flatTire,
                },
                "Bob blocked Flat Tire with a Coup Fourre, playing Puncture Proof!",
            ],
            CardDiscarded: [
                { type: "CardDiscarded", player: bob, card: Card.roll },
                "Bob discarded Roll.",
            ],
            ExtensionOffered: [
                { type: "ExtensionOffered", player: bob, team: team(1) },
                "Team 2 reached 700 miles. Bob can stop or go for 1,000.",
            ],
            ExtensionCalled: [
                { type: "ExtensionCalled", player: bob, team: team(1) },
                "Bob called Extension: Team 2 is racing on to 1,000!",
            ],
            ExtensionDeclined: [
                { type: "ExtensionDeclined", player: bob, team: team(1) },
                "Bob chose to stop at 700 miles.",
            ],
            RaceEnded: [
                {
                    type:   "RaceEnded",
                    result: {
                        outcome: {
                            kind:            "TripCompleted",
                            team:            team(1),
                            delayedAction:   false,
                            extensionCaller: null,
                        },
                        scores: [],
                    },
                },
                "Race over! Team 2 completed the trip.",
            ],
            GameEnded:      [{ type: "GameEnded", winner: team(1) }, "Team 2 wins the game!"],
        };
        /* eslint-enable @typescript-eslint/naming-convention */


        it.each(Object.entries(bobSamples))("describes %s", (_type, [event, expected]) => {
            expect(describeEvent(event, view)).toBe(expected);
        });


        it("never says you about another player or prints null or undefined", () => {
            for (const [event] of Object.values(bobSamples)) {
                const text = describeEvent(event, view);
                expect(text).not.toMatch(/\byou\b/iu);
                expect(text).not.toMatch(/null|undefined/u);
            }
        });


        it("says You for the viewer's own events", () => {
            expect(describeEvent({ type: "TurnStarted", player: ann }, view))
            .toBe("It's your turn.");
            expect(describeEvent(
                { type: "HazardPlayed", player: ann, card: Card.stop, targetTeam: team(1) },
                view
            )).toBe("You played Stop on Team 2.");
            expect(describeEvent(
                {
                    type:   "CoupFourrePlayed",
                    player: ann,
                    card:   Card.extraTank,
                    team:   team(0),
                    hazard: Card.outOfGas,
                },
                view
            )).toBe("You blocked Out of Gas with a Coup Fourre, playing Extra Tank!");
            expect(describeEvent({ type: "ExtensionOffered", player: ann, team: team(0) }, view))
            .toBe("Team 1 reached 700 miles. You can stop or go for 1,000.");
        });


        it("tells the viewer when their own team completed the trip", () => {
            const event: GameEvent = {
                type:   "RaceEnded",
                result: {
                    outcome: {
                        kind:            "TripCompleted",
                        team:            team(0),
                        delayedAction:   false,
                        extensionCaller: null,
                    },
                    scores: [],
                },
            };
            expect(describeEvent(event, view)).toBe("Race over! Your team completed the trip!");
        });


        it("names the card the viewer drew", () => {
            expect(describeEvent({ type: "CardDrawn", player: ann, card: Card.flatTire }, view))
            .toBe("You drew Flat Tire.");
            expect(describeEvent({ type: "CardDrawn", player: ann, card: null }, view))
            .toBe("You drew a card.");
        });


        it("says Someone for a player the view does not know", () => {
            const event: GameEvent = {
                type: "DistancePlayed", player: PlayerId.create(), card: Card.dist25, team: team(0),
            };
            expect(describeEvent(event, view)).toBe("Someone drove 25 miles.");
        });


        it("returns a name containing markup verbatim", () => {
            const odd = viewForSeats(2, { names: ["Ann", "<b>Bob</b>"] });
            expect(describeEvent({ type: "TurnStarted", player: idOf(odd, "<b>Bob</b>") }, odd))
            .toBe("It's <b>Bob</b>'s turn.");
        });

    });


    describe("describeRaceResult", () => {

        it("names the team that completed the trip", () => {
            const outcome = {
                kind: "TripCompleted", team: team(2), delayedAction: false, extensionCaller: null,
            } as const;
            expect(describeRaceResult({ outcome, scores: [] }, team(0)))
            .toBe("Team 3 completed the trip.");
        });


        it("says your team when the viewer's team completed the trip", () => {
            const outcome = {
                kind: "TripCompleted", team: team(2), delayedAction: false, extensionCaller: null,
            } as const;
            expect(describeRaceResult({ outcome, scores: [] }, team(2)))
            .toBe("Your team completed the trip!");
        });


        it("names the team that was farthest ahead when the cards ran out", () => {
            const outcome = { kind: "Exhausted", winner: team(1), extensionCaller: null } as const;
            expect(describeRaceResult({ outcome, scores: [] }, team(0)))
            .toBe("The cards ran out, and Team 2 was farthest ahead.");
        });


        it("says your team when the viewer's team was farthest ahead", () => {
            const outcome = { kind: "Exhausted", winner: team(1), extensionCaller: null } as const;
            expect(describeRaceResult({ outcome, scores: [] }, team(1)))
            .toBe("The cards ran out, and your team was farthest ahead!");
        });


        it("says so when the cards ran out in a tie", () => {
            const outcome = { kind: "Exhausted", winner: "Tie", extensionCaller: null } as const;
            expect(describeRaceResult({ outcome, scores: [] }, team(0)))
            .toBe("The cards ran out, and it is a tie.");
        });

    });

});
