import { Card } from "@repo/mille-bornes-core/card";
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


            it("leaks nothing to a player who is not on the target team", () => {
                const text = topBarMessage(bystander).text;
                expect(text).not.toContain("Puncture Proof");
                expect(text).not.toMatch(/coup/iu);
                expect(text).not.toMatch(/safety|holds|play it now/iu);
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
                const offer = withPhase(view, { kind: "ExtensionOffer", decider: ann, team: team(0) });
                const message = topBarMessage(offer);
                expect(message.tone).toBe("MyTurn");
                expect(message.text).toBe(
                    "You reached 700 miles! Stop here, or race on to 1,000? " +
                    "If you do not get there first, every other team scores 200."
                );
            });


            it("tells everyone else who is deciding", () => {
                const offer = withPhase(view, { kind: "ExtensionOffer", decider: bob, team: team(1) });
                expect(topBarMessage(offer)).toEqual({
                    text: "Bob is deciding whether to go for 1,000",
                    tone: "Info",
                });
            });

        });


        describe("end of a race and of the game", () => {

            const result = {
                outcome: {
                    kind: "TripCompleted", team: team(1), delayedAction: false, extensionCaller: null,
                },
                scores: [],
            } as const;


            it("announces the end of a race with its result", () => {
                expect(topBarMessage(withPhase(view, { kind: "RaceOver", result }))).toEqual({
                    text: "Race over! Team 2 completed the trip.",
                    tone: "Info",
                });
            });


            it("congratulates the winning team by name", () => {
                const over = withPhase(view, { kind: "GameOver", winner: team(1), result, reveal: [] });
                expect(topBarMessage(over)).toEqual({
                    text: "Game over! Team 2 (Bob) wins. Congratulations!",
                    tone: "Info",
                });
            });


            it("says you when the viewer's team won", () => {
                const over = withPhase(view, { kind: "GameOver", winner: team(0), result, reveal: [] });
                expect(topBarMessage(over).text)
                .toBe("Game over! Team 1 (you) wins. Congratulations!");
            });

        });

    });

});
