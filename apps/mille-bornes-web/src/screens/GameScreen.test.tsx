import type { Card } from "@repo/mille-bornes-core/card";
import { eventsFor, viewFor, type PlayerView } from "@repo/mille-bornes-core/view";
import { applyPlayerCommand, applySystemCommand } from "@repo/mille-bornes-core/engine";
import { describeRejection } from "@repo/mille-bornes-core/rejection";
import {
    act, cleanup, fireEvent, render, screen, waitFor, within
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    annPlays, extensionOffer, flatTireWindow, midRace, play, viewOf
} from "../testing/engineBatches.mjs";
import { createFakeEngine } from "../testing/fakeAudio.mjs";
import { AudioEngineContext } from "../sound/useSound.js";
import { createFakeApi, failWire, neverSettles, type FakeApi } from "../testing/fakeApi.mjs";
import { cardFace } from "../text/cardFace.mjs";
import { hazardAlertText, topBarMessage } from "../text/phaseHint.mjs";
import {
    gameForSeats, idOf, playingScreen, team, viewForSeats, withPhase, withZone,
    type SeatCount
} from "../testing/viewFixtures.mjs";
import {
    blockedZone, rollingZone, speedLimitedZone, withSafety
} from "../testing/zoneFixtures.mjs";
import { finishedGame, screenOf } from "../testing/finishedGames.mjs";
import type { EventBatch } from "../state/screenStore.mjs";
import { GameScreen, type PlayingData } from "./GameScreen.js";
import { Shell } from "./Shell.js";


const hostile = "<img src=x onerr=1>";
const long = "ABCDEFGHIJKLMNOPQRST";
const robotIcon = "\u{1F916}";


