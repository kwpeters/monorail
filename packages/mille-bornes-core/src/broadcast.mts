import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { type GameEvent } from "./events.mjs";
import { type Game } from "./game.mjs";
import { type PlayerId } from "./ids.mjs";
import { type Rejection } from "./rejection.mjs";
import { eventsFor, viewFor, type PlayerView } from "./view.mjs";


/** What one player is sent after a command: their view and their events. */
export interface PlayerUpdate {
    readonly player: PlayerId;
    readonly view:   PlayerView;
    readonly events: ReadonlyArray<GameEvent>;
}


/**
 * Builds what every player may see after a command.  Nothing hidden leaves
 * here: each view and event list is already redacted for its player.
 * @param g - The game after the command
 * @param events - The command's events, as the engine returned them
 * @returns One update per seat, in turn order, or the first rejection
 */
export function broadcast(
    g: Game,
    events: ReadonlyArray<GameEvent>
): Result<ReadonlyArray<PlayerUpdate>, Rejection> {
    const updates: Array<PlayerUpdate> = [];
    for (const { seat } of g.players) {
        const view = viewFor(g, seat.id);
        if (view.failed) {
            return new FailedResult(view.error);
        }
        updates.push({ player: seat.id, view: view.value, events: eventsFor(seat.id, events) });
    }
    return new SucceededResult(updates);
}
