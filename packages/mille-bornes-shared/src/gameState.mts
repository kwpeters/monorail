import { z } from "zod";
import { milleBornesGameConfigSchema } from "./milleBornesGameConfig.mjs";
import { milleBornesCardSchema } from "./milleBornesCard.mjs";


/**
 * A hand can contain up to 7 cards (6 in the player's hand and 1 that they have
 * just drawn and have not yet played).  There may be fewer than 6 cards in
 * situations where the draw pile has been exhausted.
 */
export const playerHandSchema = z.array(milleBornesCardSchema).max(7);
export type PlayerHand = z.infer<typeof playerHandSchema>;



export const gameStateSchema = z.strictObject({
    gameConfig: milleBornesGameConfigSchema,

    // Driving zones.  One per team.

    // Player hands.  One per player.
    playerHands: z.array(playerHandSchema),

    // Draw pile
    drawPile: z.array(milleBornesCardSchema),

    // Discard pile
    discardPile: z.array(milleBornesCardSchema),

    // Last move

    // Team scores (points)
})
.refine(
    (gameState) => gameState.playerHands.length === gameState.gameConfig.players.length,
    {
        message: "Player hand count must match the number of players.",
        path:    ["playerHands"],
    }
);
export type GameState = z.infer<typeof gameStateSchema>;