function show(screenData: PlayingData, fake: FakeApi = createFakeApi()) {
    const consume = vi.fn<(id: number) => void>();
    const ui = (d: PlayingData, pending: ReadonlyArray<EventBatch>): ReactElement => (
        <GameScreen screen={d} api={fake.api} pendingEvents={pending} consumeEvents={consume} />
    );
    const rendered = render(ui(screenData, []));
    // The next screen, with the store's queue as it is then (default empty).
    const again = (next: PlayingData, pending: ReadonlyArray<EventBatch> = []): void => {
        rendered.rerender(ui(next, pending));
    };
    return { ...rendered, again, fake, consume };
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


    describe("the last move and the animations", () => {

        // Engine batches end with the next turn and its draw: a Fly, a 150 ms
        // Pause and a Fly.  jsdom has no Web Animations, so only the Pause
        // takes time.
        const drove = annPlays({ type: "Drive", card: "50" });
        const discarded = annPlays({ type: "Discard", card: "25" });
        const first: EventBatch = { id: 1, events: drove.events };
        const second: EventBatch = { id: 2, events: discarded.events };


        function line(): HTMLElement {
            return screen.getByRole("status");
        }


        beforeEach(() => {
            vi.useFakeTimers();
        });


        afterEach(() => {
            vi.useRealTimers();
        });


        it("changes when a batch starts, not when its screen arrives", async () => {
            const { again, consume } = show(playingScreen(viewForSeats(2)));
            expect(line()).toHaveTextContent("Good luck!");
            // A snapshot: events in the screen, none queued.  Nothing plays.
            again(playingScreen(drove.view, { events: drove.events }));
            await act(() => vi.advanceTimersByTimeAsync(1000));
            expect(line()).toHaveTextContent("Good luck!");

            again(playingScreen(drove.view, { events: drove.events }), [first]);
            expect(line()).toHaveTextContent("Good luck!");
            await act(() => vi.advanceTimersByTimeAsync(0));
            expect(line()).toHaveTextContent("You drove 50 miles.");
            expect(consume).not.toHaveBeenCalled();
            await act(() => vi.advanceTimersByTimeAsync(150));
            expect(consume).toHaveBeenCalledExactlyOnceWith(1);
        });


        it("keeps the line while the next batch waits behind a running one", async () => {
            const { again, consume } = show(playingScreen(viewForSeats(2)));
            again(playingScreen(drove.view, { events: drove.events }), [first]);
            await act(() => vi.advanceTimersByTimeAsync(0));
            again(playingScreen(discarded.view, { events: discarded.events }), [first, second]);
            await act(() => vi.advanceTimersByTimeAsync(100));
            expect(line()).toHaveTextContent("You drove 50 miles.");
            await act(() => vi.advanceTimersByTimeAsync(100));
            expect(line()).toHaveTextContent("You discarded 25 miles.");
            await act(() => vi.advanceTimersByTimeAsync(150));
            expect(consume.mock.calls).toEqual([[1], [2]]);
        });


        it("keeps the line across a later screen with no events", async () => {
            const { again } = show(playingScreen(viewForSeats(2)));
            again(playingScreen(drove.view, { events: drove.events }), [first]);
            await act(() => vi.advanceTimersByTimeAsync(200));
            again(playingScreen(drove.view), []);
            await act(() => vi.advanceTimersByTimeAsync(200));
            expect(line()).toHaveTextContent("You drove 50 miles.");
        });


        it("keeps the table usable while a batch plays", async () => {
            const { again, consume } = show(playingScreen(viewOf(midRace, "Ann")));
            again(playingScreen(viewOf(midRace, "Ann")), [first]);
            await act(() => vi.advanceTimersByTimeAsync(0));
            fireEvent.click(card("50 miles"));
            expect(pressedCards()).toHaveLength(1);
            expect(consume).not.toHaveBeenCalled();
            await act(() => vi.advanceTimersByTimeAsync(150));
            expect(consume).toHaveBeenCalledExactlyOnceWith(1);
            expect(pressedCards()).toHaveLength(1);
        });


        it("flies in a layer that takes no taps and is hidden and empty after", async () => {
            const { again } = show(playingScreen(drove.view));
            again(playingScreen(drove.view), [first]);
            await act(() => vi.advanceTimersByTimeAsync(200));
            const layer = document.querySelector<HTMLElement>(".flying-layer")!;
            expect(layer).toHaveAttribute("aria-hidden", "true");
            expect(layer.style.pointerEvents).toBe("none");
            expect(layer).toBeEmptyDOMElement();
        });

    });


    describe("sounds", () => {

        // Bob drives after Ann: Ann's screen gets drive, yourTurn and draw.
        const afterAnn = play(midRace, "Ann", { type: "Drive", card: "50" });
        const bobs = applyPlayerCommand(afterAnn, idOf(viewOf(midRace, "Ann"), "Bob"), {
            type: "Drive", card: "75"
        }).throwIfFailed();
        const annId = idOf(viewOf(midRace, "Ann"), "Ann");
        const view = viewFor(bobs.game, annId).throwIfFailed();
        const events = eventsFor(annId, bobs.events);
        const batch: EventBatch = { id: 1, events };


        function showWithSound(data: PlayingData) {
            const engine = createFakeEngine();
            const ui = (d: PlayingData, pending: ReadonlyArray<EventBatch>): ReactElement => (
                <AudioEngineContext.Provider value={engine}>
                    <GameScreen
                        screen={d}
                        api={createFakeApi().api}
                        pendingEvents={pending}
                        consumeEvents={vi.fn()}
                    />
                </AudioEngineContext.Provider>
            );
            const rendered = render(ui(data, []));
            return {
                engine,
                again: (d: PlayingData, pending: ReadonlyArray<EventBatch> = []): void => {
                    rendered.rerender(ui(d, pending));
                }
            };
        }


        beforeEach(() => {
            vi.useFakeTimers();
        });


        afterEach(() => {
            vi.useRealTimers();
        });


        it("start when a batch starts, not when its screen arrives", async () => {
            const { engine, again } = showWithSound(playingScreen(viewForSeats(2)));
            // A snapshot: the events are in the screen and no batch is queued.
            again(playingScreen(view, { events }));
            await act(() => vi.advanceTimersByTimeAsync(2000));
            expect(engine.played).not.toHaveBeenCalled();

            again(playingScreen(view, { events }), [batch]);
            expect(engine.played).not.toHaveBeenCalled();
            await act(() => vi.advanceTimersByTimeAsync(0));
            expect(engine.played.mock.calls).toEqual([["drive"]]);
            await act(() => vi.advanceTimersByTimeAsync(240));
            expect(engine.played.mock.calls).toEqual([["drive"], ["yourTurn"], ["draw"]]);
        });


        it("stop with the screen: nothing more plays after it unmounts", async () => {
            const { engine, again } = showWithSound(playingScreen(viewForSeats(2)));
            again(playingScreen(view, { events }), [batch]);
            await act(() => vi.advanceTimersByTimeAsync(0));
            cleanup();
            await act(() => vi.advanceTimersByTimeAsync(2000));
            expect(engine.played).toHaveBeenCalledOnce();
            expect(vi.getTimerCount()).toBe(0);
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
            expect(banner()).toHaveTextContent(hazardAlertText(viewOf(flatTireWindow, "Bob")));
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


        it("shows one number: the banner's alert has no seconds, the countdown does", () => {
            show(windowFor("Bob", 2500));
            const alert = banner().querySelector(".hazard-alert")!;
            expect(alert).not.toHaveTextContent(/second/u);
            expect(alert).toHaveTextContent("If anyone on your team holds Puncture Proof");
            expect(within(banner()).getByRole("timer")).toHaveTextContent("3 seconds left");
            expect(banner()).not.toHaveTextContent("5 seconds");
        });


        it("keeps a half-finished selection when the banner is tapped", () => {
            show(windowFor("Di"));
            fireEvent.click(card("Puncture Proof Blocks it!"));
            expect(pressedCards()).toHaveLength(1);
            fireEvent.click(banner().querySelector(".hazard-alert")!);
            fireEvent.click(within(banner()).getByRole("heading"));
            expect(pressedCards()).toHaveLength(1);
            fireEvent.click(screen.getByRole("status"));
            expect(pressedCards()).toHaveLength(0);
        });


        it("leaves the seconds out of the top bar once less than a second is left", () => {
            for (const remainingMs of [0, 600]) {
                const { unmount } = show(windowFor("Bob", remainingMs));
                expect(bar()).toHaveTextContent("Flat Tire! If anyone on your team holds");
                expect(bar()).not.toHaveTextContent(/You have/u);
                unmount();
            }
            show(windowFor("Bob", 1000));
            expect(bar()).toHaveTextContent("You have 1 second.");
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


    describe("the end of a race and of the game", () => {

        const robot = "Sir Honks-a-Lot";
        const finished = finishedGame(2, {
            seed: 4, length: "Short", names: ["Ann", robot], robots: [robot],
        });
        const raceOver = finished.raceOvers[0]!;
        const gameOver = finished.gameOver;
        const next = { kind: "NextRace", remainingMs: 20000 } as const;


        function inShell(data: PlayingData, fake: FakeApi = createFakeApi()) {
            const ui = (d: PlayingData): ReactElement => (
                <Shell>
                    <GameScreen
                        screen={d}
                        api={fake.api}
                        pendingEvents={[]}
                        consumeEvents={vi.fn()}
                    />
                </Shell>
            );
            const rendered = render(ui(data));
            return { ...rendered, again: (d: PlayingData) => rendered.rerender(ui(d)), fake };
        }


        function endGameControl(): HTMLElement | null {
            return within(screen.getByRole("banner")).queryByRole("button", { name: "End game" });
        }


        it("shows the race summary instead of the table when a race is over", () => {
            const data = screenOf(raceOver, "Ann", { timer: next });
            show(data);
            expect(screen.getByRole("region", { name: "Score sheet" })).toBeInTheDocument();
            expect(screen.getByRole("timer")).toHaveTextContent("Next race in 20 s");
            expect(bar()).toHaveTextContent(topBarMessage(data.view).text);
            expect(document.querySelectorAll("[data-anim-anchor]")).toHaveLength(0);
            expect(screen.queryByRole("region", { name: "Your hand" })).not.toBeInTheDocument();
        });


        it("shows the game over screen with the reveal when the game is over", () => {
            const data = screenOf(gameOver, "Ann");
            show(data);
            expect(screen.getByRole("list", { name: "Who was who" })).toHaveTextContent(
                `Ann was... a human!${robot} was... a robot!`
            );
            expect(screen.getByRole("button", { name: "Back to lobby" })).toBeInTheDocument();
            expect(bar()).toHaveTextContent(topBarMessage(data.view).text);
        });


        it("keeps the top bar's live region mounted across the phases", () => {
            const { again } = show(playingScreen(viewOf(midRace, "Ann")));
            const live = bar();
            again(screenOf(raceOver, "Ann", { timer: next }));
            expect(bar()).toBe(live);
            expect(live).toHaveTextContent("Race over!");
            again(screenOf(gameOver, "Ann"));
            expect(bar()).toBe(live);
            expect(live).toHaveTextContent("Game over!");
        });


        it("drops a card's reason from the top bar when the race or the game ends", () => {
            const ends = [screenOf(raceOver, "Ann", { timer: next }), screenOf(gameOver, "Ann")];
            for (const end of ends) {
                const { again, unmount } = show(playingScreen(viewOf(midRace, "Ann")));
                fireEvent.click(card("Roll"));
                expect(bar()).toHaveTextContent(
                    describeRejection({ reason: "RollNotNeeded", because: "AlreadyRolling" })
                );
                again(end);
                expect(bar()).toHaveTextContent(topBarMessage(end.view).text);
                unmount();
            }
        });


        it("reveals no seat's kind before the game is over", () => {
            const bobId = idOf(viewOf(midRace, "Ann"), "Bob");
            const screens = [
                playingScreen(viewOf(midRace, "Ann")),
                playingScreen(viewOf(midRace, "Ann"), { isOrganizer: true, robots: [bobId] }),
                screenOf(raceOver, "Ann", { timer: next }),
                screenOf(raceOver, "Ann", { timer: next, isOrganizer: true }),
                screenOf(raceOver, robot, { timer: next }),
            ];
            for (const data of screens) {
                const { container, unmount } = show(data);
                if (data.view.phase.kind === "RaceOver") {
                    expect(container).not.toHaveTextContent(/was\.\.\.|human|robot/iu);
                }
                expect(screen.queryByRole("list", { name: "Who was who" })).toBeNull();
                expect(JSON.stringify(data.view.phase)).not.toContain("reveal");
                unmount();
            }
        });


        it("keeps the table for a race still on", () => {
            show(playingScreen(viewOf(midRace, "Ann")));
            expect(screen.getByRole("region", { name: "Your hand" })).toBeInTheDocument();
            expect(screen.queryByRole("region", { name: "Score sheet" })).not.toBeInTheDocument();
        });


        it("gives the organizer an End game control in the header while playing", () => {
            inShell(playingScreen(viewOf(midRace, "Ann"), { isOrganizer: true }));
            expect(endGameControl()).toBeInTheDocument();
        });


        it("gives the organizer the control between races too", () => {
            inShell(screenOf(raceOver, "Ann", { timer: next, isOrganizer: true }));
            expect(endGameControl()).toBeInTheDocument();
        });


        it("gives the organizer no control once the game is over", () => {
            const { again } = inShell(screenOf(raceOver, "Ann", { isOrganizer: true }));
            expect(endGameControl()).toBeInTheDocument();
            again(screenOf(gameOver, "Ann", { isOrganizer: true }));
            expect(screen.queryByRole("button", { name: "End game" })).not.toBeInTheDocument();
        });


        it("gives everyone else no control", () => {
            for (const data of [
                playingScreen(viewOf(midRace, "Bob")),
                screenOf(raceOver, "Ann", { timer: next }),
                screenOf(gameOver, "Ann"),
            ]) {
                const { unmount } = inShell(data);
                expect(screen.queryByRole("button", { name: "End game" })).not.toBeInTheDocument();
                unmount();
            }
        });


        it("ends the game on confirmation and shows a refusal in the page", async () => {
            const fake = createFakeApi();
            fake.procs.endGame.mockResolvedValueOnce(failWire("The game already ended."));
            inShell(screenOf(raceOver, "Ann", { timer: next, isOrganizer: true }), fake);
            const user = userEvent.setup();
            await user.click(endGameControl()!);
            const dialog = document.querySelector("dialog")!;
            await user.click(within(dialog).getByRole("button", { name: "End game" }));
            expect(fake.procs.endGame).toHaveBeenCalledOnce();
            expect(await screen.findByRole("alert")).toHaveTextContent("The game already ended.");
            expect(within(screen.getByRole("main")).getByRole("alert")).toBeInTheDocument();
        });

    });

});
