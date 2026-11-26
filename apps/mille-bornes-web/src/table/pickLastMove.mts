import { NoneOption, SomeOption, type Option } from "@repo/depot/option";
import type { GameEvent } from "@repo/mille-bornes-core/events";


// The engine ends a play's batch with the next turn and its draw, so the
// move itself is the last event that is not part of that bookkeeping.
const bookkeeping: ReadonlySet<GameEvent["type"]> = new Set(["TurnStarted", "CardDrawn"]);


/**
 * Picks the event the "last move" line should describe: the last one that is
 * not a turn change or a draw.  A batch with nothing else (for example the
 * turn that follows a hazard that could not land) falls back to its last
 * event.  When a batch holds both a hazard's play and its landing (no
 * window opened), the play is described.  A freshly dealt race gives its
 * `RaceDealt` event.
 * @param events - One batch of events, in order
 * @returns The event to describe, or none for an empty batch
 */
export function pickLastMove(events: ReadonlyArray<GameEvent>): Option<GameEvent> {
    // A hazard that landed at once comes with its play, which names the player.
    const shown = events.some((e) => e.type === "HazardPlayed") ?
        events.filter((e) => e.type !== "HazardLanded") :
        events;
    const move = [...shown].reverse().find((e) => !bookkeeping.has(e.type)) ?? shown.at(-1);
    return move === undefined ? NoneOption.get() : new SomeOption(move);
}
