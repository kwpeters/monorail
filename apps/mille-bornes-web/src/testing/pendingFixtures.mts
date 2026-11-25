import { GameId, PlayerId } from "@repo/mille-bornes-core/ids";
import { applyPendingCommand, createPending } from "@repo/mille-bornes-core/pendingGame";
import { pendingViewFor, type PendingView } from "@repo/mille-bornes-core/pendingView";
import { type PlayerName } from "@repo/mille-bornes-core/playerName";
import type { GameLength } from "@repo/mille-bornes-core/scoring";


// Test support: never import this from production code.  It builds pending
// games with core's own functions so tests see the shapes the server sends.


/** One seat of a fixture. */
export interface FixtureSeat {
    readonly name:  string;
    readonly kind?: "Human" | "Robot";
}


/** Options for `pendingViewForSeats()`. */
export interface PendingOptions {
    /** Index of the viewer in the seat list (default 0, the organizer). */
    readonly viewer?: number;
    readonly length?: GameLength;
}


/**
 * Builds a pending game whose first seat is the organizer and returns it as
 * one player's view.  Names are not validated, on purpose: the client must
 * cope with whatever arrives.
 * @param seats - The seats in order; the first is always a human organizer
 * @param options - The viewer and the game length
 * @returns The view, and the id of every seat in order
 */
export function pendingViewForSeats(
    seats:   ReadonlyArray<FixtureSeat>,
    options: PendingOptions = {}
): { view: PendingView; ids: ReadonlyArray<PlayerId> } {
    const ids = seats.map(() => PlayerId.create());
    // Core rejects names it would not accept from a real player (markup, for
    // one), so the game is built with plain names and the view is given the
    // fixture's own, whatever they are.
    const seatOf = (i: number) => ({
        id:   ids[i]!,
        name: `Player ${i + 1}` as PlayerName,
        kind: seats[i]!.kind ?? "Human"
    });
    let pending = createPending(GameId.create(), seatOf(0));
    for (let i = 1; i < seats.length; i++) {
        const seat = seatOf(i);
        pending = applyPendingCommand(
            pending,
            seat.kind === "Robot" ? ids[0]! : seat.id,
            { type: seat.kind === "Robot" ? "AddRobot" : "AddHuman", seat }
        ).throwIfFailed();
    }
    if (options.length !== undefined) {
        pending = applyPendingCommand(
            pending,
            ids[0]!,
            { type: "SetLength", length: options.length }
        ).throwIfFailed();
    }
    const view = pendingViewFor(pending, ids[options.viewer ?? 0]!);
    return {
        view: {
            ...view,
            seats: view.seats.map((seat, i) => ({ ...seat, name: seats[i]!.name as PlayerName }))
        },
        ids
    };
}
