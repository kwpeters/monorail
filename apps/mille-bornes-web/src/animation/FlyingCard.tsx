import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { distanceCardSchema, distanceMiles, type Card } from "@repo/mille-bornes-core/card";
import { useCallback, useRef, type ReactElement } from "react";
import { cardFace, visibleLabel } from "../text/cardFace.mjs";
import { flightMs, type Anchor, type PulseTone, type Release, type Step } from "./steps.mjs";
import "./animations.css";


/** Shows one step; the shape `createAnimator()` wants for `play`. */
export type PlayStep = (step: Step, signal: AbortSignal, release?: Release) => Promise<void>;


/** What `useFlyingCards()` gives the table. */
export interface FlyingCards {
    /** The layer the cards fly in; render it once, anywhere in the table. */
    readonly layer:        ReactElement;
    /** Plays a step in the layer; stable across renders. */
    readonly play:         PlayStep;
    /**
     * Remembers where the player's card was when it was tapped, so that the
     * flight of the play that follows leaves from there; stable across
     * renders.  Read `rect` before anything moves.
     */
    readonly launchFrom:   (card: Card, rect: DOMRect) => void;
    /** Forgets that place (the play was refused); stable across renders. */
    readonly forgetLaunch: () => void;
}


interface Point {
    readonly x: number;
    readonly y: number;
}


// A card the player tapped: where it was, and when.
interface Launch {
    readonly card: Card;
    readonly rect: DOMRect;
    readonly at:   number;
}


// Takes (once) the place the player's card was tapped at, if it is this card.
type TakeLaunch = (card: Card) => Option<DOMRect>;


const noLaunch: TakeLaunch = () => NoneOption.get();


// A tap that was never played (a reconnect, say) must not start a later flight.
const launchMaxAgeMs = 5000;


// A flight leaves a little smaller than a card on the table, unless it leaves
// the very card the player tapped.
const startScale = 0.9;


// A flight's ease: a visible start and a soft landing.
const flightEasing = "cubic-bezier(0.4, 0, 0.2, 1)";


// How long the pulse beside a held card lasts.
const holdPulseMs = 450;


function anchorName(anchor: Anchor): string {
    switch (anchor.kind) {
        case "DrawPile":
            return "draw-pile";
        case "DiscardPile":
            return "discard-pile";
        case "Hand":
            return "hand";
        case "Team":
            return `team-${anchor.team}`;
        case "Seat":
            return `seat-${anchor.player}`;
    }
}


function rectOfName(name: string): Option<DOMRect> {
    const quoted = name.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"");
    return Option.fromNullable(document.querySelector(`[data-anim-anchor="${quoted}"]`))
    .mapSome((element) => element.getBoundingClientRect());
}


function rectOf(anchor: Anchor): Option<DOMRect> {
    return rectOfName(anchorName(anchor));
}


// Where a card lands: on a lane, its card slot; anywhere else, the anchor.
function landingRect(anchor: Anchor): Option<DOMRect> {
    return anchor.kind === "Team" ?
        rectOfName(`${anchorName(anchor)}-card`).bindNone(() => rectOf(anchor)) :
        rectOf(anchor);
}


function center(rect: DOMRect): Point {
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}


// Puts the middle of a sprite at a point of the viewport.
function at(point: Point, scale = 1): string {
    return `translate(${point.x}px, ${point.y}px) translate(-50%, -50%) scale(${scale})`;
}


// The same face as CardView, without `data-card`: a card in flight is not a
// card on the table.  None is a face-down card.
function cardElement(card: Option<Card>): HTMLElement {
    const face = document.createElement("span");
    if (card.isNone) {
        face.className = "card face-down";
        return face;
    }
    const { kind, emoji } = cardFace(card.value);
    const distance = Option.fromNullable(
        distanceCardSchema.options.find((c) => c === card.value)
    );
    const big = document.createElement("span");
    const small = document.createElement("span");
    face.className = `card kind-${kind.toLowerCase()}`;
    big.className = distance.isSome ? "card-miles" : "card-emoji";
    big.textContent = distance.isSome ? String(distanceMiles(distance.value)) : emoji;
    small.className = distance.isSome ? "card-unit" : "card-label";
    small.textContent = distance.isSome ? "mi" : visibleLabel(card.value);
    face.append(big, small);
    return face;
}


function sprite(layer: HTMLElement, className: string, ...children: HTMLElement[]): HTMLElement {
    const element = document.createElement("div");
    element.className = className;
    element.append(...children);
    layer.append(element);
    return element;
}


