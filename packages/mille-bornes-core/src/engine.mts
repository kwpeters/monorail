import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { type Applied } from "./commands.mjs";
import { ShuffledDeck } from "./deck.mjs";
import { newZone } from "./drivingZone.mjs";
import {
    seatOrder, validateGameConfig, type GameConfig, type PlayerState, type TeamState
} from "./game.mjs";
import { Points } from "./points.mjs";
import { describeRejection, type Rejection } from "./rejection.mjs";
import { initialExtension, variantForSeatCount } from "./variant.mjs";


const handSize = 6;


/**
 * Deals a race: resets every zone, the discard pile and Extension, deals 6
 * cards to each player (`players[i]` gets `deck[6i]` to `deck[6i + 5]`), and
 * starts the first player's turn with a draw.  Race n's first player is
 * `players[(n - 1) % players.length]`.  Team points are kept.
 * @param config - The game's config (assumed valid)
 * @param players - The players in turn order; their hands are replaced
 * @param teams - The teams; their zones are reset and points kept
 * @param deck - The deck to deal from
 * @param raceNumber - The number of the race being dealt (1 for the first)
 * @returns The dealt game and its events, or WrongDeck if the deck's kind is
 * not the variant's (or UnsupportedPlayerCount)
 */
export function dealRace(
    config: GameConfig,
    players: ReadonlyArray<PlayerState>,
    teams: ReadonlyArray<TeamState>,
    deck: ShuffledDeck,
    raceNumber: number
): Result<Applied, Rejection> {
    const variant = variantForSeatCount(players.length);
    if (variant.failed) {
        return variant;
    }
    if (ShuffledDeck.kind(deck) !== variant.value.deck) {
        return new FailedResult({ reason: "WrongDeck" });
    }
    const first = (raceNumber - 1) % players.length;
    const firstId = players[first]!.seat.id;
    const dealtCount = players.length * handSize;
    // A full deck always outlasts the deal (at most 37 of 101 cards).
    const drawn = deck[dealtCount]!;
    const dealt = players.map((p, i) => ({
        ...p,
        hand: [...deck.slice(i * handSize, (i + 1) * handSize), ...(i === first ? [drawn] : [])],
    }));
    return new SucceededResult({
        game: {
            config,
            players:     dealt,
            teams:       teams.map((t) => ({ zone: newZone(), points: t.points })),
            drawPile:    deck.slice(dealtCount + 1),
            discardPile: [],
            raceNumber,
            extension:   initialExtension(variant.value),
            phase:       { kind: "Turn", player: firstId },
        },
        events: [
            { type: "RaceDealt", race: raceNumber },
            { type: "TurnStarted", player: firstId },
            { type: "CardDrawn", player: firstId, card: drawn },
        ],
    });
}


/**
 * Creates a game and deals race 1, with seat 0 to play first.
 * @param config - The game's config
 * @param deck - The deck for race 1; its kind must be the variant's
 * @returns The new game and its events, or a plain-English reason the game
 * cannot start
 */
export function createGame(config: GameConfig, deck: ShuffledDeck): Result<Applied, string> {
    return validateGameConfig(config).bind((c) => {
        const players = seatOrder(c.teams).map(({ seat, team }) => ({ seat, team, hand: [] }));
        const teams = c.teams.map(() => ({ zone: newZone(), points: Points.zero }));
        return dealRace(c, players, teams, deck, 1).mapError(describeRejection);
    });
}
