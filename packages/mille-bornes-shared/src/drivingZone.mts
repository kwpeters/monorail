import { z } from "zod";
import { optionSchema } from "@repo/depot/schemaUtility";
import { calamityHazardCardSchema, distanceCardSchema } from "./card.mjs";


////////////////////////////////////////////////////////////////////////////////

// eslint-disable-next-line @typescript-eslint/naming-convention
export const RollState = {
    stopped: "Stopped",
    roll:    "Roll"
} as const;
export const rollStateSchema = z.enum(RollState);
export type RollState = z.infer<typeof rollStateSchema>;
// Enumerating values of RollState:
//     for (const cur of Object.values(RollState)) {}
//     for (const cur of rollStateSchema.options) {}

// /**
//  * A type representing a valid key in the RollState enumeration.
//  * Useful when creating mapped types.  For example:
//  *     export type RollStateCounts = {
//  *         [K in RollStateKey]: number;
//  *     };
//  */
// export type RollStateKey = keyof typeof RollState;
//
//
// /**
//  * Gets the key name for a given RollState value.  Useful when indexing
//  * into a type (probably a mapped type) that has the same keys as
//  * RollState.
//  *
//  * @param rollState - The RollState to find the key of
//  * @return The key that corresponds to the specified RollState.
//  */
// export function rollStateKey(rollState: RollState): RollStateKey {
//     for (const [key, val] of Object.entries(RollState)) {
//         if (val === rollState) {
//             return key as RollStateKey;
//         }
//     }
//
//     // Should never happen, but just in case...
//     throw new Error(`Failed to find key for RollState "${rollState}".`);
// }


////////////////////////////////////////////////////////////////////////////////
export const activeSafetyCardSchema = z.strictObject({
    playedAsCoupFourre: z.boolean()
});
export type ActiveSafetyCard = z.infer<typeof activeSafetyCardSchema>;


////////////////////////////////////////////////////////////////////////////////
export const activeSafetyCardsSchema = z.strictObject({
    drivingAce:    optionSchema(activeSafetyCardSchema),
    extraTank:     optionSchema(activeSafetyCardSchema),
    punctureProof: optionSchema(activeSafetyCardSchema),
    rightOfWay:    optionSchema(activeSafetyCardSchema),
});
export type ActiveSafetyCards = z.infer<typeof activeSafetyCardsSchema>;


////////////////////////////////////////////////////////////////////////////////
export const drivingZoneSchema = z.strictObject({
    rollState:         rollStateSchema,
    speedLimitActive:  z.boolean(),
    calamityActive:    optionSchema(calamityHazardCardSchema),
    activeSafetyCards: activeSafetyCardsSchema,
    distanceCards:     z.array(distanceCardSchema)
});
export type DrivingZone = z.infer<typeof drivingZoneSchema>;
