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
    annPlays, beforeExtensionOffer, beforeFlatTire, bobDrivesToAnn, extensionOffer,
    flatTireAttack, flatTireWindow, midRace, play, seenBy, viewOf
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
import { GameScreen, hidesShellBar, type PlayingData } from "./GameScreen.js";
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
    return [...document.querySelectorAll<HTMLElement>("section[data-anim-anchor^='team-']")];
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

        // Engine batches end with the next turn and its draw: two flights, the
        // second leaving when the first is 70% through.  jsdom has no Web
        // Animations, so a stand-in makes each flight take its 450 ms: the
        // batch lasts 315 + 450 ms.
        const batchMs = 765;
        // The keyframes of every flight so far.
        let flights: Keyframe[][] = [];
        const drove = annPlays({ type: "Drive", card: "50" });
        const discarded = annPlays({ type: "Discard", card: "25" });
        const first: EventBatch = { id: 1, events: drove.events };
        const second: EventBatch = { id: 2, events: discarded.events };


        function line(): HTMLElement {
            return screen.getByRole("status");
        }


        beforeEach(() => {
            vi.useFakeTimers();
            flights = [];
            const animation = (frames: Keyframe[]): object => ({
                finished: new Promise<void>((resolve) => {
                    flights.push(frames);
                    window.setTimeout(resolve, 450);
                }),
                cancel:   () => undefined
            });
            Object.defineProperty(Element.prototype, "animate", {
                value: animation, configurable: true
            });
            Object.defineProperty(Element.prototype, "getAnimations", {
                value: () => [{}], configurable: true
            });
        });


        afterEach(() => {
            Reflect.deleteProperty(Element.prototype, "animate");
            Reflect.deleteProperty(Element.prototype, "getAnimations");
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
            await act(() => vi.advanceTimersByTimeAsync(batchMs));
            expect(consume).toHaveBeenCalledExactlyOnceWith(1);
        });


        it("keeps the line while the next batch waits behind a running one", async () => {
            const { again, consume } = show(playingScreen(viewForSeats(2)));
            again(playingScreen(drove.view, { events: drove.events }), [first]);
            await act(() => vi.advanceTimersByTimeAsync(0));
            again(playingScreen(discarded.view, { events: discarded.events }), [first, second]);
            await act(() => vi.advanceTimersByTimeAsync(batchMs - 100));
            expect(line()).toHaveTextContent("You drove 50 miles.");
            await act(() => vi.advanceTimersByTimeAsync(100));
            expect(line()).toHaveTextContent("You discarded 25 miles.");
            await act(() => vi.advanceTimersByTimeAsync(batchMs));
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
            await act(() => vi.advanceTimersByTimeAsync(batchMs));
            expect(consume).toHaveBeenCalledExactlyOnceWith(1);
            expect(pressedCards()).toHaveLength(1);
        });


        it("starts the flight of the player's own play at the card that was tapped", async () => {
            const { again } = show(playingScreen(viewOf(midRace, "Ann")));
            const tapped = new DOMRect(40, 600, 56, 76);
            vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
                this: Element
            ) {
                return this.matches(".hand .card-button .card") ? tapped : new DOMRect();
            });
            fireEvent.click(card("50 miles"));
            fireEvent.click(screen.getByRole("button", { name: "Play" }));
            // The server's answer: the play, the next turn and its draw.
            again(playingScreen(drove.view, { events: drove.events }), [first]);
            await act(() => vi.advanceTimersByTimeAsync(0));
            expect(String(flights[0]![0]!.transform)).toContain("translate(68px, 638px)");
            vi.restoreAllMocks();
        });


        describe("the table, in step with them", () => {

            // Bob drives 75 into Ann's turn: his card lands on his lane at
            // 450 ms; Ann's draw leaves at 315 ms and lands at 765 ms.
            const bob = bobDrivesToAnn;
            const bobs: EventBatch = { id: 3, events: bob.events };
            const whenBobDrives = (): ReturnType<typeof show> => {
                const shown = show(playingScreen(bob.before));
                shown.again(playingScreen(bob.view, { events: bob.events }), [bobs]);
                return shown;
            };


            function milesOn(n: number): string {
                return lane(n).querySelector(".miles-number")!.textContent;
            }


            function drawPile(): string {
                return screen.getByRole("img", { name: /^Draw pile/u }).getAttribute("aria-label")!;
            }


            function flyingIn(): Element | null {
                return document.querySelector("[data-anim-anchor='hand-card']");
            }


            function chip(name: string): HTMLElement | null {
                return screen.getByText(name).closest("li");
            }


            it("shows each card's result when it lands, and the dot with the last", async () => {
                whenBobDrives();
                const before = { miles: milesOn(1), pile: drawPile() };
                expect(before.miles).toBe("0");
                // The bar says it as soon as the viewer can play.
                expect(bar()).toHaveTextContent("Your turn: play or discard a card");
                expect(flyingIn()?.querySelector("[data-card]")).toHaveAttribute(
                    "data-card", "Spare Tire"
                );
                expect(flyingIn()).not.toBeVisible();
                await act(() => vi.advanceTimersByTimeAsync(449));
                expect(milesOn(1)).toBe("0");
                await act(() => vi.advanceTimersByTimeAsync(1));
                // Bob's card has landed; the pile, the turn and Ann's card wait.
                expect(milesOn(1)).toBe("75");
                expect(drawPile()).toBe(before.pile);
                expect(bar()).toHaveTextContent("Your turn: play or discard a card");
                expect(chip("Bob")).toHaveAttribute("aria-current", "true");
                expect(flyingIn()).not.toBeVisible();
                await act(() => vi.advanceTimersByTimeAsync(315));
                expect(drawPile()).toBe(`Draw pile, ${bob.view.drawPileCount} cards`);
                expect(bar()).toHaveTextContent("Your turn: play or discard a card");
                expect(chip("Ann")).toHaveAttribute("aria-current", "true");
                expect(flyingIn()).toBeNull();
                expect(card("Spare Tire")).toBeVisible();
            });


            it("lets the viewer play at once, before the table shows the turn", async () => {
                const { fake } = whenBobDrives();
                expect(chip("Bob")).toHaveAttribute("aria-current", "true");
                expect(bar()).toHaveTextContent("Your turn: play or discard a card");
                expect(card("25 miles")).not.toHaveAttribute("aria-disabled");
                fireEvent.click(card("25 miles"));
                fireEvent.click(screen.getByRole("button", { name: "Play" }));
                await act(() => vi.advanceTimersByTimeAsync(0));
                expect(fake.procs.play)
                .toHaveBeenCalledExactlyOnceWith({ type: "Drive", card: "25" });
            });


            it("lands the viewer's draw on its place in the hand, fully visible", async () => {
                vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
                    this: Element
                ) {
                    return this.matches("[data-anim-anchor='hand-card']") ?
                        new DOMRect(300, 700, 56, 76) :
                        new DOMRect();
                });
                whenBobDrives();
                await act(() => vi.advanceTimersByTimeAsync(400));
                const landing = flights[1]!.at(-1)!;
                expect(String(landing.transform)).toContain("translate(328px, 738px)");
                expect(landing.opacity).toBe(1);
                vi.restoreAllMocks();
            });


            it("stops saying Your turn as soon as the viewer has played", async () => {
                const { again } = show(playingScreen(viewOf(midRace, "Ann")));
                again(playingScreen(drove.view, { events: drove.events }), [first]);
                expect(bar()).toHaveTextContent("Waiting for Bob to play");
                expect(milesOn(0)).toBe("0");
                await act(() => vi.advanceTimersByTimeAsync(450));
                expect(milesOn(0)).toBe("50");
            });


            it("follows the table while other players move", async () => {
                const drive = seenBy(beforeFlatTire, "Ann", { type: "Drive", card: "50" }, "Cy");
                const { again } = show(playingScreen(drive.before));
                const batch: EventBatch = { id: 5, events: drive.events };
                again(playingScreen(drive.view, { events: drive.events }), [batch]);
                expect(bar()).toHaveTextContent("Waiting for Ann to play");
                await act(() => vi.advanceTimersByTimeAsync(batchMs));
                expect(bar()).toHaveTextContent("Waiting for Bob to play");
            });


            it("puts the viewer's Extension offer in the bar at once, not Your turn", () => {
                const hundred = { type: "Drive", card: "100" } as const;
                const reached = seenBy(beforeExtensionOffer, "Ann", hundred, "Ann");
                const { again } = show(playingScreen(reached.before));
                again(playingScreen(reached.view, {
                    events: reached.events,
                    timer:  { kind: "ExtensionOffer", remainingMs: 30000 }
                }), [{ id: 6, events: reached.events }]);
                expect(screen.getByRole("button", { name: "Stop here" })).toBeInTheDocument();
                expect(bar()).toHaveTextContent("You reached 700 miles!");
                expect(bar()).not.toHaveTextContent("Your turn");
            });


            it("lets the hit team answer at once while the table shows the attack", async () => {
                const attack = seenBy(beforeFlatTire, "Ann", flatTireAttack, "Di");
                const { again, fake } = show(playingScreen(attack.before));
                again(playingScreen(attack.view, {
                    events: attack.events,
                    timer:  { kind: "HazardWindow", remainingMs: 5000 }
                }), [{ id: 4, events: attack.events }]);
                // The attack is still in flight: Ann's turn is on the table.
                expect(chip("Ann")).toHaveAttribute("aria-current", "true");
                expect(screen.getByRole("region", { name: "Flat Tire!" })).toBeInTheDocument();
                expect(bar()).toHaveClass("tone-red");
                fireEvent.click(card("Puncture Proof Blocks it!"));
                fireEvent.click(screen.getByRole("button", { name: "Play" }));
                expect(fake.procs.play)
                .toHaveBeenCalledExactlyOnceWith({ type: "CoupFourre", card: "Puncture Proof" });
                await act(() => vi.advanceTimersByTimeAsync(450));
                expect(chip("Ann")).not.toHaveAttribute("aria-current");
            });


            it("hides no card during a hazard window", () => {
                const { again } = show(playingScreen(bob.before));
                const hazard = withPhase(bob.view, {
                    kind:     "HazardIncoming",
                    attacker: idOf(bob.view, "Bob"),
                    hazard:   "Stop",
                    target:   team(0)
                });
                again(playingScreen(hazard, { events: bob.events }), [bobs]);
                expect(flyingIn()).toBeNull();
                expect(card("Spare Tire")).toBeVisible();
            });


            it("shows the live table at once under reduced motion", () => {
                vi.stubGlobal("matchMedia", (query: string) => ({
                    matches: query.includes("reduce")
                }));
                try {
                    whenBobDrives();
                    expect(milesOn(1)).toBe("75");
                    expect(bar()).toHaveTextContent("Your turn: play or discard a card");
                    expect(flyingIn()).toBeNull();
                }
                finally {
                    vi.unstubAllGlobals();
                }
            });


            it("shows the live table at once after a reconnect snapshot", async () => {
                const { again } = whenBobDrives();
                await act(() => vi.advanceTimersByTimeAsync(100));
                again(playingScreen(bob.view), []);
                expect(milesOn(1)).toBe("75");
                expect(bar()).toHaveTextContent("Your turn: play or discard a card");
                expect(flyingIn()).toBeNull();
            });

        });


        it("flies in a layer that takes no taps and is hidden and empty after", async () => {
            const { again } = show(playingScreen(drove.view));
            again(playingScreen(drove.view), [first]);
            await act(() => vi.advanceTimersByTimeAsync(batchMs + 100));
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


        it("scrolls the targets of a picked-up card out from under the hand", () => {
            // jsdom has no layout: the hand covers the bottom of a 568 px
            // screen, and the Discard button sits under it.
            const box = (top: number, bottom: number): DOMRect => ({
                top,
                bottom,
                left:   0,
                right:  0,
                x:      0,
                y:      top,
                width:  0,
                height: bottom - top,
                toJSON: () => ({})
            });
            const rect = vi.spyOn(Element.prototype, "getBoundingClientRect")
            .mockImplementation(function rectOf(this: Element) {
                return this.classList.contains("hand") ? box(330, 552) :
                    this.classList.contains("pile-target") ? box(480, 524) : box(0, 0);
            });
            const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);
            try {
                show(ann());
                fireEvent.click(card("Roll"));
                expect(scrollBy).toHaveBeenCalledExactlyOnceWith({
                    top: 524 + 8 - 330, behavior: "instant"
                });
            }
            finally {
                rect.mockRestore();
                scrollBy.mockRestore();
            }
        });


        it("does not scroll when the targets are clear of the hand", () => {
            const scrollBy = vi.spyOn(window, "scrollBy").mockImplementation(() => undefined);
            try {
                show(ann());
                fireEvent.click(card("50 miles"));
                expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
                expect(scrollBy).not.toHaveBeenCalled();
            }
            finally {
                scrollBy.mockRestore();
            }
        });


        it("explains a picked-up card with What's this?, keeping it picked up", async () => {
            const user = userEvent.setup();
            const { fake } = show(ann());
            await user.click(card("50 miles"));
            await user.click(screen.getByRole("button", { name: "What's this?" }));
            expect(screen.getByRole("dialog", { name: "50 miles" })).toBeInTheDocument();
            await user.click(screen.getByRole("button", { name: "Close" }));
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            expect(pressedCards()).toEqual([card("50 miles")]);
            expect(fake.procs.play).not.toHaveBeenCalled();
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


        it("shows the top bar's explanation of a tap in the banner, which covers the bar", () => {
            show(windowFor("Bob"));
            const alert = hazardAlertText(viewOf(flatTireWindow, "Bob"));
            const explanation = describeRejection({ reason: "WindowOpen" });
            expect(banner()).toHaveTextContent(alert);
            fireEvent.click(card("75 miles"));
            expect(bar()).toHaveTextContent(explanation);
            // The banner covers the bar, so it says it too; the hazard, the
            // countdown and what to do come back when the message is over.
            expect(banner().querySelector(".hazard-alert")).toHaveTextContent(explanation);
            expect(banner()).toHaveTextContent("Flat Tire!");
            expect(within(banner()).getByRole("timer")).toBeInTheDocument();
            act(() => {
                vi.advanceTimersByTime(3000);
            });
            expect(banner().querySelector(".hazard-alert")).toHaveTextContent(alert);
            expect(bar()).not.toHaveTextContent(explanation);
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
                <Shell hideBar={hidesShellBar(d)}>
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


        // The control is the End game item of the top bar's menu, which has to
        // be opened first.
        async function endGameControl(user = userEvent.setup()): Promise<HTMLElement | null> {
            const menu = screen.queryByRole("button", { name: "Menu" });
            if (menu === null) {
                return null;
            }
            await user.click(menu);
            return screen.queryByRole("menuitem", { name: "End game" });
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


        it("gives the organizer an End game item in the menu while playing", async () => {
            inShell(playingScreen(viewOf(midRace, "Ann"), { isOrganizer: true }));
            expect(await endGameControl()).toBeInTheDocument();
        });


        it("gives the organizer the item between races too", async () => {
            inShell(screenOf(raceOver, "Ann", { timer: next, isOrganizer: true }));
            expect(await endGameControl()).toBeInTheDocument();
        });


        it("gives the organizer no menu and no item once the game is over", async () => {
            const { again } = inShell(screenOf(raceOver, "Ann", { isOrganizer: true }));
            expect(await endGameControl()).toBeInTheDocument();
            again(screenOf(gameOver, "Ann", { isOrganizer: true }));
            expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument();
            expect(screen.queryByRole("menuitem", { name: "End game" })).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "End game" })).not.toBeInTheDocument();
        });


        it("gives everyone else a menu with Mute and no End game", async () => {
            for (const data of [
                playingScreen(viewOf(midRace, "Bob")),
                screenOf(raceOver, "Ann", { timer: next }),
            ]) {
                const { unmount } = inShell(data);
                expect(await endGameControl()).toBeNull();
                expect(screen.getByRole("menuitem", { name: "Mute sounds" })).toBeInTheDocument();
                expect(screen.getAllByRole("menuitem")).toHaveLength(1);
                unmount();
            }
        });


        it("has no menu on the game summary, where the shell's header has the controls", () => {
            inShell(screenOf(gameOver, "Ann"));
            expect(screen.queryByRole("button", { name: "Menu" })).not.toBeInTheDocument();
            expect(screen.getByRole("banner")).toBeInTheDocument();
        });


        it("has no header while playing or between races, and no second h1", () => {
            for (const data of [
                playingScreen(viewOf(midRace, "Ann")),
                screenOf(raceOver, "Ann", { timer: next }),
            ]) {
                const { unmount } = inShell(data);
                expect(screen.queryByRole("banner")).not.toBeInTheDocument();
                expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
                unmount();
            }
        });


        it("puts the menu button beside the top bar's message, not inside the live region", () => {
            inShell(playingScreen(viewOf(midRace, "Ann")));
            const button = screen.getByRole("button", { name: "Menu" });
            expect(bar()).not.toContainElement(button);
            expect(button.closest(".top-slot")).toBe(bar().closest(".top-slot"));
            expect(button.closest(".top-slot")).toHaveClass("has-menu");
        });


        it("ends the game on confirmation and shows a refusal in the page", async () => {
            const fake = createFakeApi();
            fake.procs.endGame.mockResolvedValueOnce(failWire("The game already ended."));
            inShell(screenOf(raceOver, "Ann", { timer: next, isOrganizer: true }), fake);
            const user = userEvent.setup();
            await user.click((await endGameControl(user))!);
            // Choosing it closes the menu and opens the question.
            expect(screen.queryByRole("menu")).not.toBeInTheDocument();
            const dialog = document.querySelector("dialog")!;
            expect(dialog).toHaveAttribute("open");
            await user.click(within(dialog).getByRole("button", { name: "End game" }));
            expect(fake.procs.endGame).toHaveBeenCalledOnce();
            expect(await screen.findByRole("alert")).toHaveTextContent("The game already ended.");
            expect(within(screen.getByRole("main")).getByRole("alert")).toBeInTheDocument();
            // The focus is back where the question was asked from.
            await waitFor(() => expect(screen.getByRole("button", { name: "Menu" })).toHaveFocus());
        });

    });

});
