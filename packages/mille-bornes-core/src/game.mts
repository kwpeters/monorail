import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { unwrapOrAddIssue } from "@repo/depot/zodHelpers";
import { z } from "zod";
import { type Card, type HazardCard } from "./card.mjs";
import { type DrivingZone } from "./drivingZone.mjs";
import { PlayerId, type GameId, type TeamIndex } from "./ids.mjs";
import { PlayerName } from "./playerName.mjs";
import { type Points } from "./points.mjs";
import { describeRejection } from "./rejection.mjs";
import { type GameLength, type RaceOutcome, type RaceScore } from "./scoring.mjs";
import { type ExtensionState, variantForSeatCount } from "./variant.mjs";


// `satisfies` fails to compile if this drifts from `GameLength` either way.
/* eslint-disable @typescript-eslint/naming-convention */
const gameLengths = {
    Quick: "Quick",
    Short: "Short",
    Full:  "Full",
} as const satisfies { readonly [TKey in GameLength]: TKey };
/* eslint-enable @typescript-eslint/naming-convention */

/** Schema for a game length (see `GameLength` in scoring.mts). */
export const gameLengthSchema = z.enum(gameLengths);


/** Schema for who sits in a seat: a person or a robot. */
export const seatKindSchema = z.enum(["Human", "Robot"]);
export type SeatKind = z.infer<typeof seatKindSchema>;


/** One seat at the table. */
export interface Seat {
    readonly id:   PlayerId;
    readonly name: PlayerName;
    readonly kind: SeatKind;
}


// The name must already be in the normalized form `PlayerName` guarantees:
// the branded `Seat.name` is stored as given, never silently changed.
function normalizedName(s: string): Result<PlayerName, string> {
    return PlayerName.tryCreate(s).bind((name) => name === s ?
        new SucceededResult(name) :
        new FailedResult(`The player name "${s}" is not in its normalized form.`));
}


/**
 * Schema for a seat that `PlayerId` and `PlayerName` could have made: a
 * canonical id and an already-normalized name.  Extra properties are
 * stripped; use `seatSchema.strict()` to reject them.
 */
export const seatSchema = z.object({
    id:   z.string().transform((s, ctx) => unwrapOrAddIssue(PlayerId.tryCreate(s), ctx)),
    name: z.string().transform((s, ctx) => unwrapOrAddIssue(normalizedName(s), ctx)),
    kind: seatKindSchema,
}) satisfies z.ZodType<Seat>;


/**
 * How a game is set up.  `teams[t][i]` is the i-th member of team t; turn
 * order follows from it (see `seatOrder()`).
 */
export interface GameConfig {
    readonly id:     GameId;
    readonly length: GameLength;
    readonly teams:  ReadonlyArray<ReadonlyArray<Seat>>;
}


/**
 * Gets the turn order: team 0's first seat, team 1's first seat, ..., then
 * each team's second seat, so turns alternate between teams.
 * @param teams - The teams, as in `GameConfig`
 * @returns Every seat with its team, in turn order
 */
export function seatOrder(
    teams: GameConfig["teams"]
): ReadonlyArray<{ seat: Seat; team: TeamIndex }> {
    const rounds = Math.max(0, ...teams.map((team) => team.length));
    return Array.from({ length: rounds }, (_, i) => teams.flatMap((team, t) => {
        const seat = team[i];
        return seat ? [{ seat, team: t as TeamIndex }] : [];
    })).flat();
}


/**
 * Checks that a config can be played: the seat count has a variant whose
 * team layout matches, names and ids are unique, and someone is human.
 * @param c - The config
 * @returns The config, or a plain-English reason it cannot be played
 */
export function validateGameConfig(c: GameConfig): Result<GameConfig, string> {
    const seats = c.teams.flat();
    const variantResult = variantForSeatCount(seats.length);
    if (variantResult.failed) {
        return new FailedResult(describeRejection(variantResult.error));
    }
    const { teamCount, teamSize } = variantResult.value;
    if (c.teams.length !== teamCount || c.teams.some((team) => team.length !== teamSize)) {
        return new FailedResult(`A game of ${seats.length} players needs ${teamCount} teams of ${teamSize}.`);
    }
    for (const [i, seat] of seats.entries()) {
        const earlier = seats.slice(0, i);
        const sameName = earlier.find((other) => PlayerName.isSame(other.name, seat.name));
        if (sameName) {
            return new FailedResult(
                `The names "${sameName.name}" and "${seat.name}" are too alike. Each player needs a different name.`
            );
        }
        if (earlier.some((other) => other.id === seat.id)) {
            return new FailedResult(`Two seats share the player id ${seat.id}.`);
        }
    }
    if (!seats.some((seat) => seat.kind === "Human")) {
        return new FailedResult("A game needs at least one human player.");
    }
    return new SucceededResult(c);
}


/** A player in a game: their seat, team and hand. */
export interface PlayerState {
    readonly seat: Seat;
    readonly team: TeamIndex;
    readonly hand: ReadonlyArray<Card>;
}


/** A team in a game. */
export interface TeamState {
    readonly zone:   DrivingZone;
    /** The team's total from finished races. */
    readonly points: Points;
}


/** How a race ended and the score sheet (one column per team). */
export interface RaceResult {
    readonly outcome: RaceOutcome;
    readonly scores:  ReadonlyArray<RaceScore>;
}


/** What the game is waiting for. */
export type Phase =
    | { readonly kind: "Turn"; readonly player: PlayerId }
    | {
        readonly kind:     "HazardIncoming";
        readonly attacker: PlayerId;
        readonly hazard:   HazardCard;
        readonly target:   TeamIndex;
    }
    | { readonly kind: "ExtensionOffer"; readonly decider: PlayerId; readonly team: TeamIndex }
    | { readonly kind: "RaceOver"; readonly result: RaceResult }
    | { readonly kind: "GameOver"; readonly winner: TeamIndex; readonly result: RaceResult };


/**
 * The complete state of a game.  `players` is in turn order and `teams` is
 * indexed by TeamIndex.  Draws take `drawPile[0]`; the top of the discard
 * pile is its last element.
 */
export interface Game {
    readonly config:      GameConfig;
    readonly players:     ReadonlyArray<PlayerState>;
    readonly teams:       ReadonlyArray<TeamState>;
    readonly drawPile:    ReadonlyArray<Card>;
    readonly discardPile: ReadonlyArray<Card>;
    readonly raceNumber:  number;
    readonly extension:   ExtensionState;
    readonly phase:       Phase;
}
