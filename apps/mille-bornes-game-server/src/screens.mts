import { type GameEvent } from "@repo/mille-bornes-core/events";
import { type PlayerId } from "@repo/mille-bornes-core/ids";
import { type PendingGame } from "@repo/mille-bornes-core/pendingGame";
import {
    pendingSummary, pendingViewFor, type PendingSummary, type PendingView
} from "@repo/mille-bornes-core/pendingView";
import { type PlayerView } from "@repo/mille-bornes-core/view";


/** The countdown a Playing screen shows. */
export interface PlayingTimer {
    kind:        "HazardWindow" | "ExtensionOffer" | "NextRace";
    remainingMs: number;
}


/**
 * What one player's screen shows.  A player always has exactly one: the lobby,
 * a waiting room, or the game.  Plain JSON; safe to send.
 */
export type Screen =
    | { kind: "Lobby"; notice: string | null; games: ReadonlyArray<PendingSummary> }
    | { kind: "Waiting"; pending: PendingView }
    | {
        kind:        "Playing";
        view:        PlayerView;
        events:      ReadonlyArray<GameEvent>;
        /** Humans with an open subscription, plus every robot. */
        connected:   ReadonlyArray<PlayerId>;
        timer:       PlayingTimer | null;
        isOrganizer: boolean;
        /** Only the organizer sees which seats are robots. */
        robots:      ReadonlyArray<PlayerId> | null;
    };


/**
 * Builds the lobby screen.
 * @param games - The open games, oldest first
 * @param notice - A one-time message for the player, or null
 * @returns The Lobby screen; it carries no seat kinds
 */
export function lobbyScreen(games: Iterable<PendingGame>, notice: string | null): Screen {
    return { kind: "Lobby", notice, games: [...games].map(pendingSummary) };
}


/**
 * Builds the waiting-room screen for one viewer.
 * @param game - The pending game the viewer is seated in
 * @param viewer - The player looking
 * @returns The Waiting screen; only the organizer sees which seats are robots
 */
export function waitingScreen(game: PendingGame, viewer: PlayerId): Screen {
    return { kind: "Waiting", pending: pendingViewFor(game, viewer) };
}
