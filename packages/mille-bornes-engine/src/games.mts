import { Result, SucceededResult } from "@repo/depot/result";
import type { Immutable } from "@repo/depot/typeUtils";
import { Uuid, UuidFormat } from "@repo/depot/uuid";
import { type GameState } from "@repo/mille-bornes-shared/gameState";
import { type GameConfig } from "@repo/mille-bornes-shared/gameConfig";
import type { GameId } from "./gameId.mjs";
import { create } from "./gameStateFns.mjs";
import { standardShuffledDeckProvider } from "./milleBornesDeck.mjs";


/**
 * All games that are currently in-progress.
 */
export const games = new Map<GameId, Immutable<GameState>>();


export async function newGame(config: GameConfig): Promise<Result<GameId, string>> {

    const resGameState = create(config, standardShuffledDeckProvider);
    if (resGameState.failed) {
        return resGameState;
    }

    const gameId = Uuid.create(UuidFormat.N) as GameId;
    games.set(gameId, resGameState.value);
    return Promise.resolve(new SucceededResult(gameId));
}
