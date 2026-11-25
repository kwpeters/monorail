import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { safeParse, unwrapOrAddIssue } from "@repo/depot/zodHelpers";
import { z } from "zod";
import {
    blockingHazardSchema, cardSchema, distanceCardSchema, hazardCardSchema, remedyCardSchema,
    safetyCardSchema
} from "./card.mjs";
import { type PlayerCommand } from "./commands.mjs";
import { gameLengthSchema, seatSchema, validateGameConfig, type Game } from "./game.mjs";
import { GameId, TeamIndex } from "./ids.mjs";
import { checkInvariants } from "./invariants.mjs";
import { Miles } from "./miles.mjs";
import { type PendingCommand, type PendingGame } from "./pendingGame.mjs";
import { PlayerName } from "./playerName.mjs";
import { Points } from "./points.mjs";


// Size caps: the most any valid game or lobby can hold.
const maxCards = 106;
const maxHand = 7;
const maxTeams = 3;
const maxTeamSize = 2;
const maxSeats = 6;


/**
 * An array schema that checks the length before visiting any element, so a
 * huge or sparse array is rejected cheaply.  (`z.array().max()` visits every
 * element first.)
 */
function capped<TItem extends z.ZodType>(
    item: TItem,
    max:  number
): z.ZodType<Array<z.output<TItem>>> {
    return z.custom<Array<unknown>>(
        (x) => Array.isArray(x) && x.length <= max,
        `Expected an array of at most ${max} items.`
    )
    .pipe(z.array(item));
}


/** A schema that applies a value type's brand via its `tryCreate()`. */
function branded<TIn, TOut>(
    base:      z.ZodType<TIn>,
    tryCreate: (x: TIn) => Result<TOut, string>
): z.ZodType<TOut> {
    return base.transform((x, ctx) => unwrapOrAddIssue(tryCreate(x), ctx));
}


const playerIdSchema = seatSchema.shape.id;
const gameIdSchema = branded(z.string(), GameId.tryCreate);
const teamIndexSchema = branded(z.number(), TeamIndex.tryCreate);
const milesSchema = branded(z.number(), Miles.tryCreate);
const pointsSchema = branded(z.number(), Points.tryCreate);
const countSchema = z.int().min(0);
const strictSeatSchema = seatSchema.strict();


/** Schema for a command from a player's device.  Unknown fields are rejected. */
export const playerCommandSchema: z.ZodType<PlayerCommand> = z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("Drive"), card: distanceCardSchema }),
    z.strictObject({
        type:       z.literal("Attack"),
        card:       hazardCardSchema,
        targetTeam: teamIndexSchema,
    }),
    z.strictObject({ type: z.literal("Remedy"), card: remedyCardSchema }),
    z.strictObject({ type: z.literal("PlaySafety"), card: safetyCardSchema }),
    z.strictObject({ type: z.literal("Discard"), card: cardSchema }),
    z.strictObject({ type: z.literal("CoupFourre"), card: safetyCardSchema }),
    z.strictObject({ type: z.literal("CallExtension") }),
    z.strictObject({ type: z.literal("DeclineExtension") }),
]);


/** Schema for a command to a pending game.  Unknown fields are rejected. */
export const pendingCommandSchema: z.ZodType<PendingCommand> = z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("AddHuman"), seat: strictSeatSchema }),
    z.strictObject({ type: z.literal("AddRobot"), seat: strictSeatSchema }),
    z.strictObject({ type: z.literal("RemoveSeat"), id: playerIdSchema }),
    z.strictObject({ type: z.literal("SwapSeats"), a: playerIdSchema, b: playerIdSchema }),
    z.strictObject({ type: z.literal("SetLength"), length: gameLengthSchema }),
]);


const zoneSchema = z.strictObject({
    status: z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("NeedsRoll") }),
        z.strictObject({ kind: z.literal("Rolling") }),
        z.strictObject({ kind: z.literal("Hazard"), hazard: blockingHazardSchema }),
    ]),
    speedLimit: z.boolean(),
    distance:   capped(distanceCardSchema, maxCards),
    safeties:   capped(
        z.strictObject({ card: safetyCardSchema, coupFourre: z.boolean() }),
        safetyCardSchema.options.length
    ),
});


const raceResultSchema = z.strictObject({
    outcome: z.discriminatedUnion("kind", [
        z.strictObject({
            kind:            z.literal("TripCompleted"),
            team:            teamIndexSchema,
            delayedAction:   z.boolean(),
            extensionCaller: teamIndexSchema.nullable(),
        }),
        z.strictObject({
            kind:            z.literal("Exhausted"),
            winner:          z.union([teamIndexSchema, z.literal("Tie")]),
            extensionCaller: teamIndexSchema.nullable(),
        }),
    ]),
    scores: capped(z.strictObject({
        broughtForward:  pointsSchema,
        miles:           milesSchema,
        milestones:      pointsSchema,
        safetyCount:     countSchema,
        safeties:        pointsSchema,
        coupFourreCount: countSchema,
        coupFourres:     pointsSchema,
        tripCompleted:   pointsSchema,
        delayedAction:   pointsSchema,
        safeTrip:        pointsSchema,
        shutout:         pointsSchema,
        extension:       pointsSchema,
        totalForRace:    pointsSchema,
        combinedTotal:   pointsSchema,
    }), maxTeams),
});


