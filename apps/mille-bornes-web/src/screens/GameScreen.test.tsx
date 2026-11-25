import type { Card } from "@repo/mille-bornes-core/card";
import { viewFor, type PlayerView } from "@repo/mille-bornes-core/view";
import { applySystemCommand } from "@repo/mille-bornes-core/engine";
import { describeRejection } from "@repo/mille-bornes-core/rejection";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    annPlays, extensionOffer, flatTireWindow, midRace, viewOf
} from "../testing/engineBatches.mjs";
import { createFakeApi, failWire, neverSettles, type FakeApi } from "../testing/fakeApi.mjs";
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


function show(screenData: PlayingData, fake: FakeApi = createFakeApi()) {
    const rendered = render(<GameScreen screen={screenData} api={fake.api} />);
    const again = (next: PlayingData): void => {
        rendered.rerender(<GameScreen screen={next} api={fake.api} />);
    };
    return { ...rendered, again, fake };
}


function lanes(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>("[data-anim-anchor^='team-']")];
}


function discardOf(view: PlayerView): Card[] {
    return view.discardTop === null ? [] : [view.discardTop];
}


function bar(): HTMLElement {
    return document.querySelector<HTMLElement>("[aria-live='polite'].top-bar")!;
}


function card(name: string): HTMLElement {
    const hand = screen.getByRole("region", { name: "Your hand" });
    return within(hand).getByRole("button", { name });
}


function pressedCards(): HTMLElement[] {
    return [...document.querySelectorAll<HTMLElement>(".hand [aria-pressed='true']")];
}


