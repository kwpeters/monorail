import { Card } from "@repo/mille-bornes-core/card";
import { PlayerId } from "@repo/mille-bornes-core/ids";
import { describe, expect, it } from "vitest";
import { idOf, team, viewForSeats, withPhase } from "../testing/viewFixtures.mjs";
import { topBarMessage } from "./phaseHint.mjs";


describe("phaseHint", () => {

    describe("topBarMessage", () => {

        // Ann (team 0) is the viewer; Bob is team 1 and Cy is team 2.
        const view = viewForSeats(3);
        const ann = idOf(view, "Ann");
        const bob = idOf(view, "Bob");
        const cy = idOf(view, "Cy");


        it("tells me when it is my turn", () => {
            expect(topBarMessage(withPhase(view, { kind: "Turn", player: ann }))).toEqual({
                text: "Your turn: play or discard a card",
                tone: "MyTurn",
            });
        });


        it("names the player whose turn it is", () => {
            expect(topBarMessage(withPhase(view, { kind: "Turn", player: bob }))).toEqual({
                text: "Waiting for Bob to play",
                tone: "Waiting",
            });
        });


        describe("hazard window", () => {

            const incoming = withPhase(view, {
                kind: "HazardIncoming", attacker: bob, hazard: Card.flatTire, target: team(0),
            });


            // Cy is on team 2, so the hazard is not aimed at Cy's team.
            const bystander = { ...incoming, me: { ...incoming.me, id: cy, team: team(2) } };


            it("alerts the target team with the counter safety", () => {
                expect(topBarMessage(incoming)).toEqual({
                    text: "Flat Tire! You have 5 seconds. " +
                        "If anyone on your team holds Puncture Proof, play it now.",
                    tone: "Alert",
                });
            });


            it("uses the window length it is given", () => {
                expect(topBarMessage(incoming, 8).text).toContain("You have 8 seconds.");
                expect(topBarMessage(incoming, 1).text).toContain("You have 1 second.");
            });


            it("gives Right of Way as the counter to Stop", () => {
                const stop = withPhase(view, {
                    kind: "HazardIncoming", attacker: bob, hazard: Card.stop, target: team(0),
                });
                expect(topBarMessage(stop).text)
                .toBe("Stop! You have 5 seconds. " +
                    "If anyone on your team holds Right of Way, play it now.");
            });


            it("gives a player on another team only what happened", () => {
                expect(topBarMessage(bystander)).toEqual({
                    text: "Bob played Flat Tire on Team 1.",
                    tone: "Info",
                });
            });


            it("gives target-team members with different hands identical text", () => {
                const holder = {
                    ...incoming, me: { ...incoming.me, hand: [Card.punctureProof, Card.roll] },
                };
                const nonHolder = {
                    ...incoming, me: { ...incoming.me, hand: [Card.dist25, Card.dist50] },
                };
                expect(topBarMessage(holder)).toEqual(topBarMessage(nonHolder));
                expect(topBarMessage(holder).tone).toBe("Alert");
            });


            it("gives a teammate of the attacker the neutral text", () => {
                // Bob attacks; a second member of Bob's team sees what Bob played.
                const teammate = {
                    ...incoming,
                    me: { ...incoming.me, id: PlayerId.create(), team: team(1) },
                };
                expect(topBarMessage(teammate)).toEqual({
                    text: "Bob played Flat Tire on Team 1.",
                    tone: "Info",
                });
            });


            it("names no safety card to a player off the target team, for every hazard", () => {
                const cases = [
                    [Card.accident, "Driving Ace"],
                    [Card.outOfGas, "Extra Tank"],
                    [Card.flatTire, "Puncture Proof"],
                    [Card.speedLimit, "Right of Way"],
                    [Card.stop, "Right of Way"],
                ] as const;
                for (const [hazard, safetyLabel] of cases) {
                    const aimed = withPhase(view, {
                        kind: "HazardIncoming", attacker: bob, hazard, target: team(0),
                    });
                    const outsider = { ...aimed, me: { ...aimed.me, id: cy, team: team(2) } };
                    const { text, tone } = topBarMessage(outsider);
                    expect(tone, hazard).toBe("Info");
                    expect(text, hazard).not.toContain(safetyLabel);
                    expect(text, hazard).not.toMatch(/coup fourr/iu);
                    expect(text, hazard).not.toMatch(/hold|counter|play it now/iu);
                }
            });


            it("tells the attacker plainly what they played", () => {
                const mine = withPhase(view, {
                    kind: "HazardIncoming", attacker: ann, hazard: Card.stop, target: team(1),
                });
                expect(topBarMessage(mine)).toEqual({
                    text: "You played Stop on Team 2.",
                    tone: "Info",
                });
            });

        });


        describe("Extension offer", () => {

            it("asks the decider to stop or race on, with the risk", () => {
                const offer = withPhase(view, {
                    kind: "ExtensionOffer", decider: ann, team: team(0),
                });
                const message = topBarMessage(offer);
                expect(message.tone).toBe("MyTurn");
                expect(message.text).toBe(
                    "You reached 700 miles! Stop here, or race on to 1,000? " +
                    "If you do not get there first, every other team scores 200."
                );
            });


            it("tells everyone else who is deciding", () => {
                const offer = withPhase(view, {
                    kind: "ExtensionOffer", decider: bob, team: team(1),
                });
                expect(topBarMessage(offer)).toEqual({
                    text: "Bob is deciding whether to go for 1,000",
                    tone: "Info",
                });
            });

        });


        describe("end of a race and of the game", () => {

            const result = {
                outcome: {
                    kind:            "TripCompleted",
                    team:            team(1),
                    delayedAction:   false,
                    extensionCaller: null,
                },
                scores: [],
            } as const;


            it("announces the end of a race with its result", () => {
                expect(topBarMessage(withPhase(view, { kind: "RaceOver", result }))).toEqual({
                    text: "Race over! Team 2 completed the trip.",
                    tone: "Info",
                });
            });


            it("says your team when the viewer's team completed the trip", () => {
                const mine = { ...result, outcome: { ...result.outcome, team: team(0) } };
                expect(topBarMessage(withPhase(view, { kind: "RaceOver", result: mine }))).toEqual({
                    text: "Race over! Your team completed the trip!",
                    tone: "Info",
                });
            });


            it("congratulates the winning team by name", () => {
                const over = withPhase(view, {
                    kind: "GameOver", winner: team(1), result, reveal: [],
                });
                expect(topBarMessage(over)).toEqual({
                    text: "Game over! Team 2 (Bob) wins. Congratulations!",
                    tone: "Info",
                });
            });


            it("says you when the viewer's team won", () => {
                const over = withPhase(view, {
                    kind: "GameOver", winner: team(0), result, reveal: [],
                });
                expect(topBarMessage(over).text)
                .toBe("Game over! Team 1 (you) wins. Congratulations!");
            });

        });

    });

});
