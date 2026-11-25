import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { PlayerId, TeamIndex } from "@repo/mille-bornes-core/ids";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { z } from "zod";


/**
 * A place on the table an animation starts or ends at; each one is the
 * element with the matching `data-anim-anchor` attribute.
 */
export type Anchor =
    | { readonly kind: "DrawPile" }
    | { readonly kind: "DiscardPile" }
    | { readonly kind: "Hand" }
    | { readonly kind: "Team"; readonly team: TeamIndex };


/** The color of a pulse: a fix, a hit, a safety, or news. */
export const pulseToneSchema = z.enum(["Good", "Bad", "Gold", "Info"]);


/** One of the colors a pulse can have (see `pulseToneSchema`). */
export type PulseTone = z.infer<typeof pulseToneSchema>;


/**
 * One thing to show, played one at a time.  A `Fly` moves a card (face down
 * when it is none) and fades it out at the end unless it `lingers`, because
 * a `Hold` takes it over; a `Pulse` glows a lane once (twice when `big`); a
 * `Hold` keeps a card pinned at a lane, with a pulse of its `tone` beside it,
 * until the animator ends it (the next batch arrives, a snapshot shows the
 * window is over, or `ms` passes).
 */
export type Step =
    | {
        readonly kind:     "Fly";
        readonly card:     Option<Card>;
        readonly from:     Anchor;
        readonly to:       Anchor;
        readonly ms:       number;
        readonly lingers?: boolean;
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


const flyMs = 350;
const pulseMs = 450;
const bigPulseMs = 900;
const pauseMs = 150;


// The longest a hazard stays pinned; the server's window is shorter, and its
// end (the next batch) normally ends the hold first.
const holdCapMs = 6000;


const hand: Anchor = { kind: "Hand" };


function lane(team: TeamIndex): Anchor {
    return { kind: "Team", team };
}


function fly(card: Option<Card>, from: Anchor, to: Anchor, lingers = false): Step {
    return { kind: "Fly", card, from, to, ms: flyMs, ...(lingers ? { lingers } : {}) };
}


function pulse(target: Anchor, tone: PulseTone): Step {
    return { kind: "Pulse", target, tone, big: false, ms: pulseMs };
}


// Another player's hand is not on screen, so their cards leave from their
// team's lane.  A seat missing from the view falls back to `fallback`.
function seatAnchor(view: PlayerView, player: PlayerId, fallback: TeamIndex): Anchor {
    if (player === view.me.id) {
        return hand;
    }
    const seat = Option.fromNullable(view.seats.find((s) => s.id === player));
    return lane(seat.match((s) => s.team, () => fallback));
}


/**
 * Lists what to show for one event.  Pure: it only reads the view, to tell
 * the viewer's own cards (from and to the hand) from everyone else's (from
 * and to their team's lane).
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
