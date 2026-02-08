import { Result } from "@repo/depot/result";
import { pipe } from "@repo/depot/pipe2";
import type { Immutable } from "@repo/depot/typeUtils";
import { safeParse } from "@repo/depot/zodHelpers";
import { type MilleBornesGameConfig, milleBornesGameConfigSchema } from "@repo/mille-bornes-shared/milleBornesGameConfig";
import type { MilleBornesCard } from "@repo/mille-bornes-shared/milleBornesCard";
import { type GameState, gameStateSchema, type PlayerHand } from "@repo/mille-bornes-shared/gameState";
import type { ShuffledDeckProvider } from "./milleBornesDeck.mjs";
// import { createDeck, shuffleDeck, standardCardCountFn } from "./milleBornesDeck.mjs";


export function newGame(
    gameConfig: Immutable<MilleBornesGameConfig>,
    shuffledDeckProvider: ShuffledDeckProvider
): Result<Immutable<GameState>, string> {
    return pipe(
        safeParse(milleBornesGameConfigSchema, gameConfig),
        (resConfig) => resConfig.mapSuccess((gameConfig) => {

            //
            // Get the shuffled deck.
            //
            const shuffledDeck = shuffledDeckProvider();

            //
            // Deal the cards.
            //
            const playerHands: Array<PlayerHand> = [];
            for (let i = 0; i < gameConfig.players.length; i++) {
                playerHands[i] = [] as Array<MilleBornesCard>;
                for (let j = 0; j < 6; j++) {
                    const card = shuffledDeck.pop();
                    if (card === undefined) {
                        throw new Error("Not enough cards in the deck to deal initial hands.");
                    }
                    playerHands[i]!.push(card);
                }
            }

            //
            // Put the remaining cards on the draw pile.
            //
            const drawPile: Array<MilleBornesCard> = shuffledDeck;

            const gameState = {
                gameConfig,
                playerHands,
                drawPile,
                discardPile: []
            } satisfies GameState;
            return gameState;
        }),
        // Run the game state through the schema to make sure it is valid.
        (resGameState) => resGameState.bind((gameState) => safeParse(gameStateSchema, gameState))
    );
}
