import { z } from "zod";
import { optionSchema } from "@repo/depot/schemaUtility";
import { schemaCalamityHazardCard, schemaDistanceCard } from "./milleBornesCard.mjs";

////////////////////////////////////////////////////////////////////////////////

// eslint-disable-next-line @typescript-eslint/naming-convention
export const RollState = {
    stopped: "Stopped",
    roll:    "Roll"
} as const;
export const schemaRollState = z.enum(RollState);
export type RollState = z.infer<typeof schemaRollState>;
// Enumerating values of RollState:
//     for (const cur of Object.values(RollState)) {}
//     for (const cur of schemaRollState.options) {}


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


export const activeSafetyCardStatus = z.strictObject({
    playedAsCoupFourre: z.boolean()
});
export type ActiveSafetyCardStatus = z.infer<typeof activeSafetyCardStatus>;

export const schemaActiveSafetyCards = z.strictObject({
    drivingAce:    optionSchema(activeSafetyCardStatus),
    extraTank:     optionSchema(activeSafetyCardStatus),
    punctureProof: optionSchema(activeSafetyCardStatus),
    rightOfWay:    optionSchema(activeSafetyCardStatus),
});
export type ActiveSafetyCards = z.infer<typeof schemaActiveSafetyCards>;

export const schemaDrivingZone = z.strictObject({
    rollState:         schemaRollState,
    speedLimitActive:  z.boolean(),
    calamityActive:    optionSchema(schemaCalamityHazardCard),
    activeSafetyCards: schemaActiveSafetyCards,
    distanceCards:     z.array(schemaDistanceCard)
});
export type DrivingZone = z.infer<typeof schemaDrivingZone>;