const gameSchema: z.ZodType<Game> = z.strictObject({
    config: z.strictObject({
        id:     gameIdSchema,
        length: gameLengthSchema,
        teams:  capped(capped(strictSeatSchema, maxTeamSize), maxTeams),
    }),
    players: capped(z.strictObject({
        seat: strictSeatSchema,
        team: teamIndexSchema,
        hand: capped(cardSchema, maxHand),
    }), maxSeats),
    teams:       capped(z.strictObject({ zone: zoneSchema, points: pointsSchema }), maxTeams),
    drawPile:    capped(cardSchema, maxCards),
    discardPile: capped(cardSchema, maxCards),
    raceNumber:  z.number(),
    extension:   z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("NotApplicable") }),
        z.strictObject({ kind: z.literal("Available") }),
        z.strictObject({ kind: z.literal("Called"), caller: teamIndexSchema }),
    ]),
    phase: z.discriminatedUnion("kind", [
        z.strictObject({ kind: z.literal("Turn"), player: playerIdSchema }),
        z.strictObject({
            kind:     z.literal("HazardIncoming"),
            attacker: playerIdSchema,
            hazard:   hazardCardSchema,
            target:   teamIndexSchema,
        }),
        z.strictObject({
            kind:    z.literal("ExtensionOffer"),
            decider: playerIdSchema,
            team:    teamIndexSchema,
        }),
        z.strictObject({ kind: z.literal("RaceOver"), result: raceResultSchema }),
        z.strictObject({
            kind:   z.literal("GameOver"),
            winner: teamIndexSchema,
            result: raceResultSchema,
        }),
    ]),
});


const pendingGameSchema: z.ZodType<PendingGame> = z.strictObject({
    id:        gameIdSchema,
    organizer: playerIdSchema,
    length:    gameLengthSchema,
    seats:     capped(strictSeatSchema, maxSeats),
});


// Decoding must never throw, even on input whose getters throw.
function guarded<T>(decode: () => Result<T, string>): Result<T, string> {
    try {
        return decode();
    }
    catch (err) {
        return new FailedResult(`The input could not be decoded: ${String(err)}`);
    }
}


function toJson(value: unknown): unknown {
    return JSON.parse(JSON.stringify(value));
}


/**
 * Encodes a game for storage, such as a snapshot on disk.
 * @param g - The game
 * @returns A plain JSON value that shares no objects with the game
 */
export function encodeGame(g: Game): unknown {
    return toJson(g);
}


/**
 * Decodes a game from untrusted JSON (for example a snapshot read back from
 * disk).  The structure is checked first, then the config, then every
 * invariant, so a decoded game is one the engine could have produced.  Never
 * throws.
 * @param json - The parsed JSON value
 * @returns The game, or a plain-English reason it was refused
 */
export function decodeGame(json: unknown): Result<Game, string> {
    return guarded(() => safeParse(gameSchema, json).bind((g) => {
        return validateGameConfig(g.config)
        .bind(() => checkInvariants(g))
        .mapSuccess(() => g);
    }));
}


/**
 * Encodes a pending game for storage.
 * @param p - The pending game
 * @returns A plain JSON value that shares no objects with the pending game
 */
export function encodePendingGame(p: PendingGame): unknown {
    return toJson(p);
}


// What `applyPendingCommand()` guarantees about the seats.
function checkSeats(p: PendingGame): Result<PendingGame, string> {
    for (const [i, seat] of p.seats.entries()) {
        const earlier = p.seats.slice(0, i);
        if (earlier.some((other) => other.id === seat.id)) {
            return new FailedResult(`Two seats share the player id ${seat.id}.`);
        }
        const sameName = earlier.find((other) => PlayerName.isSame(other.name, seat.name));
        if (sameName) {
            return new FailedResult(
                `The names "${sameName.name}" and "${seat.name}" are too alike.`
            );
        }
    }
    return p.seats.some((s) => s.id === p.organizer && s.kind === "Human") ?
        new SucceededResult(p) :
        new FailedResult(`The organizer ${p.organizer} does not have a human seat.`);
}


/**
 * Decodes a pending game from untrusted JSON.  Never throws.
 * @param json - The parsed JSON value
 * @returns The pending game, or a plain-English reason it was refused
 */
export function decodePendingGame(json: unknown): Result<PendingGame, string> {
    return guarded(() => safeParse(pendingGameSchema, json).bind(checkSeats));
}