function lane(n: number): HTMLElement {
    return document.querySelector<HTMLElement>(`[data-anim-anchor='team-${n}']`)!;
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
            const { again } = show(playingScreen(view, { events }));
            expect(screen.getByRole("status")).toHaveTextContent("You drove 50 miles.");
            again(playingScreen(view, { events: [] }));
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


    describe("playing a card", () => {

        const ann = (): PlayingData => playingScreen(viewOf(midRace, "Ann"));


        it("sends one play for a card tapped and then played", async () => {
            const user = userEvent.setup();
            const { fake } = show(ann());
            await user.click(card("50 miles"));
            expect(card("50 miles")).toHaveAttribute("aria-pressed", "true");
            await user.click(screen.getByRole("button", { name: "Play" }));
            expect(fake.procs.play).toHaveBeenCalledExactlyOnceWith({ type: "Drive", card: "50" });
            expect(pressedCards()).toHaveLength(0);
        });


        it("sends one play for a double tap on the target", async () => {
            const user = userEvent.setup();
            const { fake } = show(ann());
            await user.click(card("50 miles"));
            const play = screen.getByRole("button", { name: "Play" });
            await act(async () => {
                play.click();
                play.click();
                await Promise.resolve();
            });
            expect(fake.procs.play).toHaveBeenCalledOnce();
        });


        it("offers an attack on each lane it can land on, and the discard pile", async () => {
            const user = userEvent.setup();
            const { fake } = show(ann());
            await user.click(card("Stop"));
            expect(within(lane(0)).queryByRole("button")).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
            await user.click(within(lane(1)).getByRole("button", { name: "Play on Team 2" }));
            expect(fake.procs.play).toHaveBeenCalledExactlyOnceWith(
                { type: "Attack", card: "Stop", targetTeam: 1 }
            );
        });


        it("discards the card picked up", async () => {
            const user = userEvent.setup();
            const { fake } = show(ann());
            await user.click(card("25 miles"));
            await user.click(screen.getByRole("button", { name: "Discard" }));
            expect(fake.procs.play).toHaveBeenCalledExactlyOnceWith({ type: "Discard", card: "25" });
        });


        it("shows a refusal from the server, clears the selection and stays usable", async () => {
            const user = userEvent.setup();
            const fake = createFakeApi();
            fake.procs.play.mockResolvedValueOnce(failWire("The server says no."));
            show(ann(), fake);
            await user.click(card("50 miles"));
            await user.click(screen.getByRole("button", { name: "Play" }));
            await waitFor(() => expect(bar()).toHaveTextContent("The server says no."));
            expect(pressedCards()).toHaveLength(0);
            await user.click(card("25 miles"));
            expect(card("25 miles")).toHaveAttribute("aria-pressed", "true");
        });


        it("dims a card with no play, explains it and sends nothing", async () => {
            const user = userEvent.setup();
            const { fake } = show(ann());
            expect(card("Roll")).toHaveAttribute("aria-disabled", "true");
            expect(card("50 miles")).not.toHaveAttribute("aria-disabled");
            await user.click(card("Roll"));
            expect(bar()).toHaveTextContent(
                describeRejection({ reason: "RollNotNeeded", because: "AlreadyRolling" })
            );
            expect(fake.procs.play).not.toHaveBeenCalled();
            // It can still be thrown away.
            expect(screen.queryByRole("button", { name: "Play" })).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
        });


        it("shows the reason for at most 3 seconds", () => {
            vi.useFakeTimers();
            try {
                show(ann());
                fireEvent.click(card("Roll"));
                act(() => {
                    vi.advanceTimersByTime(3000);
                });
                expect(bar()).toHaveTextContent("Your turn: play or discard a card");
            }
            finally {
                vi.useRealTimers();
            }
        });


        it("cancels when the card is tapped again or the background is tapped", async () => {
            const user = userEvent.setup();
            show(ann());
            await user.click(card("50 miles"));
            await user.click(card("50 miles"));
            expect(pressedCards()).toHaveLength(0);
            await user.click(card("Stop"));
            await user.click(screen.getByRole("status"));
            expect(pressedCards()).toHaveLength(0);
            expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
        });


        it("selects nothing and sends nothing when it is not the viewer's turn", async () => {
            const user = userEvent.setup();
            const { fake } = show(playingScreen(viewOf(midRace, "Bob")));
            for (const button of within(screen.getByRole("list", { name: "Cards" }))
            .getAllByRole("button")) {
                expect(button).toHaveAttribute("aria-disabled", "true");
            }
            await user.click(card("75 miles"));
            expect(bar()).toHaveTextContent("It's Ann's turn.");
            expect(pressedCards()).toHaveLength(0);
            expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
            expect(fake.procs.play).not.toHaveBeenCalled();
        });


        it("ignores taps while a play is in flight", async () => {
            const user = userEvent.setup();
            const fake = createFakeApi();
            fake.procs.play.mockReturnValueOnce(neverSettles());
            show(ann(), fake);
            await user.click(card("50 miles"));
            await user.click(screen.getByRole("button", { name: "Play" }));
            await user.click(card("25 miles"));
            expect(pressedCards()).toHaveLength(0);
            expect(screen.queryByRole("button", { name: "Discard" })).not.toBeInTheDocument();
            expect(fake.procs.play).toHaveBeenCalledOnce();
        });


        it("works from the keyboard", async () => {
            const user = userEvent.setup();
            const { fake } = show(ann());
            const tabTo = async (el: HTMLElement): Promise<void> => {
                for (let i = 0; i < 30 && document.activeElement !== el; i++) {
                    await user.tab();
                }
                expect(el).toHaveFocus();
            };
            await tabTo(card("100 miles"));
            await user.keyboard(" ");
            expect(card("100 miles")).toHaveAttribute("aria-pressed", "true");
            await tabTo(screen.getByRole("button", { name: "Play" }));
            await user.keyboard("{Enter}");
            expect(fake.procs.play).toHaveBeenCalledExactlyOnceWith({ type: "Drive", card: "100" });
        });


        it("opens a card's help on a long press, without picking it up", () => {
            vi.useFakeTimers();
            try {
                const { fake } = show(ann());
                fireEvent.pointerDown(card("Stop"));
                act(() => {
                    vi.advanceTimersByTime(500);
                });
                fireEvent.pointerUp(card("Stop"));
                fireEvent.click(card("Stop"));
                expect(screen.getByRole("dialog", { name: "Stop" }))
                .toHaveTextContent(cardFace("Stop").blurb);
                expect(pressedCards()).toHaveLength(0);
                expect(fake.procs.play).not.toHaveBeenCalled();
            }
            finally {
                vi.useRealTimers();
            }
        });


        it("clears a selection when the turn passes, and says so", async () => {
            const user = userEvent.setup();
            const { again } = show(ann());
            await user.click(card("50 miles"));
            again(playingScreen(annPlays({ type: "Drive", card: "25" }).view));
            expect(pressedCards()).toHaveLength(0);
            expect(bar()).toHaveTextContent("It is no longer your turn.");
        });


        it("says nothing when the turn passes with nothing picked up", () => {
            const { again } = show(ann());
            again(playingScreen(annPlays({ type: "Drive", card: "25" }).view));
            expect(bar()).toHaveTextContent("Waiting for Bob to play");
        });

    });


    describe("the hazard window", () => {

        const windowFor = (name: string, remainingMs = 5000): PlayingData => playingScreen(
            viewOf(flatTireWindow, name),
            { timer: { kind: "HazardWindow", remainingMs } }
        );


        beforeEach(() => {
            vi.useFakeTimers();
        });


        afterEach(() => {
            vi.useRealTimers();
        });


        function banner(): HTMLElement {
            return screen.getByRole("region", { name: "Flat Tire!" });
        }


        it("shows the holder of the counter a banner, a countdown and a glowing card", () => {
            const { fake } = show(windowFor("Di"));
            expect(within(banner()).getByRole("timer")).toHaveTextContent("5 seconds left");
            act(() => {
                vi.advanceTimersByTime(1000);
            });
            expect(within(banner()).getByRole("timer")).toHaveTextContent("4 seconds left");
            expect(card("Puncture Proof Blocks it!")).toHaveClass("counter");
            fireEvent.click(card("Puncture Proof Blocks it!"));
            fireEvent.click(screen.getByRole("button", { name: "Play" }));
            expect(fake.procs.play)
            .toHaveBeenCalledExactlyOnceWith({ type: "CoupFourre", card: "Puncture Proof" });
        });


        it("shows every member of the hit team the same banner and top bar", () => {
            const { unmount } = show(windowFor("Di"));
            const di = { banner: banner().textContent, bar: bar().textContent };
            unmount();
            show(windowFor("Bob"));
            expect({ banner: banner().textContent, bar: bar().textContent }).toEqual(di);
            expect(screen.queryByText("Blocks it!")).not.toBeInTheDocument();
            expect(document.querySelector(".counter")).toBeNull();
        });


        it("tells the other teams nothing beyond the hazard played", () => {
            for (const name of ["Ann", "Cy"]) {
                const { unmount } = show(windowFor(name));
                expect(screen.queryByRole("region", { name: "Flat Tire!" })).not.toBeInTheDocument();
                expect(screen.queryByRole("timer")).not.toBeInTheDocument();
                expect(screen.queryByText(/second/u)).not.toBeInTheDocument();
                expect(screen.queryByText("Blocks it!")).not.toBeInTheDocument();
                expect(document.querySelector(".counter")).toBeNull();
                expect(bar()).toHaveClass("tone-blue");
                expect(bar()).toHaveTextContent(/played Flat Tire on Team 2\./u);
                unmount();
            }
        });


        it("keeps what to do in the banner while the top bar explains a tap", () => {
            show(windowFor("Bob"));
            expect(banner()).toHaveTextContent(topBarMessage(viewOf(flatTireWindow, "Bob")).text);
            fireEvent.click(card("75 miles"));
            expect(bar()).toHaveTextContent(describeRejection({ reason: "WindowOpen" }));
            expect(banner()).toHaveTextContent(
                "If anyone on your team holds Puncture Proof, play it now."
            );
        });


        it("clears the banner and a half-finished selection when the window closes", () => {
            const { again } = show(windowFor("Di"));
            fireEvent.click(card("Puncture Proof Blocks it!"));
            expect(pressedCards()).toHaveLength(1);
            const closed = applySystemCommand(flatTireWindow, { type: "CloseHazardWindow" })
            .throwIfFailed().game;
            again(playingScreen(viewOf(closed, "Di")));
            expect(screen.queryByRole("region", { name: "Flat Tire!" })).not.toBeInTheDocument();
            expect(pressedCards()).toHaveLength(0);
            expect(bar()).toHaveTextContent("That window closed.");
        });


        it("starts the countdown again from a reconnect snapshot", () => {
            const { again } = show(windowFor("Bob", 5000));
            act(() => {
                vi.advanceTimersByTime(1000);
            });
            again(windowFor("Bob", 2000));
            expect(within(banner()).getByRole("timer")).toHaveTextContent("2 seconds left");
            expect(bar()).toHaveTextContent("You have 2 seconds.");
        });

    });


    describe("the Extension offer", () => {

        const offerFor = (name: string): PlayingData => playingScreen(
            viewOf(extensionOffer, name),
            { timer: { kind: "ExtensionOffer", remainingMs: 30000 } }
        );


        it("sends the decider's choice once, however fast they tap", async () => {
            const { fake } = show(offerFor("Ann"));
            const call = screen.getByRole("button", { name: "Call Extension" });
            await act(async () => {
                call.click();
                call.click();
                screen.getByRole("button", { name: "Stop here" }).click();
                await Promise.resolve();
            });
            expect(fake.procs.play).toHaveBeenCalledExactlyOnceWith({ type: "CallExtension" });
        });


        it("lets the decider stop here", async () => {
            const { fake } = show(offerFor("Ann"));
            await userEvent.setup().click(screen.getByRole("button", { name: "Stop here" }));
            expect(fake.procs.play).toHaveBeenCalledExactlyOnceWith({ type: "DeclineExtension" });
        });


        it("gives everyone else no buttons", () => {
            show(offerFor("Bob"));
            expect(screen.queryByRole("button", { name: "Call Extension" })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Stop here" })).not.toBeInTheDocument();
            expect(bar()).toHaveTextContent("Ann is deciding whether to go for 1,000");
        });

    });

});
