import { Result } from "@repo/depot/result";
import { pipe } from "@repo/depot/pipe2";
import type { Immutable } from "@repo/depot/typeUtils";
import { NoneOption } from "@repo/depot/option";
import { safeParse } from "@repo/depot/zodHelpers";
import { type GameConfig, gameConfigSchema } from "@repo/mille-bornes-shared/gameConfig";
import type { Card } from "@repo/mille-bornes-shared/card";
import { type GameState, gameStateSchema, type PlayerHand } from "@repo/mille-bornes-shared/gameState";
import { RollState, type DrivingZone } from "@repo/mille-bornes-shared/drivingZone";
import type { ShuffledDeckProvider } from "./milleBornesDeck.mjs";
// import { createDeck, shuffleDeck, standardCardCountFn } from "./milleBornesDeck.mjs";


export function newGame(
    gameConfig: Immutable<GameConfig>,
    shuffledDeckProvider: ShuffledDeckProvider
): Result<Immutable<GameState>, string> {
    return pipe(
        safeParse(gameConfigSchema, gameConfig),
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
                playerHands[i] = [] as Array<Card>;
                for (let j = 0; j < 6; j++) {
                    const card = shuffledDeck.shift();
                    if (card === undefined) {
                        throw new Error("Not enough cards in the deck to deal initial hands.");
                    }
                    playerHands[i]!.push(card);
                }
            }

            //
            // Put the remaining cards on the draw pile.
            //
            const drawPile: Array<Card> = shuffledDeck;

            //
            // Initialize all team scores to 0.
            //
            const teamScores: Array<Array<number>> = [];
            for (let i = 0; i < gameConfig.numTeams; i++) {
                teamScores.push([]);
            }

            //
            // Initialize one driving zone per team.
            //
            const drivingZones = [] as DrivingZone[];
            for (let i = 0; i < gameConfig.numTeams; i++) {
                drivingZones[i] = {
                    rollState:         RollState.stopped,
                    speedLimitActive:  false,
                    calamityActive:    NoneOption.get(),
                    activeSafetyCards: {
                        drivingAce:    NoneOption.get(),
                        extraTank:     NoneOption.get(),
                        punctureProof: NoneOption.get(),
                        rightOfWay:    NoneOption.get()
                    },
                    distanceCards:    []
                } satisfies DrivingZone;
            }

            const gameState = {
                gameConfig,
                playerHands,
                drawPile,
                discardPile: [],
                teamScores,
                drivingZones
            } satisfies GameState;
            return gameState;
        }),
        // Run the game state through the schema to make sure it is valid.
        (resGameState) => resGameState.bind((gameState) => safeParse(gameStateSchema, gameState))
    );
}