function untilAborted(signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        signal.addEventListener("abort", () => resolve(), { once: true });
    });
}


// How keyframes run.
interface Timing {
    readonly ms:     number;
    readonly easing: string;
    /** Called once `at` of the time has passed, to let the next step start. */
    readonly early:  Option<Release>;
}


// Runs keyframes (transform and opacity only) with the Web Animations API.
// Resolves at once when it is missing or runs nothing, as in jsdom.
async function animate(
    element: HTMLElement,
    keyframes: Keyframe[],
    timing: Timing,
    signal: AbortSignal
): Promise<void> {
    if (typeof element.animate !== "function") {
        return;
    }
    const options: KeyframeAnimationOptions = {
        duration: timing.ms,
        easing:   timing.easing,
        fill:     "both"
    };
    const animation = element.animate(keyframes, options);
    if (typeof element.getAnimations !== "function" || element.getAnimations().length === 0) {
        return;
    }
    const cancel = (): void => animation.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    const timer = timing.early.match(
        (early) => window.setTimeout(early.run, early.at * timing.ms),
        () => undefined
    );
    try {
        await animation.finished;
    }
    catch {
        // Cancelled: the step ended early.
    }
    finally {
        window.clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
    }
}


// A card flies from where it is (for the player's own, where it was tapped)
// to where it lands, fully visible, and is gone as it arrives: the lane or
// the pile it lands on shows the result.  A seat or the hand has no card of
// its own to take it over, so a card flying there fades out at the end.
async function fly(
    layer: HTMLElement,
    step: Extract<Step, { kind: "Fly" }>,
    signal: AbortSignal,
    release: Option<Release>,
    takeLaunch: TakeLaunch
): Promise<void> {
    // Only the player's own cards leave the hand.
    const launched = step.from.kind === "Hand" && step.card.isSome ?
        takeLaunch(step.card.value) :
        NoneOption.get();
    const from = launched.bindNone(() => rectOf(step.from));
    const to = landingRect(step.to);
    if (from.isNone || to.isNone) {
        return;
    }
    const start = center(from.value);
    const end = center(to.value);
    const ms = Math.max(step.ms, flightMs(Math.hypot(end.x - start.x, end.y - start.y)));
    const fades = step.lingers !== true && (step.to.kind === "Seat" || step.to.kind === "Hand");
    const keyframes: Keyframe[] = [
        { transform: at(start, launched.isSome ? 1 : startScale), opacity: 1 },
        ...(fades ? [{ opacity: 1, offset: 0.8 }] : []),
        { transform: at(end), opacity: fades ? 0 : 1 }
    ];
    const card = sprite(layer, "flying-card", cardElement(step.card));
    try {
        await animate(card, keyframes, { ms, easing: flightEasing, early: release }, signal);
    }
    finally {
        card.remove();
    }
}


async function pulse(
    layer: HTMLElement,
    step: Extract<Step, { kind: "Pulse" }>,
    signal: AbortSignal,
    release: Option<Release>
): Promise<void> {
    const target = rectOf(step.target);
    if (target.isNone) {
        return;
    }
    return glowAt(layer, target.value, step.tone, step.big, step.ms, signal, release);
}


async function glowAt(
    layer: HTMLElement,
    rect: DOMRect,
    tone: PulseTone,
    big: boolean,
    ms: number,
    signal: AbortSignal,
    release: Option<Release> = NoneOption.get()
): Promise<void> {
    const glow = sprite(layer, `pulse tone-${tone.toLowerCase()}`);
    const { left, top, width, height } = rect;
    Object.assign(glow.style, {
        left:   `${left}px`,
        top:    `${top}px`,
        width:  `${width}px`,
        height: `${height}px`
    });
    // A big pulse flashes twice in 900 ms: under three flashes a second.
    const keyframes: Keyframe[] = big ?
        [
            { transform: "scale(1)", opacity: 0 },
            { transform: "scale(1.08)", opacity: 1, offset: 0.25 },
            { transform: "scale(1.02)", opacity: 0.2, offset: 0.5 },
            { transform: "scale(1.08)", opacity: 1, offset: 0.75 },
            { transform: "scale(1)", opacity: 0 }
        ] :
        [
            { transform: "scale(1)", opacity: 0 },
            { transform: "scale(1.03)", opacity: 1, offset: 0.4 },
            { transform: "scale(1)", opacity: 0 }
        ];
    try {
        await animate(glow, keyframes, { ms, easing: "ease-out", early: release }, signal);
    }
    finally {
        glow.remove();
    }
}


