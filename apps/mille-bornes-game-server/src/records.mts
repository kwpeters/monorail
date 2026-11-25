import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { safeParse, unwrapOrAddIssue } from "@repo/depot/zodHelpers";
import { type Game } from "@repo/mille-bornes-core/game";
import { PlayerId } from "@repo/mille-bornes-core/ids";
import { type PendingGame } from "@repo/mille-bornes-core/pendingGame";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import {
    decodeGame, decodePendingGame, encodeGame, encodePendingGame
} from "@repo/mille-bornes-core/schemas";
import * as z from "zod";


/** What is stored for one game: a lobby, or a running game with its server-side state. */
export type GameRecord =
    | { format: 1; state: "Pending"; pending: PendingGame }
    | {
        format:    1;
        state:     "Running";
        organizer: PlayerId;
        game:      Game;
        seq:       number;
        left:      ReadonlyArray<PlayerId>;
    };


/** A player's stored credential. */
export interface SessionRecord {
    playerId: PlayerId;
    token:    string;
    name:     PlayerName;
}


/**
 * Encodes a record as plain JSON for storage.
 * @param r - The record
 * @returns A JSON value that shares no objects with the record
 */
export function encodeRecord(r: GameRecord): unknown {
    return r.state === "Pending" ?
        { format: 1, state: "Pending", pending: encodePendingGame(r.pending) } :
        {
            format:    1,
            state:     "Running",
            organizer: r.organizer,
            game:      encodeGame(r.game),
            seq:       r.seq,
            left:      [...r.left]
        };
}


const playerIdSchema = z.string().max(36).transform((s, ctx) => unwrapOrAddIssue(PlayerId.tryCreate(s), ctx));


// The inner `pending` and `game` are checked by core's decoders afterwards.
const envelopeSchema = z.discriminatedUnion("state", [
    z.strictObject({
        format:  z.literal(1),
        state:   z.literal("Pending"),
        pending: z.unknown()
    }),
    z.strictObject({
        format:    z.literal(1),
        state:     z.literal("Running"),
        organizer: playerIdSchema,
        game:      z.unknown(),
        seq:       z.number().int().nonnegative(),
        left:      z.array(playerIdSchema)
    })
]);


/**
 * Decodes a stored record from untrusted JSON.  The envelope is validated
 * strictly, then the game inside it by core's decoders, so a decoded record is
 * one the server could have written.  Never throws.
 * @param json - The parsed JSON value
 * @returns The record, or a plain-English reason it was refused
 */
export function decodeRecord(json: unknown): Result<GameRecord, string> {
    return safeParse(envelopeSchema, json).bind((env): Result<GameRecord, string> => {
        if (env.state === "Pending") {
            return decodePendingGame(env.pending).mapSuccess((pending) => ({ format: 1, state: "Pending", pending }));
        }
        return decodeGame(env.game).bind((game): Result<GameRecord, string> => {
            const seated = new Set<string>(game.config.teams.flat().map((s) => s.id));
            if (!seated.has(env.organizer)) {
                return new FailedResult("The organizer is not seated in the game.");
            }
            if (env.left.some((id) => !seated.has(id))) {
                return new FailedResult("A player who left is not seated in the game.");
            }
            if (new Set(env.left).size !== env.left.length) {
                return new FailedResult("A player is listed as having left twice.");
            }
            return new SucceededResult({
                format:    1,
                state:     "Running",
                organizer: env.organizer,
                game,
                seq:       env.seq,
                left:      env.left
            });
        });
    });
}


const sessionSchema = z.strictObject({
    playerId: playerIdSchema,
    token:    z.string().min(1).max(200),
    name:     z.string().max(100).transform((s, ctx) => unwrapOrAddIssue(PlayerName.tryCreate(s), ctx))
});


/** The stored sessions that decoded, and why each of the others did not. */
export interface DecodedSessions {
    sessions: ReadonlyArray<SessionRecord>;
    /** One plain-English reason per bad record; never a record's contents. */
    problems: ReadonlyArray<string>;
}


/**
 * Decodes the stored sessions from untrusted JSON, one record at a time, so a
 * bad record costs only itself.  Never throws.
 * @param json - The parsed JSON value
 * @returns The good sessions and a reason for each bad one, or a reason the
 * value is not a list of sessions at all
 */
export function decodeSessions(json: unknown): Result<DecodedSessions, string> {
    if (!Array.isArray(json)) {
        return new FailedResult("it is not a list of sessions.");
    }
    const sessions: Array<SessionRecord> = [];
    const problems: Array<string> = [];
    json.forEach((item: unknown, i) => {
        const decoded = safeParse(sessionSchema, item);
        if (decoded.succeeded) {
            sessions.push(decoded.value);
        }
        else {
            problems.push(`record ${i.toString()}: ${decoded.error}`);
        }
    });
    return new SucceededResult({ sessions, problems });
}


/**
 * Gets the id of the game a record holds.
 * @param r - The record
 * @returns The game's id
 */
export function recordGameId(r: GameRecord): string {
    return r.state === "Pending" ? r.pending.id : r.game.config.id;
}

