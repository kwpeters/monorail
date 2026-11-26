import { NoneOption, SomeOption, type Option } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import { act, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { annId, bobId } from "../testing/engineBatches.mjs";
import { team } from "../testing/viewFixtures.mjs";
import {
    prefersReducedMotion, useFlyingCards, type FlyingCards, type PlayStep
} from "./FlyingCard.js";
import type { Anchor, Step } from "./steps.mjs";


const hand: Anchor = { kind: "Hand" };
const lane0: Anchor = { kind: "Team", team: team(0) };
const lane1: Anchor = { kind: "Team", team: team(1) };
const discardPile: Anchor = { kind: "DiscardPile" };
const seat: Anchor = { kind: "Seat", player: bobId, team: team(1) };
const fifty: Option<Card> = new SomeOption<Card>("50");


// The table's anchors and the layer; the hook's handles are given out.  Lane 0
// has a card slot, lane 1 has none.
function show(handCard = false): Omit<FlyingCards, "layer"> & { layer: () => HTMLElement } {
    let flying: FlyingCards | undefined;
    function Table(): ReactElement {
        flying = useFlyingCards();
        return (
            <>
                <div data-anim-anchor="hand" />
                <div data-anim-anchor="team-0" />
                <div data-anim-anchor="team-0-card" />
                <div data-anim-anchor="team-1" />
                <div data-anim-anchor="discard-pile" />
                <div data-anim-anchor={`seat-${bobId}`} />
                {handCard ? <div data-anim-anchor="hand-card" /> : null}
                {flying.layer}
            </>
        );
    }
    render(<Table />);
    return { ...flying!, layer: () => document.querySelector<HTMLElement>(".flying-layer")! };
}


type Box = readonly [number, number, number, number];


// Where each anchor is on screen (jsdom has no layout): left, top, width, height.
const boxes = new Map<string, Box>([
    ["hand", [0, 700, 300, 100]],
    ["team-0", [0, 100, 300, 100]],
    ["team-0-card", [0, 120, 60, 60]],
    ["team-1", [0, 250, 300, 100]],
    ["discard-pile", [200, 400, 70, 90]],
    [`seat-${bobId}`, [100, 110, 100, 20]],
    ["hand-card", [200, 720, 56, 76]]
]);


function rect(left: number, top: number, width: number, height: number): DOMRect {
    return new DOMRect(left, top, width, height);
}


// Puts the anchors where `boxes` says, but for `moved`.
function placeAnchors(moved: ReadonlyMap<string, Box> = new Map()): void {
    vi.restoreAllMocks();
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
        this: Element
    ) {
        const name = this.getAttribute("data-anim-anchor") ?? "";
        const [left, top, width, height] = moved.get(name) ?? boxes.get(name) ?? [0, 0, 0, 0];
        return rect(left, top, width, height);
    });
}


// The centre a flight's keyframe puts the sprite at.
function centreOf(frame: Keyframe): readonly [number, number] {
    const found = /^translate\((?<x>[-\d.]+)px, (?<y>[-\d.]+)px\)/u.exec(String(frame.transform));
    return [Number(found!.groups!.x), Number(found!.groups!.y)];
}


interface Stubbed {
    animate: ReturnType<typeof vi.fn>;
    cancel:  ReturnType<typeof vi.fn>;
    finish:  () => void;
}


// jsdom has no Web Animations API; this stands in for it.  `running` says
// whether `getAnimations()` reports the animation (a browser may run none).
function stubAnimations(running: boolean): Stubbed {
    let finish = (): void => undefined;
    let fail = (_e: Error): void => undefined;
    const finished = new Promise<void>((resolve, reject) => {
        finish = resolve;
        fail = reject;
    });
    const cancel = vi.fn(() => fail(new Error("AbortError")));
    const animation = { finished, cancel };
    const animate = vi.fn(() => animation);
    Object.defineProperty(Element.prototype, "animate", { value: animate, configurable: true });
    Object.defineProperty(Element.prototype, "getAnimations", {
        value:        () => running ? [animation] : [],
        configurable: true
    });
    return { animate, cancel, finish };
}


function keyframesOf(animate: ReturnType<typeof vi.fn>): Keyframe[] {
    return animate.mock.calls[0]![0] as Keyframe[];
}


