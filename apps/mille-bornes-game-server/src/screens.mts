import { type Result } from "@repo/depot/result";
import { broadcast } from "@repo/mille-bornes-core/broadcast";
import { type GameEvent } from "@repo/mille-bornes-core/events";
import { type Game } from "@repo/mille-bornes-core/game";
import { type PlayerId } from "@repo/mille-bornes-core/ids";
import { type PendingGame } from "@repo/mille-bornes-core/pendingGame";
import {
    pendingSummary, pendingViewFor, type PendingSummary, type PendingView
} from "@repo/mille-bornes-core/pendingView";
import { type Rejection } from "@repo/mille-bornes-core/rejection";
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


/** What a Playing screen shows besides the game itself. */
export interface PlayingContext {
    readonly organizer:   PlayerId;
    readonly timer:       PlayingTimer | null;
    /** Whether a human has a connection open; the viewer always counts. */
    readonly isConnected: (player: PlayerId) => boolean;
}


/**
 * Builds every seat's Playing screen.  The views and events come from core's
 * `broadcast()`, so each is already redacted for its viewer.
 * @param game - The game
 * @param events - The latest change's events, unredacted, or none
 * @param ctx - The organizer, the countdown and who is connected
 * @returns Each seat's screen by player id, or the rejection from
 * `broadcast()`
 */
export function playingScreens(
    game:   Game,
    events: ReadonlyArray<GameEvent>,
    ctx:    PlayingContext
): Result<ReadonlyMap<PlayerId, Screen>, Rejection> {
    const robots = game.players.filter((p) => p.seat.kind === "Robot").map((p) => p.seat.id);
    const seats = game.players.map((p) => p.seat.id);
    return broadcast(game, events).mapSuccess((updates) => new Map(updates.map((u) => {
        const connected = seats.filter((id) => {
            return id === u.player || robots.includes(id) || ctx.isConnected(id);
        });
        const screen: Screen = {
            kind:        "Playing",
            view:        u.view,
            events:      u.events,
            connected,
            timer:       ctx.timer,
            isOrganizer: u.player === ctx.organizer,
            robots:      u.player === ctx.organizer ? robots : null
        };
        return [u.player, screen];
    })));
}
