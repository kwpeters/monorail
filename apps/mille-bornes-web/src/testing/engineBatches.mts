import { Card } from "@repo/mille-bornes-core/card";
import type { PlayerCommand } from "@repo/mille-bornes-core/commands";
import type { DrivingZone } from "@repo/mille-bornes-core/drivingZone";
import { applyPlayerCommand } from "@repo/mille-bornes-core/engine";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { Game } from "@repo/mille-bornes-core/game";
import type { PlayerId } from "@repo/mille-bornes-core/ids";
import { eventsFor, viewFor, type PlayerView } from "@repo/mille-bornes-core/view";
import { gameForSeats, team, type SeatCount } from "./viewFixtures.mjs";
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


/**
 * Both teams rolling, on Ann's turn, with Right of Way already on Ann's
 * team's drive pile: her Stop at Bob lands at once, with no hazard window.
 */
export const stopAlreadyAnswered: Game = setUp(
    annHand,
    ["75", "50", "25"],
    [{ ...rollingZone(), safeties: [{ card: "Right of Way", coupFourre: false }] }, rollingZone()]
);


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
    return annPlaysIn(midRace, command);
}


/**
 * Has Ann make a move in a game and returns what her screen would show.
 * @param before - The game, on Ann's turn
 * @param command - The move
 * @returns Ann's view after the move and her (redacted) events
 */
export function annPlaysIn(before: Game, command: PlayerCommand): AnnsScreen {
    const { game, events } = applyPlayerCommand(before, annId, command).throwIfFailed();
    return { view: viewFor(game, annId).throwIfFailed(), events: eventsFor(annId, events) };
}


/** Hands by seat name, for `arrange()`. */
export type Hands = ReadonlyArray<readonly [string, ReadonlyArray<Card>]>;


/**
 * Sets some hands and the zones of a fresh fixture game of any size.
 * @param seatCount - The number of seats (2, 3, 4 or 6)
 * @param hands - Hands by seat name; seats not named keep their dealt hand
 * @param zones - Every team's zone, by team index
 * @returns The game on the first seat's turn
 */
export function arrange(
    seatCount: SeatCount,
    hands: Hands,
    zones: ReadonlyArray<DrivingZone>
): Game {
    const g = gameForSeats(seatCount);
    const byName = new Map(hands);
    return {
        ...g,
        players: g.players.map((p) => ({ ...p, hand: byName.get(p.seat.name) ?? p.hand })),
        teams:   g.teams.map((t, i) => ({ ...t, zone: zones[i]! })),
    };
}


/**
 * Gets the view one seat of a game has.
 * @param game - The game
 * @param name - The seat's name
 * @returns That player's view
 */
export function viewOf(game: Game, name: string): PlayerView {
    const seat = game.players.find((p) => p.seat.name === name)!.seat;
    return viewFor(game, seat.id).throwIfFailed();
}


/**
 * Has a seat make a move.
 * @param game - The game
 * @param name - The seat's name
 * @param command - The move
 * @returns The game after the move
 */
export function play(game: Game, name: string, command: PlayerCommand): Game {
    const seat = game.players.find((p) => p.seat.name === name)!.seat;
    return applyPlayerCommand(game, seat.id, command).throwIfFailed().game;
}


/** What one seat's screen gets for another seat's move. */
export interface SeenMove extends AnnsScreen {
    /** The viewer's view before the move. */
    before: PlayerView;
}


/**
 * Has a seat make a move and returns what another seat's screen shows.
 * @param before - The game, on the mover's turn
 * @param mover - The name of the seat that moves
 * @param command - The move
 * @param viewer - The name of the seat whose screen it is
 * @returns The viewer's view before and after the move, and their events
 */
export function seenBy(
    before: Game,
    mover: string,
    command: PlayerCommand,
    viewer: string
): SeenMove {
    const id = (name: string): PlayerId => {
        return before.players.find((p) => p.seat.name === name)!.seat.id;
    };
    const { game, events } = applyPlayerCommand(before, id(mover), command).throwIfFailed();
    return {
        before: viewFor(before, id(viewer)).throwIfFailed(),
        view:   viewFor(game, id(viewer)).throwIfFailed(),
        events: eventsFor(id(viewer), events)
    };
}


/**
 * Ann's screen when Bob drives 75 miles after her 50 in `midRace`: his play,
 * her turn and her draw.
 */
export const bobDrivesToAnn: SeenMove = seenBy(
    play(midRace, "Ann", { type: "Drive", card: Card.dist50 }),
    "Bob",
    { type: "Drive", card: Card.dist75 },
    "Ann"
);


/**
 * A 4-seat game on Ann's turn: Ann (team 1, with Cy) holds a Flat Tire for
 * team 2 (Bob and Di), and Di holds Puncture Proof.
 */
export const beforeFlatTire: Game = arrange(
    4,
    [
        ["Ann", [Card.flatTire, Card.dist50]],
        ["Bob", [Card.dist75, Card.drivingAce]],
        ["Cy", [Card.roll, Card.stop]],
        ["Di", [Card.punctureProof, Card.dist25]],
    ],
    [rollingZone(), rollingZone()]
);


/** The attack that opens `flatTireWindow`. */
export const flatTireAttack: PlayerCommand = {
    type: "Attack", card: Card.flatTire, targetTeam: team(1)
};


/**
 * A 4-seat game in a hazard window: Ann (team 1, with Cy) has hit team 2
 * (Bob and Di) with a Flat Tire, and Di holds Puncture Proof.
 */
export const flatTireWindow: Game = play(beforeFlatTire, "Ann", flatTireAttack);


/** A 2-seat game where Ann has just reached 700 miles and decides on Extension. */
export const extensionOffer: Game = play(
    arrange(
        2,
        [["Ann", [Card.dist100, Card.dist25]]],
        [rollingZone(["200", "200", "100", "100"]), rollingZone()]
    ),
    "Ann",
    { type: "Drive", card: Card.dist100 }
);
