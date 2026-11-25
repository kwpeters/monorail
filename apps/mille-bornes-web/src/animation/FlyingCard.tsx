import { Option, SomeOption } from "@repo/depot/option";
import { distanceCardSchema, distanceMiles, type Card } from "@repo/mille-bornes-core/card";
import { useCallback, useRef, type ReactElement } from "react";
import { cardFace } from "../text/cardFace.mjs";
import type { Anchor, Step } from "./steps.mjs";
import "./animations.css";


/** Shows one step; the shape `createAnimator()` wants for `play`. */
export type PlayStep = (step: Step, signal: AbortSignal) => Promise<void>;


/** What `useFlyingCards()` gives the table. */
export interface FlyingCards {
    /** The layer the cards fly in; render it once, anywhere in the table. */
    readonly layer: ReactElement;
    /** Plays a step in the layer; stable across renders. */
    readonly play:  PlayStep;
}


interface Point {
    readonly x: number;
    readonly y: number;
}


// How far above its lane another player's card starts when it drops in.
const dropPx = 48;


const holdFadeMs = 150;


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
    }
}


function rectOf(anchor: Anchor): Option<DOMRect> {
    return Option.fromNullable(
        document.querySelector(`[data-anim-anchor="${anchorName(anchor)}"]`)
    ).mapSome((element) => element.getBoundingClientRect());
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
    const { kind, emoji, label } = cardFace(card.value);
    const distance = Option.fromNullable(
        distanceCardSchema.options.find((c) => c === card.value)
    );
    const big = document.createElement("span");
    const small = document.createElement("span");
    face.className = `card kind-${kind.toLowerCase()}`;
    big.className = distance.isSome ? "card-miles" : "card-emoji";
    big.textContent = distance.isSome ? String(distanceMiles(distance.value)) : emoji;
    small.className = distance.isSome ? "card-unit" : "card-label";
    small.textContent = distance.isSome ? "mi" : label;
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


// Runs keyframes (transform and opacity only) with the Web Animations API.
// Resolves at once when it is missing or runs nothing, as in jsdom.
async function animate(
    element: HTMLElement,
    keyframes: Keyframe[],
    ms: number,
    signal: AbortSignal
): Promise<void> {
    if (typeof element.animate !== "function") {
        return;
    }
    const options: KeyframeAnimationOptions = { duration: ms, easing: "ease-out", fill: "both" };
    const animation = element.animate(keyframes, options);
    if (typeof element.getAnimations !== "function" || element.getAnimations().length === 0) {
        return;
    }
    const cancel = (): void => animation.cancel();
    signal.addEventListener("abort", cancel, { once: true });
    try {
        await animation.finished;
    }
    catch {
        // Cancelled: the step ended early.
    }
    finally {
        signal.removeEventListener("abort", cancel);
    }
}


async function fly(
    layer: HTMLElement,
    step: Extract<Step, { kind: "Fly" }>,
    signal: AbortSignal
): Promise<void> {
    const from = rectOf(step.from);
    const to = rectOf(step.to);
    if (from.isNone || to.isNone) {
        return;
    }
    const end = center(to.value);
    // Another player's card leaves from the lane it lands on: it drops in.
    const start = anchorName(step.from) === anchorName(step.to) ?
        { x: end.x, y: to.value.top - dropPx } :
        center(from.value);
    const card = sprite(layer, "flying-card", cardElement(step.card));
    try {
        await animate(card, [
            { transform: at(start, 0.7), opacity: 0 },
            { transform: at(end), opacity: 1, offset: 0.8 },
            { transform: at(end), opacity: 0 }
        ], step.ms, signal);
    }
    finally {
        card.remove();
    }
}


async function pulse(
    layer: HTMLElement,
    step: Extract<Step, { kind: "Pulse" }>,
    signal: AbortSignal
): Promise<void> {
    const target = rectOf(step.target);
    if (target.isNone) {
        return;
    }
    const glow = sprite(layer, `pulse tone-${step.tone.toLowerCase()}`);
    const { left, top, width, height } = target.value;
    Object.assign(glow.style, {
        left:   `${left}px`,
        top:    `${top}px`,
        width:  `${width}px`,
        height: `${height}px`
    });
    // A big pulse flashes twice in 900 ms: under three flashes a second.
    const keyframes: Keyframe[] = step.big ?
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
        await animate(glow, keyframes, step.ms, signal);
    }
    finally {
        glow.remove();
    }
}


// The card stays pinned over the lane until the animator ends the step.
async function hold(
    layer: HTMLElement,
    step: Extract<Step, { kind: "Hold" }>,
    signal: AbortSignal
): Promise<void> {
    const target = rectOf(step.at);
    if (target.isNone) {
        return;
    }
    const place = at(center(target.value));
    const card = sprite(layer, "flying-card", cardElement(new SomeOption(step.card)));
    card.style.transform = place;
    try {
        await Promise.all([
            animate(card, [{ opacity: 0 }, { opacity: 1 }], holdFadeMs, signal),
            untilAborted(signal)
        ]);
    }
    finally {
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
 * @returns A promise that resolves when the step is over
 */
export async function playIn(
    layer: Option<HTMLElement>,
    step: Step,
    signal: AbortSignal
): Promise<void> {
    if (layer.isNone || signal.aborted) {
        return;
    }
    switch (step.kind) {
        case "Fly":
            return fly(layer.value, step, signal);
        case "Pulse":
            return pulse(layer.value, step, signal);
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
 * @returns The layer to render and the stable `play`
 */
export function useFlyingCards(): FlyingCards {
    const ref = useRef<HTMLDivElement>(null);
    const play = useCallback<PlayStep>(
        (step, signal) => playIn(Option.fromNullable(ref.current), step, signal),
        []
    );
    const layer = (
        <div
            ref={ref}
            className="flying-layer"
            aria-hidden="true"
            style={{ pointerEvents: "none" }}
        />
    );
    return { layer, play };
}
