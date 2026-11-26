import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { PlayerId, TeamIndex } from "@repo/mille-bornes-core/ids";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { z } from "zod";


/**
 * A place on the table an animation starts or ends at; each one is the
 * element with the matching `data-anim-anchor` attribute.  A `Team` is the
 * whole lane (a pulse glows around it), and a card that flies to a lane lands
 * on its card slot, as a card the viewer draws lands on its place in the hand
 * (hidden there until then); a `Seat` is a player's name chip in their lane
 * (of `team`, the lane to use when the chip is not on the table), where
 * another player's cards come from and go.
 */
export type Anchor =
    | { readonly kind: "DrawPile" }
    | { readonly kind: "DiscardPile" }
    | { readonly kind: "Hand" }
    | { readonly kind: "Team"; readonly team: TeamIndex }
    | { readonly kind: "Seat"; readonly player: PlayerId; readonly team: TeamIndex };


/** The color of a pulse: a fix, a hit, a safety, or news. */
export const pulseToneSchema = z.enum(["Good", "Bad", "Gold", "Info"]);


/** One of the colors a pulse can have (see `pulseToneSchema`). */
export type PulseTone = z.infer<typeof pulseToneSchema>;


/**
 * One thing to show.  A `Fly` moves a card (face down when it is none); it
 * lasts `ms` at the least, longer over a longer way (see `flightMs()`; a
 * `rushed` flight half as long, see `rushSteps()`), and ends fully visible on
 * a lane, the discard pile or the drawn card's place in the hand, which show
 * the result, but fades out at a seat or a hand with no such place, which
 * have no card of its own to take over, unless it `lingers`, because a
 * `Hold` takes it over; a `Pulse` glows a lane once (twice when `big`); a
 * `Hold` keeps a card pinned at a lane, with a pulse of its `tone` beside it,
 * until the animator ends it (the next batch arrives, a snapshot shows the
 * window is over, or `ms` passes).  The animator starts a step as soon as
 * `releaseAt()` says (a flight may still be on its way when the next one
 * leaves); a `Hold` always comes last.
 */
export type Step =
    | {
        readonly kind:     "Fly";
        readonly card:     Option<Card>;
        readonly from:     Anchor;
        readonly to:       Anchor;
        readonly ms:       number;
        readonly lingers?: boolean;
        readonly rushed?:  boolean;
    }
    | {
        readonly kind:   "Pulse";
        readonly target: Anchor;
        readonly tone:   PulseTone;
        readonly big:    boolean;
        readonly ms:     number;
    }
    | { readonly kind: "Pause"; readonly ms: number }
    | {
        readonly kind: "Hold";
        readonly card: Card;
        readonly at:   Anchor;
        readonly tone: PulseTone;
        readonly ms:   number;
    };


/**
 * What the animator gives a step that the next one may start before it ends:
 * the step calls `run` when `at` (a part of its duration, from 0 to 1) has
 * passed.  A step that never calls it releases the next one when it ends.
 */
export interface Release {
    readonly at:  number;
    readonly run: () => void;
}


const flightMinMs = 450;
const flightMaxMs = 750;
const pulseMs = 450;
const bigPulseMs = 900;
const pauseMs = 150;

// How far into a flight (or a pulse) the next flight may leave.
const flightOverlap = 0.7;
const pulseOverlap = 0.6;


// The longest a hazard stays pinned; it must stay above the server's window
// (8 s by default), whose end (the next batch) normally ends the hold first.
const holdCapMs = 10000;


const hand: Anchor = { kind: "Hand" };


function lane(team: TeamIndex): Anchor {
    return { kind: "Team", team };
}


/**
 * How long a flight takes over a distance: a little more than the least for a
 * short way, so a card is seen to leave and to arrive, and up to a limit for a
 * long one.
 * @param px - The distance between the two centres, in CSS pixels
 * @returns The duration in milliseconds, from 450 to 750
 */
export function flightMs(px: number): number {
    return Math.min(flightMaxMs, Math.max(flightMinMs, 380 + 0.7 * px));
}


/**
 * Says how far into a step the next one may start.  A flight may be 70%
 * through when the next flight leaves, and a pulse 60% through; a pulse starts
 * once its flight has landed, and a hold only after the step before it.
 * @param prev - The step that has started
 * @param next - The step after it
 * @returns The part of `prev` that has to be over first, from 0 to 1 (1 is
 * all of it)
 */
export function releaseAt(prev: Step, next: Step): number {
    if (next.kind === "Fly") {
        if (prev.kind === "Fly") {
            return flightOverlap;
        }
        return prev.kind === "Pulse" ? pulseOverlap : 1;
    }
    return 1;
}


