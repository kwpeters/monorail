import { Option } from "@repo/depot/option";
import { type SeatKind } from "./game.mjs";
import { type GameId, type PlayerId, type TeamIndex } from "./ids.mjs";
import { readiness, teamLayout, type PendingGame } from "./pendingGame.mjs";
import { type PlayerName } from "./playerName.mjs";
import { describeRejection } from "./rejection.mjs";
import { type GameLength } from "./scoring.mjs";


const maxSeats = 6;


/** One seat as a viewer may see it in the lobby. */
export interface PendingSeatView {
    readonly id:          PlayerId;
    readonly name:        PlayerName;
    /** The seat's team, or null when the seat count has no variant yet. */
    readonly team:        TeamIndex | null;
    readonly isMe:        boolean;
    readonly isOrganizer: boolean;
    /** Null unless the viewer is the organizer; others must not see who is a robot. */
    readonly kind:        SeatKind | null;
}


/** A pending game as one viewer may see it.  Plain JSON; safe to send. */
export interface PendingView {
    readonly id:          GameId;
    readonly length:      GameLength;
    readonly isOrganizer: boolean;
    readonly seats:       ReadonlyArray<PendingSeatView>;
    /** Whether the game can start, and if not, why in plain English. */
    readonly start:       { ok: true } | { ok: false; reason: string };
}


/** What a lobby list shows of a pending game.  Never carries a seat kind. */
export interface PendingSummary {
    readonly id:            GameId;
    readonly length:        GameLength;
    readonly organizerName: PlayerName;
    readonly seatNames:     ReadonlyArray<PlayerName>;
    readonly isFull:        boolean;
}


/**
 * Builds the lobby view one player may see.  Only the organizer learns which
 * seats are robots.
 * @param p - The pending game
 * @param viewer - The player looking; need not hold a seat
 * @returns The redacted view
 */
export function pendingViewFor(p: PendingGame, viewer: PlayerId): PendingView {
    const isOrganizer = viewer === p.organizer;
    const teams = teamLayout(p);
    const ready = readiness(p);
    return {
        id:     p.id,
        length: p.length,
        isOrganizer,
        seats:  p.seats.map((seat) => ({
            id:          seat.id,
            name:        seat.name,
            team:        teams.succeeded ? teamIndexOf(teams.value, seat.id).toNullable(null) : null,
            isMe:        seat.id === viewer,
            isOrganizer: seat.id === p.organizer,
            kind:        isOrganizer ? seat.kind : null
        })),
        start: ready.succeeded ? { ok: true } : { ok: false, reason: describeRejection(ready.error) }
    };
}


function teamIndexOf(
    teams: ReadonlyArray<ReadonlyArray<{ id: PlayerId }>>,
    id: PlayerId
): Option<TeamIndex> {
    const t = teams.findIndex((team) => team.some((s) => s.id === id));
    return Option.fromBool(t >= 0, t as TeamIndex);
}


/**
 * Summarizes a pending game for the lobby list.
 * @param p - The pending game
 * @returns The summary, without seat kinds
 */
export function pendingSummary(p: PendingGame): PendingSummary {
    const organizer = Option.fromNullable(p.seats.find((s) => s.id === p.organizer))
    .mapSome((s) => s.name)
    .defaultValue("" as PlayerName);
    return {
        id:            p.id,
        length:        p.length,
        organizerName: organizer,
        seatNames:     p.seats.map((s) => s.name),
        isFull:        p.seats.length >= maxSeats
    };
}
