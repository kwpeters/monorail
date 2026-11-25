import { shuffleDeck } from "@repo/mille-bornes-core/deck";
import { type DrivingZone } from "@repo/mille-bornes-core/drivingZone";
import { createGame } from "@repo/mille-bornes-core/engine";
import { type Game, type GameConfig, type Seat } from "@repo/mille-bornes-core/game";
import { GameId, PlayerId, TeamIndex } from "@repo/mille-bornes-core/ids";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { variantForSeatCount } from "@repo/mille-bornes-core/variant";
import { viewFor, type PlayerView, type ViewPhase } from "@repo/mille-bornes-core/view";
import type { PlayingData } from "../screens/GameScreen.js";


// Test support: never import this from production code.  It builds real games
// and views with core's own functions so tests see the shapes the server
// really sends.


/** The seat counts core supports. */
export type SeatCount = 2 | 3 | 4 | 6;


/** Options for `viewForSeats()`; every one has a default. */
export interface ViewOptions {
    /** Seeds the deck shuffle (default 1). */
    readonly seed?:   number;
    /**
     * Seat names in team order (team 0's members, then team 1's, ...).
     * Default: Ann, Bob, Cy, Di, Ed, Flo, assigned as core's test helpers do.
     */
    readonly names?:  ReadonlyArray<string>;
    /** Index into `names` of the viewer (default 0). */
    readonly viewer?: number;
}


/* eslint-disable @typescript-eslint/naming-convention */
// Team layouts as lists of team sizes, by seat count.
const teamSizes: Readonly<Record<SeatCount, ReadonlyArray<number>>> = {
    2: [1, 1],
    3: [1, 1, 1],
    4: [2, 2],
    6: [2, 2, 2],
};


// Core's test helpers name the seats of a 2-member team so that turn order
// alternates between teams; this order matches them.
const defaultNames: Readonly<Record<SeatCount, ReadonlyArray<string>>> = {
    2: ["Ann", "Bob"],
    3: ["Ann", "Bob", "Cy"],
    4: ["Ann", "Cy", "Bob", "Di"],
    6: ["Ann", "Di", "Bob", "Ed", "Cy", "Flo"],
};
/* eslint-enable @typescript-eslint/naming-convention */


function seatNamed(name: string): Seat {
    // The id is derived from the name so that a name always has the same id.
    const hex = Array.from(name, (ch) => ch.codePointAt(0)!.toString(16))
    .join("")
    .padStart(12, "0")
    .slice(-12);
    return {
        id:   PlayerId.tryCreate(`00000000-0000-4000-8000-${hex}`).throwIfFailed(),
        name: PlayerName.tryCreate(name).throwIfFailed(),
        kind: "Human",
    };
}


/**
 * Starts a real game: race 1 dealt from a seeded deck, seat 0 to play.
 * @param seatCount - The number of seats (2, 3, 4 or 6)
 * @param options - Seed and names
 * @returns The game
 */
export function gameForSeats(seatCount: SeatCount, options: ViewOptions = {}): Game {
    const variant = variantForSeatCount(seatCount).throwIfFailed();
    const names = options.names ?? defaultNames[seatCount];
    let next = 0;
    const config: GameConfig = {
        id:     GameId.tryCreate("00000000-0000-4000-8000-000000000000").throwIfFailed(),
        length: "Full",
        teams:  teamSizes[seatCount].map(
            (size) => Array.from({ length: size }, () => seatNamed(names[next++]!))
        ),
    };
    const deck = shuffleDeck(variant.deck, seededRandom(options.seed ?? 1));
    return createGame(config, deck).throwIfFailed().game;
}


/**
 * Builds the view a real game gives one of its players.
 * @param seatCount - The number of seats (2, 3, 4 or 6)
 * @param options - Seed, names and which seat is the viewer
 * @returns The viewer's view of race 1 just after the deal
 */
export function viewForSeats(seatCount: SeatCount, options: ViewOptions = {}): PlayerView {
    const game = gameForSeats(seatCount, options);
    const names = options.names ?? defaultNames[seatCount];
    const viewerName = names[options.viewer ?? 0]!;
    const viewer = game.players.find((p) => p.seat.name === viewerName)!;
    return viewFor(game, viewer.seat.id).throwIfFailed();
}


/**
 * Builds the view of a 2-seat game (Ann is team 0 and the viewer; Bob is
 * team 1).
 * @param seed - Seeds the deck shuffle (default 1)
 * @returns The view
 */
export function viewFor2Seats(seed = 1): PlayerView {
    return viewForSeats(2, { seed });
}


/**
 * Gets a seat's player id.
 * @param view - A view of the game
 * @param name - The seat's name
 * @returns The id of the seat with that name
 * @throws If no seat has the name
 */
export function idOf(view: PlayerView, name: string): PlayerId {
    const seat = view.seats.find((s) => s.name === name);
    if (!seat) {
        throw new Error(`No seat named "${name}".`);
    }
    return seat.id;
}


/**
 * Puts a view into another phase.  The phase is not checked against the
 * game, which is what a text test needs (for example a hazard window).
 * @param view - The view to start from
 * @param phase - The new phase
 * @returns A copy of the view in that phase
 */
export function withPhase(view: PlayerView, phase: ViewPhase): PlayerView {
    return { ...view, phase };
}


/**
 * Gets a team index.
 * @param n - The index, 0 to 2
 * @returns The team index
 */
export function team(n: number): TeamIndex {
    return TeamIndex.tryCreate(n).throwIfFailed();
}


/**
 * Replaces one team's driving zone (build the zone with core's own functions,
 * for example `playRemedy(newZone(), Card.roll)`).
 * @param view - The view to start from
 * @param teamIndex - The team
 * @param zone - The team's new zone
 * @returns A copy of the view with that zone
 */
export function withZone(view: PlayerView, teamIndex: number, zone: DrivingZone): PlayerView {
    return {
        ...view,
        teams: view.teams.map((t) => t.index === teamIndex ? { ...t, zone } : t),
    };
}


/**
 * Builds a `Playing` screen around a view.
 * @param view - The viewer's view
 * @param extras - Any of the other fields of the screen
 * @returns The screen: no events, not the organizer, no organizer-only lists
 */
export function playingScreen(
    view: PlayerView,
    extras: Partial<Omit<PlayingData, "kind" | "view">> = {}
): PlayingData {
    return {
        kind:        "Playing",
        view,
        events:      [],
        connected:   null,
        timer:       null,
        isOrganizer: false,
        robots:      null,
        ...extras,
    };
}
