import { z } from "zod";
import { milleBornesGameConfigSchema } from "./milleBornesGameConfig.mjs";
import { milleBornesCardSchema } from "./milleBornesCard.mjs";
import { drivingZoneSchema } from "./drivingZone.mjs";


/**
 * A hand can contain up to 7 cards (6 in the player's hand and 1 that they have
 * just drawn and have not yet played).  There may be fewer than 6 cards in
 * situations where the draw pile has been exhausted.
 */
export const playerHandSchema = z.array(milleBornesCardSchema).max(7);
export type PlayerHand = z.infer<typeof playerHandSchema>;



export const gameStateSchema = z.strictObject({
    gameConfig: milleBornesGameConfigSchema,

    // Player hands.  One per player.
    playerHands: z.array(playerHandSchema),

    // Draw pile
    drawPile: z.array(milleBornesCardSchema),

    // Discard pile
    discardPile: z.array(milleBornesCardSchema),

    // Driving zones.  One per team.
    drivingZones: z.array(drivingZoneSchema).min(2).max(3),

    // Last move

    // Team scores.  First index is team index.  Second index is round number.
    teamScores: z.array(z.array(z.number().min(0))),
})
.refine(
    (gameState) => gameState.playerHands.length === gameState.gameConfig.players.length,
    {
        message: "Player hand count must match the number of players.",
        path:    ["playerHands"],
    }
)
.refine(
    (gameState) => gameState.teamScores.length === gameState.gameConfig.numTeams,
    {
        message: "Team score count must match the number of teams.",
        path:    ["teamScores"],
    }
)
.refine(
    (gameState) => gameState.drivingZones.length === gameState.gameConfig.numTeams,
    {
        message: "Number of driving zones must match the number of teams.",
        path:    ["drivingZones"],
    }
)
.refine(
    (gameState) => {
        const [firstTeam, ...otherTeams] = gameState.teamScores;
        if (firstTeam === undefined) {
            return true;
        }
        return otherTeams.every((teamScores) => teamScores.length === firstTeam.length);
    },
    {
        message: "The scores for each team should contain the same number of rounds.",
        path:    ["teamScores"],
    }
);
export type GameState = z.infer<typeof gameStateSchema>;
