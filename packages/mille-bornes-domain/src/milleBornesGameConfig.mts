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


////////////////////////////////////////////////////////////////////////////////
//
////////////////////////////////////////////////////////////////////////////////
export const schemaMilleBornesGameConfig = z.object({
    raceDistance: schemaRaceDistance,
    pointsGoal:   schemaPointsGoal,
});
export type MilleBornesGameConfig = z.infer<typeof schemaMilleBornesGameConfig>;
