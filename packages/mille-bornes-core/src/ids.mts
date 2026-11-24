import { type Brand } from "@repo/depot/brand";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { generateUuid, Uuid } from "@repo/depot/uuid";


/**
 * Identifies a player.  A UUID string.
 */
export type PlayerId = Brand<string, "PlayerId">;


export namespace PlayerId {

    /**
     * Creates a new, unique PlayerId.
     * @returns The new PlayerId
     */
    export function create(): PlayerId {
        return generateUuid() as PlayerId;
    }


    /**
     * Validates a string as a PlayerId.
     * @param s - The string to validate
     * @returns A successful result containing the PlayerId or a failed result
     * containing an error message
     */
    export function tryCreate(s: string): Result<PlayerId, string> {
        return Uuid.isValid(s) ?
            new SucceededResult(s as PlayerId) :
            new FailedResult(`"${s}" is not a valid PlayerId.`);
    }

}


/**
 * Identifies a game.  A UUID string.
 */
export type GameId = Brand<string, "GameId">;


export namespace GameId {

    /**
     * Creates a new, unique GameId.
     * @returns The new GameId
     */
    export function create(): GameId {
        return generateUuid() as GameId;
    }


    /**
     * Validates a string as a GameId.
     * @param s - The string to validate
     * @returns A successful result containing the GameId or a failed result
     * containing an error message
     */
    export function tryCreate(s: string): Result<GameId, string> {
        return Uuid.isValid(s) ?
            new SucceededResult(s as GameId) :
            new FailedResult(`"${s}" is not a valid GameId.`);
    }

}


/**
 * The index of a team within a game (0, 1 or 2).
 */
export type TeamIndex = Brand<number, "TeamIndex">;


export namespace TeamIndex {

    /**
     * Creates a TeamIndex.
     * @param n - The team index
     * @returns A successful result containing the TeamIndex or a failed result
     * containing an error message
     */
    export function tryCreate(n: number): Result<TeamIndex, string> {
        if (!Number.isInteger(n) || n < 0 || n > 2) {
            return new FailedResult(`TeamIndex must be an integer from 0 to 2, but got ${n}.`);
        }
        return new SucceededResult(n as TeamIndex);
    }

}
