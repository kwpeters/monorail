import { FailedResult, Result } from "@repo/depot/result";
import { type GameState } from "@repo/mille-bornes-shared/gameState";
import { type GameConfig } from "@repo/mille-bornes-shared/gameConfig";
import type { GameId } from "./gameId.mjs";


/**
 * All games that are currently in-progress.
 */
export const games = new Map<GameId, GameState>();


export function newGame(config: GameConfig): Promise<Result<GameId, string>> {
    return Promise.resolve(new FailedResult("Game creation not implemented"));
}