// The card stays pinned on its lane's card slot until the animator ends the
// step.  It is simply there (the flight before it ended with the card
// visible); a pulse plays beside it.  A scroll or a resize moves the lane
// under the fixed layer, so the card is pinned again.
async function hold(
    layer: HTMLElement,
    step: Extract<Step, { kind: "Hold" }>,
    signal: AbortSignal
): Promise<void> {
    const lane = rectOf(step.at);
    const slot = landingRect(step.at);
    if (lane.isNone || slot.isNone) {
        return;
    }
    const card = sprite(layer, "flying-card", cardElement(new SomeOption(step.card)));
    card.style.transform = at(center(slot.value));
    const pin = (): void => {
        const moved = landingRect(step.at);
        if (moved.isSome) {
            card.style.transform = at(center(moved.value));
        }
    };
    window.addEventListener("scroll", pin, { passive: true });
    window.addEventListener("resize", pin);
    try {
        await Promise.all([
            glowAt(layer, lane.value, step.tone, false, holdPulseMs, signal),
            untilAborted(signal)
        ]);
    }
    finally {
        window.removeEventListener("scroll", pin);
        window.removeEventListener("resize", pin);
        card.remove();
    }
}


function pause(ms: number, signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const timer = window.setTimeout(resolve, ms);
        signal.addEventListener("abort", () => {
            window.clearTimeout(timer);
            resolve();
        }, { once: true });
    });
}


/**
 * Plays one step in a layer.  A missing anchor or layer skips the step;
 * every sprite is removed when its step ends, also when it ends early.
 * @param layer - The flying layer, if it is mounted
 * @param step - The step
 * @param signal - Aborted when the step must end
 * @param release - Lets the next step start early, when the animator wants it
 * @param takeLaunch - Takes the place the player's card was tapped at, for a
 * flight out of the hand; none by default
 * @returns A promise that resolves when the step is over
 */
export async function playIn(
    layer: Option<HTMLElement>,
    step: Step,
    signal: AbortSignal,
    release: Option<Release> = NoneOption.get(),
    takeLaunch: TakeLaunch = noLaunch
): Promise<void> {
    if (layer.isNone || signal.aborted) {
        return;
    }
    switch (step.kind) {
        case "Fly":
            return fly(layer.value, step, signal, release, takeLaunch);
        case "Pulse":
            return pulse(layer.value, step, signal, release);
        case "Hold":
            return hold(layer.value, step, signal);
        case "Pause":
            return pause(step.ms, signal);
    }
}


/**
 * Reads the reader's motion preference now (not once at start).
 * @returns Whether the reader asked for reduced motion; false when the
 * browser cannot tell
 */
export function prefersReducedMotion(): boolean {
    return typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}


/**
 * The flying card layer: a fixed layer over the table that never takes a
 * tap and is hidden from screen readers (the "last move" line says the same
 * in words), plus the `play` that animates cards and pulses in it with the
 * Web Animations API.
 * @returns The layer to render, the stable `play`, and how to tell it where
 * the player's tapped card was
 */
export function useFlyingCards(): FlyingCards {
    const ref = useRef<HTMLDivElement>(null);
    const launch = useRef<Option<Launch>>(NoneOption.get());
    const launchFrom = useCallback((card: Card, rect: DOMRect): void => {
        launch.current = new SomeOption({ card, rect, at: performance.now() });
    }, []);
    const forgetLaunch = useCallback((): void => {
        launch.current = NoneOption.get();
    }, []);
    const takeLaunch = useCallback<TakeLaunch>((card) => {
        const taken = launch.current;
        launch.current = NoneOption.get();
        return taken.bind((l) => l.card === card && performance.now() - l.at < launchMaxAgeMs ?
            new SomeOption(l.rect) :
            NoneOption.get());
    }, []);
    const play = useCallback<PlayStep>(
        (step, signal, release) => playIn(
            Option.fromNullable(ref.current),
            step,
            signal,
            Option.fromNullable(release),
            takeLaunch
        ),
        [takeLaunch]
    );
    const layer = (
        <div
            ref={ref}
            className="flying-layer"
            aria-hidden="true"
            style={{ pointerEvents: "none" }}
        />
    );
    return { layer, play, launchFrom, forgetLaunch };
}
