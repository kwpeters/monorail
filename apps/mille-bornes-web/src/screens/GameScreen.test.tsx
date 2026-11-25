import type { Card } from "@repo/mille-bornes-core/card";
import { viewFor, type PlayerView } from "@repo/mille-bornes-core/view";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { annPlays } from "../testing/engineBatches.mjs";
import { cardFace } from "../text/cardFace.mjs";
import { topBarMessage } from "../text/phaseHint.mjs";
import {
    gameForSeats, idOf, playingScreen, team, viewForSeats, withPhase, withZone,
    type SeatCount
} from "../testing/viewFixtures.mjs";
import {
    blockedZone, rollingZone, speedLimitedZone, withSafety
} from "../testing/zoneFixtures.mjs";
import { GameScreen, type PlayingData } from "./GameScreen.js";


const hostile = "<img src=x onerr=1>";
const long = "ABCDEFGHIJKLMNOPQRST";
const robotIcon = "\u{1F916}";


function show(screenData: PlayingData) {
    return render(<GameScreen screen={screenData} />);
}


function lanes(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>("[data-anim-anchor^='team-']")];
}


function discardOf(view: PlayerView): Card[] {
    return view.discardTop === null ? [] : [view.discardTop];
}


function cardsInDom(): string[] {
    return [...document.querySelectorAll("[data-card]")].map((c) => c.getAttribute("data-card")!);
}


