import { z } from "zod";
import { safeParse } from "@repo/depot/zodHelpers";
import type { Immutable } from "@repo/depot/typeUtils";


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


////////////////////////////////////////////////////////////////////////////////

export const numTeamsSchema = z.number().int().min(2).max(3);
export type NumTeams = z.infer<typeof numTeamsSchema>;


export const humanPlayerSchema = z.strictObject({
    type: z.literal("HumanPlayer"),
    name: z.string().min(1).max(20)
});
export type HumanPlayer = z.infer<typeof humanPlayerSchema>;

export const botPlayerSchema = z.strictObject({
    type: z.literal("BotPlayer"),
    name: z.string().min(1).max(20)
});
export type BotPlayer = z.infer<typeof botPlayerSchema>;


export const playerSchema = z.discriminatedUnion(
    "type",
    [humanPlayerSchema, botPlayerSchema]
);
export type Player = z.infer<typeof playerSchema>;


/**
 * Player list must contain at least 2 players and at most 6 players.
 */
export const playersSchema =
    z.array(playerSchema)
    .min(2)
    .max(6)
    .refine(
        (players) => players.some((player) => player.type === "HumanPlayer"),
        {
            message: "Player list must include at least one human player.",
        }
    )
    .refine(
        (players) => {
            const names = players.map((player) => player.name);
            return names.length === new Set(names).size;
        },
        {
            message: "Player names must be unique.",
        }
    );
export type Players = z.infer<typeof playersSchema>;


export const milleBornesGameConfigSchema =
    z.object({
        raceDistance: raceDistanceSchema,
        pointsGoal:   pointsGoalSchema,
        numTeams:     numTeamsSchema,
        players:      playersSchema,
    })
    .refine(
        (config) => {
            // Make sure the number of total players allows for teams of equal size.
            const totalPlayers = config.players.length;
            return totalPlayers % config.numTeams === 0;
        },
        {
            message: "Each team must have the same number of players.",
            path:    ["players"],
        }
    );
export type MilleBornesGameConfig = z.infer<typeof milleBornesGameConfigSchema>;



////////////////////////////////////////////////////////////////////////////////

export const standardMilleBornesGameConfig: Immutable<MilleBornesGameConfig> = safeParse(
    milleBornesGameConfigSchema,
    {
        raceDistance: 1000,
        pointsGoal:   5000,
        numTeams:     2,
        players:      [
            { type: "HumanPlayer", name: "Player 1" },
            { type: "BotPlayer", name: "Player 2" }
        ]
    } satisfies MilleBornesGameConfig
).throwIfFailed();
