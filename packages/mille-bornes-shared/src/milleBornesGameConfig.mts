import { safeParse } from "@repo/depot/zodHelpers";
import { z } from "zod";


/**
 * The race distance must be a multiple of 25 because it must be obtained exactly.
 */
export const raceDistanceSchema = z.number().positive().multipleOf(25);
export type RaceDistance = z.infer<typeof raceDistanceSchema>;


/**
 * The points goal must be a positive integer.  The points goal can be exceeded,
 * so it does not need to be a multiple of any number.
 */
export const pointsGoalSchema = z.number().positive();
export type PointsGoal = z.infer<typeof pointsGoalSchema>;


/**
 * There must be at least one human player (otherwise, what's the point?).
 * All 6 players may be human.
 */
export const numHumanPlayersSchema = z.number().int().min(1).max(6);
export type NumHumanPlayers = z.infer<typeof numHumanPlayersSchema>;


/**
 * If all players are human, there are zero bot players.  When there is only 1
 * human, there can be up to 5 bots.
 */
export const numBotPlayersSchema = z.number().int().min(0).max(5);
export type NumBotPlayers = z.infer<typeof numBotPlayersSchema>;


export const numTeamsSchema = z.number().int().min(2).max(3);
export type NumTeams = z.infer<typeof numTeamsSchema>;


////////////////////////////////////////////////////////////////////////////////

export const milleBornesGameConfigSchema =
    z.object({
        raceDistance:    raceDistanceSchema,
        pointsGoal:      pointsGoalSchema,
        numHumanPlayers: numHumanPlayersSchema,
        numBotPlayers:   numBotPlayersSchema,
        numTeams:        numTeamsSchema,
    })
    .refine(
        (config) => {
            // Make sure the number of total players allows for teams of equal size.
            const totalPlayers = config.numHumanPlayers + config.numBotPlayers;
            return totalPlayers % config.numTeams === 0;
        },
        {
            message: "The number of players must be a multiple of the number of teams",
            path:    ["numHumanPlayers", "numBotPlayers"],
        }
    );
export type MilleBornesGameConfig = z.infer<typeof milleBornesGameConfigSchema>;


export const standardMilleBornesGameConfig: MilleBornesGameConfig = safeParse(
    milleBornesGameConfigSchema,
    {
        raceDistance:    1000,
        pointsGoal:      5000,
        numHumanPlayers: 1,
        numBotPlayers:   1,
        numTeams:        2
    }
).throwIfFailed();
