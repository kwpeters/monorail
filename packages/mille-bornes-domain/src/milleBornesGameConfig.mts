import { z } from "zod";


/**
 * The race distance must be a multiple of 25 because it must be obtained exactly.
 */
export const schemaRaceDistance = z.number().positive().multipleOf(25);
export type RaceDistance = z.infer<typeof schemaRaceDistance>;


/**
 * The points goal must be a positive integer.  The points goal can be exceeded,
 * so it does not need to be a multiple of any number.
 */
export const schemaPointsGoal = z.number().positive();
export type PointsGoal = z.infer<typeof schemaPointsGoal>;


/**
 * There must be at least one human player (otherwise, what's the point?).
 * All 6 players may be human.
 */
export const schemaNumHumanPlayers = z.number().int().min(1).max(6);
export type NumHumanPlayers = z.infer<typeof schemaNumHumanPlayers>;


/**
 * If all players are human, there are zero bot players.  When there is only 1
 * human, there can be up to 5 bots.
 */
export const schemaNumBotPlayers = z.number().int().min(0).max(5);
export type NumBotPlayers = z.infer<typeof schemaNumBotPlayers>;

export const schemaNumTeams = z.number().int().min(2).max(3);
export type NumTeams = z.infer<typeof schemaNumTeams>;


////////////////////////////////////////////////////////////////////////////////

export const schemaMilleBornesGameConfig = z.object({
    raceDistance:    schemaRaceDistance,
    pointsGoal:      schemaPointsGoal,
    numHumanPlayers: schemaNumHumanPlayers,
    numBotPlayers:   schemaNumBotPlayers,
    numTeams:        schemaNumTeams,
}).refine(
    (config) => {
        const totalPlayers = config.numHumanPlayers + config.numBotPlayers;
        return totalPlayers % config.numTeams === 0;
    },
    {
        message: "The number of players must be a multiple of the number of teams",
        path:    ["numHumanPlayers", "numBotPlayers"],
    }
);
export type MilleBornesGameConfig = z.infer<typeof schemaMilleBornesGameConfig>;