describe("GameScreen", () => {

    describe("the team rows", () => {

        it.each<[SeatCount, number, string]>([
            [2, 2, "of 700"],
            [3, 3, "of 700"],
            [4, 2, "of 1,000"],
            [6, 3, "of 700"],
        ])("shows one row per team for %i seats with the trip distance", (seats, teams, trip) => {
            show(playingScreen(viewForSeats(seats)));
            expect(lanes()).toHaveLength(teams);
            expect(screen.getAllByText(trip)).toHaveLength(teams);
            expect(screen.getAllByRole("progressbar")).toHaveLength(teams);
        });


        it("shows each team's miles and status as text", () => {
            let view = viewForSeats(3);
            view = withZone(view, 0, withSafety(rollingZone(["100", "25"]), "Right of Way"));
            view = withZone(view, 1, blockedZone("Out of Gas", ["50"]));
            view = withZone(view, 2, speedLimitedZone());
            show(playingScreen(view));
            const [one, two, three] = lanes().map((lane) => within(lane));
            expect(one!.getByText("125")).toBeInTheDocument();
            expect(one!.getByText("Rolling")).toBeInTheDocument();
            expect(one!.getByText("Right of Way")).toBeInTheDocument();
            expect(two!.getByText("50")).toBeInTheDocument();
            expect(two!.getByText("Out of Gas")).toBeInTheDocument();
            expect(three!.getByText("Speed Limit: 50 max")).toBeInTheDocument();
        });


        it("marks the player on turn in a way that is not only a color", () => {
            show(playingScreen(viewForSeats(4)));
            const ann = screen.getByText("Ann").closest("li")!;
            expect(ann).toHaveAttribute("aria-current", "true");
            expect(ann).toHaveTextContent("●");
            expect(screen.getAllByRole("listitem", { current: true }).length).toBeGreaterThan(0);
            const current = lanes().filter((l) => l.getAttribute("aria-current") === "true");
            expect(current).toHaveLength(1);
        });


        it("marks no one when the race is over", () => {
            const result = {
                outcome: {
                    kind:            "TripCompleted",
                    team:            team(1),
                    delayedAction:   false,
                    extensionCaller: null,
                },
                scores: [],
            } as const;
            show(playingScreen(withPhase(viewForSeats(2), { kind: "RaceOver", result })));
            expect(lanes().filter((l) => l.hasAttribute("aria-current"))).toHaveLength(0);
        });

    });


    describe("the hand and hidden information", () => {

        it("shows exactly the viewer's cards and the discard top, nothing else", () => {
            const game = gameForSeats(2);
            const ann = game.players[0]!;
            const bob = game.players[1]!;
            const view = viewFor(game, ann.seat.id).throwIfFailed();
            show(playingScreen(view));

            expect(cardsInDom()).toEqual([...ann.hand, ...discardOf(view)]);
            const hand = screen.getByRole("region", { name: "Your hand" });
            expect(within(hand).getAllByRole("listitem")).toHaveLength(ann.hand.length);

            // A card only the other player holds appears nowhere.
            const onlyBobs: Card[] = bob.hand
            .filter((c) => !ann.hand.includes(c) && c !== view.discardTop);
            expect(onlyBobs.length).toBeGreaterThan(0);
            for (const card of onlyBobs) {
                expect(screen.queryByText(cardFace(card).label)).not.toBeInTheDocument();
            }
        });


        it("shows other seats only as names, never as cards", () => {
            show(playingScreen(viewForSeats(6)));
            const view = viewForSeats(6);
            expect(cardsInDom()).toEqual([...view.me.hand, ...discardOf(view)]);
        });

    });


    describe("the piles", () => {

        it("shows the draw pile count and an empty discard pile", () => {
            const view = viewForSeats(2);
            show(playingScreen({ ...view, discardTop: null }));
            expect(screen.getByRole("img", { name: `Draw pile, ${view.drawPileCount} cards` }))
            .toBeInTheDocument();
            expect(screen.getByRole("group", { name: "Discard pile, empty" })).toBeInTheDocument();
        });


        it("shows the top of the discard pile", () => {
            show(playingScreen({ ...viewForSeats(2), discardTop: "Stop" }));
            const pile = screen.getByRole("group", { name: "Discard pile" });
            expect(within(pile).getByText("Stop")).toBeInTheDocument();
        });

    });


    describe("organizer-only markers", () => {

        const view = viewForSeats(4);
        const ann = idOf(view, "Ann");
        const bob = idOf(view, "Bob");
        const cy = idOf(view, "Cy");
        const di = idOf(view, "Di");


        it("shows robots and disconnected seats on the organizer's screen", () => {
            show(playingScreen(view, {
                isOrganizer: true,
                robots:      [bob, cy, di],
                connected:   [ann, bob, cy],
            }));
            expect(screen.getAllByText(robotIcon)).toHaveLength(3);
            expect(screen.getAllByText("Robot")).toHaveLength(3);
            expect(within(screen.getByText("Di").closest("li")!).getByText(/disconnected/u))
            .toBeInTheDocument();
            expect(screen.getAllByText(/disconnected/u)).toHaveLength(1);
        });


        it("shows nothing for either when the server sends no lists", () => {
            show(playingScreen(view));
            expect(screen.queryByText(robotIcon)).not.toBeInTheDocument();
            expect(screen.queryByText("Robot")).not.toBeInTheDocument();
            expect(screen.queryByText(/disconnected/u)).not.toBeInTheDocument();
        });


        it("treats one list being known and the other not independently", () => {
            show(playingScreen(view, { isOrganizer: true, robots: [cy], connected: null }));
            expect(screen.getAllByText("Robot")).toHaveLength(1);
            expect(screen.queryByText(/disconnected/u)).not.toBeInTheDocument();
        });

    });


    describe("names from other people", () => {

        const names = [long, hostile, "Cy", "Di", "Ed", "Flo"];
        const view = viewForSeats(6, { names });


        it("renders HTML in a name as text", () => {
            const { container } = show(playingScreen(view));
            expect(container.querySelector("img")).toBeNull();
            expect(screen.getAllByText(hostile).length).toBeGreaterThan(0);
        });


        it("truncates every player chip name of a table of six", () => {
            show(playingScreen(view));
            for (const name of names) {
                const chip = screen.getAllByText(name).find((el) => el.closest("li") !== null)!;
                expect(chip).toHaveClass("truncate");
            }
            expect(screen.getAllByRole("list", { name: "Players" })).toHaveLength(3);
        });


        it("truncates the team titles, which hold the names", () => {
            show(playingScreen(view));
            for (const heading of screen.getAllByRole("heading", { level: 2 })
            .filter((h) => h.textContent.startsWith("Team"))) {
                expect(heading).toHaveClass("truncate");
            }
        });

    });


    describe("the top bar", () => {

        function bar(): HTMLElement {
            return document.querySelector<HTMLElement>("[aria-live='polite'].top-bar")!;
        }


        it("tells the viewer it is their turn", () => {
            const view = viewForSeats(2);
            show(playingScreen(view));
            expect(bar()).toHaveTextContent(topBarMessage(view).text);
            expect(bar()).toHaveClass("tone-green");
        });


        it("names the player whose turn it is when it is not the viewer's", () => {
            const view = viewForSeats(2, { viewer: 1 });
            show(playingScreen(view));
            expect(bar()).toHaveTextContent("Waiting for Ann to play");
            expect(bar()).toHaveClass("tone-blue");
        });


        it("announces the end of a race", () => {
            const result = {
                outcome: {
                    kind:            "TripCompleted",
                    team:            team(1),
                    delayedAction:   false,
                    extensionCaller: null,
                },
                scores: [],
            } as const;
            const view = withPhase(viewForSeats(2), { kind: "RaceOver", result });
            show(playingScreen(view));
            expect(bar()).toHaveTextContent(topBarMessage(view).text);
        });


        it("is red for a hazard window against the viewer's team", () => {
            const base: PlayerView = viewForSeats(2);
            const view = withPhase(base, {
                kind: "HazardIncoming", attacker: idOf(base, "Bob"), hazard: "Stop", target: team(0)
            });
            show(playingScreen(view));
            expect(bar()).toHaveClass("tone-red");
        });

    });


    describe("the last move", () => {

        it("shows the move of an engine batch and keeps it when a later screen has none", () => {
            // The batch ends with the next turn and its draw, as the engine emits it.
            const { view, events } = annPlays({ type: "Drive", card: "50" });
            const { rerender } = show(playingScreen(view, { events }));
            expect(screen.getByRole("status")).toHaveTextContent("You drove 50 miles.");
            rerender(<GameScreen screen={playingScreen(view, { events: [] })} />);
            expect(screen.getByRole("status")).toHaveTextContent("You drove 50 miles.");
        });

    });


    describe("anchors", () => {

        it("anchors the draw pile, the discard pile, the hand and each lane", () => {
            show(playingScreen(viewForSeats(3)));
            const anchors = ["draw-pile", "discard-pile", "hand", "team-0", "team-1", "team-2"];
            for (const anchor of anchors) {
                expect(document.querySelectorAll(`[data-anim-anchor='${anchor}']`)).toHaveLength(1);
            }
        });

    });

});
