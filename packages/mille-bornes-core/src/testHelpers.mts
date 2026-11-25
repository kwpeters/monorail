import { Card, cardSchema } from "./card.mjs";
import { cardCounts, type DeckKind, type ShuffledDeck } from "./deck.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import {
    seatOrder, type Game, type GameConfig, type Phase, type Seat, type SeatKind
} from "./game.mjs";
import { GameId, PlayerId } from "./ids.mjs";
import { checkInvariants, physicalCards } from "./invariants.mjs";
import { PlayerName } from "./playerName.mjs";
import { type Points } from "./points.mjs";
import { describeRejection } from "./rejection.mjs";
import { initialExtension, variantForSeatCount, type ExtensionState } from "./variant.mjs";


/**
 * Test support: builds a deck with specific cards at the top.  Never import
 * this from production code.
 * @param hands - Card lists placed first, in order (hand 0 at index 0, ...)
 * @param nextDraws - Cards placed immediately after the hands
 * @param kind - The kind of deck (default Standard)
 * @returns A valid deck: the requested cards in order, then the remaining cards
 * of the kind in standard order
 * @throws If the requested cards exceed the kind's counts
 */
export function deckFor(
    hands: ReadonlyArray<ReadonlyArray<Card>>,
    nextDraws: ReadonlyArray<Card> = [],
    kind: DeckKind = "Standard"
): ShuffledDeck {
    const requested = [...hands.flat(), ...nextDraws];
    const remaining = { ...cardCounts(kind) };
    for (const card of requested) {
        if (--remaining[card] < 0) {
            throw new Error(`deckFor: too many "${card}" cards requested for a ${kind} deck.`);
        }
    }
    const rest = cardSchema.options.flatMap((card) => Array.from({ length: remaining[card] }, () => card));
    return [...requested, ...rest] as unknown as ShuffledDeck;
}


/**
 * Test support: freezes a value and everything reachable from it, so any
 * attempt to mutate it throws a TypeError (modules are strict).
 * @param value - The value to freeze; primitives are returned as they are
 * @returns The same value, frozen
 */
export function deepFreeze<T>(value: T): T {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
    }
    return value;
}


/**
 * Test support: creates a seat whose id is derived from the name, so the same
 * name always gets the same id.  Ids are unique for names of up to 6 ASCII
 * characters.
 * @param name - The player's name
 * @param kind - Human (default) or Robot
 * @returns The seat
 */
export function seatFor(name: string, kind: SeatKind = "Human"): Seat {
    const hex = Array.from(name, (ch) => ch.codePointAt(0)!.toString(16))
    .join("")
    .padStart(12, "0")
    .slice(-12);
    return {
        id:   PlayerId.tryCreate(`00000000-0000-4000-8000-${hex}`).throwIfFailed(),
        name: PlayerName.tryCreate(name).throwIfFailed(),
        kind,
    };
}


function fullGameOf(teams: ReadonlyArray<ReadonlyArray<string>>): GameConfig {
    return {
        id:     GameId.tryCreate("00000000-0000-4000-8000-000000000000").throwIfFailed(),
        length: "Full",
        teams:  teams.map((team) => team.map((name) => seatFor(name))),
    };
}


/**
 * Test support: a Full game for 4 humans in 2 teams of 2.
 * @returns Teams [Ann, Cy] and [Bob, Di]
 */
export function twoByTwo(): GameConfig {
    return fullGameOf([["Ann", "Cy"], ["Bob", "Di"]]);
}


/**
 * Test support: a Full game for 2 humans.
 * @returns Teams [Ann] and [Bob]
 */
export function oneOnOne(): GameConfig {
    return fullGameOf([["Ann"], ["Bob"]]);
}


/**
 * Test support: a Full game for 3 humans playing alone.
 * @returns Teams [Ann], [Bob] and [Cy]
 */
export function threeSolo(): GameConfig {
    return fullGameOf([["Ann"], ["Bob"], ["Cy"]]);
}


/**
 * Test support: a Full game for 6 humans in 3 teams of 2.
 * @returns Teams [Ann, Di], [Bob, Ed] and [Cy, Flo]
 */
export function threeByTwo(): GameConfig {
    return fullGameOf([["Ann", "Di"], ["Bob", "Ed"], ["Cy", "Flo"]]);
}


/** The parts of a game a test may specify; see `buildGame()`. */
export interface GameParts {
    readonly config:      GameConfig;
    /**
     * Hands in turn order (default: empty, except that a player on turn holds
     * one Roll, since the engine never gives a turn to an empty hand).
     */
    readonly hands?:      ReadonlyArray<ReadonlyArray<Card>>;
    /** Zones by team (default: `newZone()`). */
    readonly zones?:      ReadonlyArray<DrivingZone>;
    /** Default: empty. */
    readonly drawPile?:   ReadonlyArray<Card>;
    /** Default: the first player's turn. */
    readonly phase?:      Phase;
    /** Default: 1. */
    readonly raceNumber?: number;
    /** Default: the variant's initial state. */
    readonly extension?:  ExtensionState;
    /** Points by team (default: 0). */
    readonly points?:     ReadonlyArray<number>;
}


/**
 * Test support: builds a valid game from the parts given.  Every card of the
 * variant's deck that the parts do not place goes to the discard pile.
 * @param parts - The parts to use; anything omitted gets its default
 * @returns The game
 * @throws If the parts need more of a card than the deck has, or the game
 * fails `checkInvariants()`
 */
export function buildGame(parts: GameParts): Game {
    const { config } = parts;
    const variant = variantForSeatCount(config.teams.flat().length);
    if (variant.failed) {
        throw new Error(`buildGame: ${describeRejection(variant.error)}`);
    }
    const order = seatOrder(config.teams);
    const phase = parts.phase ?? { kind: "Turn", player: order[0]!.seat.id };
    const defaultHand = (id: string): ReadonlyArray<Card> => {
        return phase.kind === "Turn" && phase.player === id ? [Card.roll] : [];
    };
    const players = order.map(({ seat, team }, i) => ({
        seat,
        team,
        hand: parts.hands ? parts.hands[i] ?? [] : defaultHand(seat.id),
    }));
    const placed: Game = {
        config,
        players,
        teams: config.teams.map((_, t) => ({
            zone:   parts.zones?.[t] ?? newZone(),
            points: (parts.points?.[t] ?? 0) as Points,
        })),
        drawPile:    parts.drawPile ?? [],
        discardPile: [],
        raceNumber:  parts.raceNumber ?? 1,
        extension:   parts.extension ?? initialExtension(variant.value),
        phase,
    };
    const cards = physicalCards(placed);
    const unplaced = deckFor([cards], [], variant.value.deck).slice(cards.length);
    const game = { ...placed, discardPile: unplaced };
    const valid = checkInvariants(game);
    if (valid.failed) {
        throw new Error(`buildGame: ${valid.error}`);
    }
    return game;
}
