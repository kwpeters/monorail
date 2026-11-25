import { NoneOption, SomeOption, type Option } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { team } from "../testing/viewFixtures.mjs";
import { prefersReducedMotion, useFlyingCards, type PlayStep } from "./FlyingCard.js";
import type { Anchor, Step } from "./steps.mjs";


const hand: Anchor = { kind: "Hand" };
const lane0: Anchor = { kind: "Team", team: team(0) };
const lane1: Anchor = { kind: "Team", team: team(1) };
const fifty: Option<Card> = new SomeOption<Card>("50");


// The table's anchors and the layer; the hook's `play` is handed out.
function show(): { play: PlayStep; layer: () => HTMLElement } {
    let play: PlayStep | undefined;
    function Table(): ReactElement {
        const flying = useFlyingCards();
        play = flying.play;
        return (
            <>
                <div data-anim-anchor="hand" />
                <div data-anim-anchor="team-0" />
                <div data-anim-anchor="team-1" />
                {flying.layer}
            </>
        );
    }
    render(<Table />);
    return { play: play!, layer: () => document.querySelector<HTMLElement>(".flying-layer")! };
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


const flight = (card: Option<Card>, to: Anchor = lane0): Step => (
    { kind: "Fly", card, from: hand, to, ms: 350 }
);


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
            const pinned: Step = { kind: "Hold", card: "Stop", at: lane1, ms: 6000 };
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
