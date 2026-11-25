import type { Card } from "@repo/mille-bornes-core/card";
import type { PlayerCommand } from "@repo/mille-bornes-core/commands";
import type { DrivingZone } from "@repo/mille-bornes-core/drivingZone";
import { applyPlayerCommand } from "@repo/mille-bornes-core/engine";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { Game } from "@repo/mille-bornes-core/game";
import { eventsFor, viewFor, type PlayerView } from "@repo/mille-bornes-core/view";
import { gameForSeats } from "./viewFixtures.mjs";
import { rollingZone } from "./zoneFixtures.mjs";


// Test support: never import this from production code.  Batches of events
// come from the real engine, so they have the order the server really sends
// (a play, then the next turn and its draw).


const dealt = gameForSeats(2);


/** Ann's player id in the 2-seat fixture game. */
export const annId = dealt.players[0]!.seat.id;


/** Bob's player id in the 2-seat fixture game. */
export const bobId = dealt.players[1]!.seat.id;


/**
 * Sets the hands and the zones of the 2-seat fixture game.
 * @param ann - Ann's hand
 * @param bob - Bob's hand
 * @param zones - The two teams' zones
 * @returns The game on Ann's turn
 */
export function setUp(
    ann: ReadonlyArray<Card>,
    bob: ReadonlyArray<Card>,
    zones: [DrivingZone, DrivingZone]
): Game {
    return {
        ...dealt,
        players: [{ ...dealt.players[0]!, hand: ann }, { ...dealt.players[1]!, hand: bob }],
        teams:   dealt.teams.map((t, i) => ({ ...t, zone: zones[i]! })),
    };
}


/** Ann's hand in `midRace`. */
export const annHand: ReadonlyArray<Card> = ["50", "25", "Stop", "Driving Ace", "Roll", "100"];


/** Bob's hand in `midRace`. */
export const bobHand: ReadonlyArray<Card> = ["Right of Way", "75", "50", "25", "25", "100"];


/** Both teams rolling, on Ann's turn. */
export const midRace: Game = setUp(annHand, bobHand, [rollingZone(), rollingZone()]);


/** What Ann's screen gets for one command: her new view and her events. */
export interface AnnsScreen {
    view:   PlayerView;
    events: ReadonlyArray<GameEvent>;
}


/**
 * Has Ann make a move in `midRace` and returns what her screen would show.
 * @param command - The move
 * @returns Ann's view after the move and her (redacted) events
 */
export function annPlays(command: PlayerCommand): AnnsScreen {
    const { game, events } = applyPlayerCommand(midRace, annId, command).throwIfFailed();
    return { view: viewFor(game, annId).throwIfFailed(), events: eventsFor(annId, events) };
}