const flight = (
    card: Option<Card>,
    to: Anchor = lane0,
    from: Anchor = hand
): Extract<Step, { kind: "Fly" }> => ({ kind: "Fly", card, from, to, ms: 450 });


describe("useFlyingCards", () => {

    afterEach(() => {
        Reflect.deleteProperty(Element.prototype, "animate");
        Reflect.deleteProperty(Element.prototype, "getAnimations");
        vi.unstubAllGlobals();
    });


    describe("the layer", () => {

        it("is hidden from screen readers and takes no taps", () => {
            const { layer } = show();
            expect(layer()).toHaveAttribute("aria-hidden", "true");
            expect(layer().style.pointerEvents).toBe("none");
        });

    });


    describe("play", () => {

        it("resolves at once without Web Animations and leaves nothing hovering", async () => {
            const { play, layer } = show();
            await play(flight(fifty), new AbortController().signal);
            expect(layer()).toBeEmptyDOMElement();
        });


        it("resolves at once when getAnimations() is empty", async () => {
            const stub = stubAnimations(false);
            const { play, layer } = show();
            await play(flight(fifty), new AbortController().signal);
            expect(stub.animate).toHaveBeenCalledOnce();
            expect(layer()).toBeEmptyDOMElement();
        });


        it("animates only transform and opacity, then removes the card", async () => {
            const stub = stubAnimations(true);
            const { play, layer } = show();
            const done = play(flight(fifty), new AbortController().signal);
            expect(layer()).toHaveTextContent("50");
            expect(layer().querySelector("[data-card]")).toBeNull();
            for (const frame of keyframesOf(stub.animate)) {
                const props = Object.keys(frame).filter((k) => k !== "offset");
                expect(props.every((k) => k === "transform" || k === "opacity")).toBe(true);
            }
            stub.finish();
            await done;
            expect(layer()).toBeEmptyDOMElement();
        });


        it("flies a hidden card face down", () => {
            stubAnimations(true);
            const { play, layer } = show();
            void play(flight(NoneOption.get()), new AbortController().signal);
            expect(layer().querySelector(".card.face-down")).not.toBeNull();
            expect(layer().textContent).toBe("");
        });


        it("skips a step whose anchor is missing", async () => {
            const stub = stubAnimations(true);
            const { play, layer } = show();
            const missing: Anchor = { kind: "Team", team: team(2) };
            await play(flight(fifty, missing), new AbortController().signal);
            const glow: Step = { kind: "Pulse", target: missing, tone: "Bad", big: false, ms: 450 };
            await play(glow, new AbortController().signal);
            expect(stub.animate).not.toHaveBeenCalled();
            expect(layer()).toBeEmptyDOMElement();
        });


        it("cancels a flight that is aborted and removes the card", async () => {
            const stub = stubAnimations(true);
            const { play, layer } = show();
            const controller = new AbortController();
            const done = play(flight(fifty), controller.signal);
            controller.abort();
            await done;
            expect(stub.cancel).toHaveBeenCalledOnce();
            expect(layer()).toBeEmptyDOMElement();
        });


        it("pins a held card over its lane until the step is aborted", async () => {
            const { play, layer } = show();
            const controller = new AbortController();
            let over = false;
            const pinned: Step = { kind: "Hold", card: "Stop", at: lane1, tone: "Bad", ms: 6000 };
            const done = play(pinned, controller.signal).then(() => {
                over = true;
            });
            await Promise.resolve();
            expect(layer()).toHaveTextContent("Stop");
            expect(over).toBe(false);
            controller.abort();
            await done;
            expect(layer()).toBeEmptyDOMElement();
        });


        it("pulses beside a held card, in its tone, and never fades the card", async () => {
            const stub = stubAnimations(true);
            const { play, layer } = show();
            const controller = new AbortController();
            const pinned: Step = { kind: "Hold", card: "Stop", at: lane1, tone: "Bad", ms: 6000 };
            const done = play(pinned, controller.signal);
            await Promise.resolve();
            expect(layer().querySelectorAll(".pulse.tone-bad")).toHaveLength(1);
            expect(layer().querySelectorAll(".flying-card")).toHaveLength(1);
            // Only the glow animates: the card is simply there, fully visible.
            expect(stub.animate).toHaveBeenCalledOnce();
            expect(layer().querySelector(".flying-card")).not.toHaveStyle({ opacity: "0" });
            controller.abort();
            await done;
            expect(layer()).toBeEmptyDOMElement();
        });


        it("ends a flight fully visible on a lane or a pile, and faded out at a seat", async () => {
            const stub = stubAnimations(false);
            const { play } = show();
            const signal = new AbortController().signal;
            await play({ ...flight(fifty), lingers: true }, signal);
            await play(flight(fifty), signal);
            await play(flight(fifty, discardPile), signal);
            await play(flight(NoneOption.get(), seat), signal);
            await play(flight(NoneOption.get(), hand), signal);
            const lastOpacity = stub.animate.mock.calls
            .map(([frames]) => (frames as Keyframe[]).at(-1)!.opacity);
            expect(lastOpacity).toEqual([1, 1, 1, 0, 0]);
        });


        it("pulses once, or twice for a big pulse, under three flashes a second", async () => {
            const stub = stubAnimations(false);
            const { play } = show();
            const signal = new AbortController().signal;
            await play({ kind: "Pulse", target: lane0, tone: "Good", big: false, ms: 450 }, signal);
            await play({ kind: "Pulse", target: lane0, tone: "Gold", big: true, ms: 900 }, signal);
            const peaks = stub.animate.mock.calls.map(([frames, options]) => ({
                flashes: (frames as Keyframe[]).filter((f) => f.opacity === 1).length,
                ms:      (options as KeyframeAnimationOptions).duration as number
            }));
            expect(peaks).toEqual([{ flashes: 1, ms: 450 }, { flashes: 2, ms: 900 }]);
            for (const { flashes, ms } of peaks) {
                expect(flashes / (ms / 1000)).toBeLessThanOrEqual(3);
            }
        });


        it("waits out a pause, or less when aborted", async () => {
            vi.useFakeTimers();
            try {
                const { play } = show();
                const controller = new AbortController();
                let over = false;
                void play({ kind: "Pause", ms: 150 }, controller.signal).then(() => {
                    over = true;
                });
                await vi.advanceTimersByTimeAsync(100);
                expect(over).toBe(false);
                controller.abort();
                await vi.advanceTimersByTimeAsync(0);
                expect(over).toBe(true);
                expect(vi.getTimerCount()).toBe(0);
            }
            finally {
                vi.useRealTimers();
            }
        });

    });


    describe("a flight", () => {

        beforeEach(() => {
            placeAnchors();
        });


        afterEach(() => {
            vi.restoreAllMocks();
        });


        function firstCall(stub: Stubbed): { frames: Keyframe[]; options: KeyframeAnimationOptions } {
            const [frames, options] = stub.animate.mock.calls[0]! as
                [Keyframe[], KeyframeAnimationOptions];
            return { frames, options };
        }


        function startsOf(stub: Stubbed): ReadonlyArray<readonly [number, number]> {
            return stub.animate.mock.calls.map(([frames]) => centreOf((frames as Keyframe[])[0]!));
        }


        function endsOf(stub: Stubbed): ReadonlyArray<readonly [number, number]> {
            return stub.animate.mock.calls
            .map(([frames]) => centreOf((frames as Keyframe[]).at(-1)!));
        }


        it("shows the short face label, as the card on the table does", async () => {
            stubAnimations(false);
            const { play, layer } = show();
            const endOfLimit: Option<Card> = new SomeOption<Card>("End of Speed Limit");
            const done = play(flight(endOfLimit), new AbortController().signal);
            expect(layer()).toHaveTextContent("End of Limit");
            expect(layer()).not.toHaveTextContent("End of Speed Limit");
            await done;
        });


        it("starts fully visible, with an ease of position", async () => {
            const stub = stubAnimations(false);
            const { play } = show();
            await play(flight(fifty), new AbortController().signal);
            const { frames, options } = firstCall(stub);
            expect(frames[0]!.opacity).toBe(1);
            expect(options.easing).toBe("cubic-bezier(0.4, 0, 0.2, 1)");
        });


        it("takes longer over a longer way", async () => {
            const stub = stubAnimations(false);
            const { play } = show();
            const signal = new AbortController().signal;
            // The hand to lane 0's card slot is 612 px; the seat to it is 124 px.
            await play(flight(fifty), signal);
            await play(flight(fifty, lane0, seat), signal);
            const durations = stub.animate.mock.calls
            .map(([, options]) => (options as KeyframeAnimationOptions).duration);
            expect(durations[0]).toBe(750);
            expect(durations[1]).toBeCloseTo(466.6, 0);
        });


        it("lands on a lane's card slot, or on the lane when it has none", async () => {
            const stub = stubAnimations(false);
            const { play } = show();
            const signal = new AbortController().signal;
            await play(flight(fifty, lane0), signal);
            await play(flight(fifty, lane1), signal);
            expect(endsOf(stub)).toEqual([[30, 150], [150, 300]]);
        });


        it("leaves another player's seat and lands on the pile it is played on", async () => {
            const stub = stubAnimations(false);
            const { play } = show();
            await play(flight(fifty, discardPile, seat), new AbortController().signal);
            const { frames } = firstCall(stub);
            expect(startsOf(stub)).toEqual([[150, 120]]);
            expect(endsOf(stub)).toEqual([[235, 445]]);
            expect(frames.at(-1)!.opacity).toBe(1);
        });


        it("leaves from its team's lane when the player's chip is not on the table", async () => {
            const stub = stubAnimations(false);
            const { play } = show();
            const absent: Anchor = { kind: "Seat", player: annId, team: team(1) };
            await play(flight(fifty, discardPile, absent), new AbortController().signal);
            expect(startsOf(stub)).toEqual([[150, 300]]);
        });


        it("lands a drawn card on its place in the hand, fully visible", async () => {
            const stub = stubAnimations(false);
            const { play } = show(true);
            await play(flight(fifty, hand, discardPile), new AbortController().signal);
            const { frames } = firstCall(stub);
            expect(endsOf(stub)).toEqual([[228, 758]]);
            expect(frames.at(-1)!.opacity).toBe(1);
        });


        it("leaves the hand from the hand, not from a place a card flies into", async () => {
            const stub = stubAnimations(false);
            const { play } = show(true);
            await play(flight(fifty), new AbortController().signal);
            expect(startsOf(stub)).toEqual([[150, 750]]);
        });


        it("takes half as long when rushed", async () => {
            const stub = stubAnimations(false);
            const { play } = show();
            const signal = new AbortController().signal;
            await play({ ...flight(fifty), ms: 225, rushed: true }, signal);
            await play({ ...flight(fifty, lane0, seat), ms: 225, rushed: true }, signal);
            const durations = stub.animate.mock.calls
            .map(([, options]) => (options as KeyframeAnimationOptions).duration);
            expect(durations[0]).toBe(375);
            expect(durations[1]).toBeCloseTo(233.3, 0);
        });


        it("fades out, in its last fifth, at a seat", async () => {
            const stub = stubAnimations(false);
            const { play } = show();
            await play(flight(NoneOption.get(), seat, discardPile), new AbortController().signal);
            const { frames } = firstCall(stub);
            expect(frames.map((f) => [f.offset, f.opacity]))
            .toEqual([[undefined, 1], [0.8, 1], [undefined, 0]]);
        });


        describe("out of the player's own hand", () => {

            it("leaves from the card that was tapped, at its own size", async () => {
                const stub = stubAnimations(false);
                const { play, launchFrom } = show();
                launchFrom("50", rect(40, 600, 56, 76));
                await play(flight(fifty), new AbortController().signal);
                expect(startsOf(stub)).toEqual([[68, 638]]);
                expect(String(firstCall(stub).frames[0]!.transform)).toContain("scale(1)");
            });


            it("falls back to the hand when no card was tapped", async () => {
                const stub = stubAnimations(false);
                const { play } = show();
                await play(flight(fifty), new AbortController().signal);
                expect(startsOf(stub)).toEqual([[150, 750]]);
                expect(String(firstCall(stub).frames[0]!.transform)).toContain("scale(0.9)");
            });


            it("uses the tapped place once, and not for another card", async () => {
                const stub = stubAnimations(false);
                const { play, launchFrom } = show();
                const signal = new AbortController().signal;
                launchFrom("25", rect(40, 600, 56, 76));
                await play(flight(fifty), signal);
                launchFrom("50", rect(40, 600, 56, 76));
                await play(flight(fifty), signal);
                await play(flight(fifty), signal);
                expect(startsOf(stub)).toEqual([[150, 750], [68, 638], [150, 750]]);
            });


            it("forgets the tapped place when the play was refused", async () => {
                const stub = stubAnimations(false);
                const { play, launchFrom, forgetLaunch } = show();
                launchFrom("50", rect(40, 600, 56, 76));
                forgetLaunch();
                await play(flight(fifty), new AbortController().signal);
                expect(startsOf(stub)).toEqual([[150, 750]]);
            });


            it("is not used by a card that does not leave the hand", async () => {
                const stub = stubAnimations(false);
                const { play, launchFrom } = show();
                launchFrom("50", rect(40, 600, 56, 76));
                await play(flight(fifty, lane0, seat), new AbortController().signal);
                expect(startsOf(stub)).toEqual([[150, 120]]);
            });


            it("is not used once it is stale", async () => {
                const stub = stubAnimations(false);
                const now = vi.spyOn(performance, "now");
                now.mockReturnValue(1000);
                const { play, launchFrom } = show();
                launchFrom("50", rect(40, 600, 56, 76));
                now.mockReturnValue(1000 + 5001);
                await play(flight(fifty), new AbortController().signal);
                expect(startsOf(stub)).toEqual([[150, 750]]);
            });

        });


        describe("the release of the next step", () => {

            it("comes when the part the animator asked for has passed", async () => {
                vi.useFakeTimers();
                try {
                    const stub = stubAnimations(true);
                    const { play } = show();
                    const run = vi.fn();
                    void play(flight(fifty), new AbortController().signal, { at: 0.7, run });
                    // The hand to lane 0's card slot lasts 750 ms.
                    await vi.advanceTimersByTimeAsync(524);
                    expect(run).not.toHaveBeenCalled();
                    await vi.advanceTimersByTimeAsync(2);
                    expect(run).toHaveBeenCalledOnce();
                    stub.finish();
                }
                finally {
                    vi.useRealTimers();
                }
            });


            it("does not come after an abort, and leaves no timer", async () => {
                vi.useFakeTimers();
                try {
                    stubAnimations(true);
                    const { play } = show();
                    const run = vi.fn();
                    const controller = new AbortController();
                    const done = play(flight(fifty), controller.signal, { at: 0.7, run });
                    controller.abort();
                    await done;
                    await vi.advanceTimersByTimeAsync(2000);
                    expect(run).not.toHaveBeenCalled();
                    expect(vi.getTimerCount()).toBe(0);
                }
                finally {
                    vi.useRealTimers();
                }
            });

        });

    });


    describe("a hold", () => {

        beforeEach(() => {
            placeAnchors();
        });


        afterEach(() => {
            vi.restoreAllMocks();
        });


        it("pins the card on the lane's card slot, and again after a scroll", async () => {
            const { play, layer } = show();
            const controller = new AbortController();
            const done = play(
                { kind: "Hold", card: "Stop", at: lane0, tone: "Bad", ms: 6000 },
                controller.signal
            );
            await Promise.resolve();
            const card = layer().querySelector<HTMLElement>(".flying-card")!;
            expect(card.style.transform).toContain("translate(30px, 150px)");
            // The page scrolled: the lane's card slot is 40 px higher now.
            placeAnchors(new Map([["team-0-card", [0, 80, 60, 60]]]));
            act(() => {
                window.dispatchEvent(new Event("scroll"));
            });
            expect(card.style.transform).toContain("translate(30px, 110px)");
            controller.abort();
            await done;
            expect(layer()).toBeEmptyDOMElement();
        });

    });

});


describe("prefersReducedMotion", () => {

    afterEach(() => {
        vi.unstubAllGlobals();
    });


    it("is false when the browser cannot tell", () => {
        vi.stubGlobal("matchMedia", undefined);
        expect(prefersReducedMotion()).toBe(false);
    });


    it("reads the media query each time it is called", () => {
        let reduce = false;
        vi.stubGlobal("matchMedia", (query: string) => ({
            matches: query === "(prefers-reduced-motion: reduce)" && reduce
        }));
        expect(prefersReducedMotion()).toBe(false);
        reduce = true;
        expect(prefersReducedMotion()).toBe(true);
    });

});