function fly(card: Option<Card>, from: Anchor, to: Anchor, lingers = false): Step {
    return { kind: "Fly", card, from, to, ms: flightMinMs, ...(lingers ? { lingers } : {}) };
}


function pulse(target: Anchor, tone: PulseTone): Step {
    return { kind: "Pulse", target, tone, big: false, ms: pulseMs };
}


// Another player's hand is not on screen, so their cards leave from their
// name chip in the lane.  A seat missing from the view falls back to the lane
// `fallback`.
function seatAnchor(view: PlayerView, player: PlayerId, fallback: TeamIndex): Anchor {
    if (player === view.me.id) {
        return hand;
    }
    const seat = Option.fromNullable(view.seats.find((s) => s.id === player));
    return seat.match((s) => ({ kind: "Seat", player: s.id, team: s.team }), () => lane(fallback));
}


/**
 * Lists what to show for one event.  Pure: it only reads the view, to tell
 * the viewer's own cards (from and to the hand) from everyone else's (from
 * and to their seat in their team's lane).
 * @param event - The event
 * @param view - The view the event arrived with
 * @returns The steps, in order; a short pause for events with no motion
 */
export function stepsFor(event: GameEvent, view: PlayerView): ReadonlyArray<Step> {
    const card = (c: Card): Option<Card> => new SomeOption(c);
    // A card played from a seat onto a team's lane.
    const onLane = (player: PlayerId, c: Card, team: TeamIndex): Step => {
        return fly(card(c), seatAnchor(view, player, team), lane(team));
    };
    switch (event.type) {
        case "RaceDealt":
        case "TurnStarted":
        case "RaceEnded":
        case "GameEnded":
            return [{ kind: "Pause", ms: pauseMs }];
        case "CardDrawn":
            return [fly(
                event.card === null ? NoneOption.get() : card(event.card),
                { kind: "DrawPile" },
                seatAnchor(view, event.player, view.me.team)
            )];
        case "DistancePlayed":
            return [onLane(event.player, event.card, event.team)];
        case "HazardPlayed": {
            const target = lane(event.targetTeam);
            // The card flies in and stays: the hold shows it with its red pulse.
            return [
                fly(card(event.card), seatAnchor(view, event.player, event.targetTeam), target, true),
                { kind: "Hold", card: event.card, at: target, tone: "Bad", ms: holdCapMs }
            ];
        }
        case "HazardLanded":
            return [pulse(lane(event.targetTeam), "Bad")];
        case "RemedyPlayed":
            return [
                onLane(event.player, event.card, event.team),
                pulse(lane(event.team), "Good")
            ];
        case "SafetyPlayed":
            return [
                onLane(event.player, event.card, event.team),
                pulse(lane(event.team), "Gold")
            ];
        case "CoupFourrePlayed":
            return [
                onLane(event.player, event.card, event.team),
                { kind: "Pulse", target: lane(event.team), tone: "Gold", big: true, ms: bigPulseMs }
            ];
        case "CardDiscarded":
            return [fly(
                card(event.card),
                seatAnchor(view, event.player, view.me.team),
                { kind: "DiscardPile" }
            )];
        case "ExtensionOffered":
        case "ExtensionCalled":
        case "ExtensionDeclined":
            return [pulse(lane(event.team), "Info")];
        default: {
            // A missing case is still a compile error; an event from a newer
            // server that this page does not know shows nothing.
            const unknown: never = event;
            void unknown;
            return [];
        }
    }
}


/**
 * Lists what to show for a batch of events.  The pause an event without
 * motion asks for is left out when the batch has any motion: it would only
 * show a blank table between two flights.
 * @param events - The batch, in order
 * @param view - The view the batch arrived with
 * @returns The steps, in order
 */
export function stepsForBatch(
    events: ReadonlyArray<GameEvent>,
    view: PlayerView
): ReadonlyArray<Step> {
    const steps = events.flatMap((e) => stepsFor(e, view));
    return steps.some((s) => s.kind !== "Pause") ?
        steps.filter((s) => s.kind !== "Pause") :
        steps;
}


/**
 * Shortens a batch's steps when more batches wait behind it: its flights take
 * half their time, and it has no pulse or pause, so the table catches up.
 * @param steps - The batch's steps, in order
 * @returns The steps to play, in order
 */
export function rushSteps(steps: ReadonlyArray<Step>): ReadonlyArray<Step> {
    return steps
    .filter((s) => s.kind !== "Pulse" && s.kind !== "Pause")
    .map((s) => s.kind === "Fly" ? { ...s, ms: s.ms / 2, rushed: true } : s);
}
