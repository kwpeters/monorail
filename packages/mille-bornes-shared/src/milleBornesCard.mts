import { z } from "zod";


////////////////////////////////////////////////////////////////////////////////

// eslint-disable-next-line @typescript-eslint/naming-convention
export const MilleBornesCard = {
    dist25:          "25",
    dist50:          "50",
    dist75:          "75",
    dist100:         "100",
    dist200:         "200",
    accident:        "Accident",
    outOfGas:        "Out of Gas",
    flatTire:        "Flat Tire",
    speedLimit:      "Speed Limit",
    stop:            "Stop",
    repairs:         "Repairs",
    gasoline:        "Gasoline",
    spareTire:       "Spare Tire",
    endOfSpeedLimit: "End of Speed Limit",
    roll:            "Roll",
    drivingAce:      "Driving Ace",
    extraTank:       "Extra Tank",
    punctureProof:   "Puncture Proof",
    rightOfWay:      "Right of Way",
} as const;
export const milleBornesCardSchema = z.enum(MilleBornesCard);
export type MilleBornesCard = z.infer<typeof milleBornesCardSchema>;
// Enumerating values of MilleBornesCard:
//     for (const cur of Object.values(MilleBornesCard)) {}
//     for (const cur of milleBornesCardSchema.options) {}

// /**
//  * A type representing a valid key in the MilleBornesCard enumeration.
//  * Useful when creating mapped types.  For example:
//  *     export type MilleBornesCardCounts = {
//  *         [K in MilleBornesCardKey]: number;
//  *     };
//  */
// export type MilleBornesCardKey = keyof typeof MilleBornesCard;


// /**
//  * Gets the key name for a given MilleBornesCard value.  Useful when indexing
//  * into a type (probably a mapped type) that has the same keys as
//  * MilleBornesCard.
//  *
//  * @param milleBornesCard - The MilleBornesCard to find the key of
//  * @return The key that corresponds to the specified MilleBornesCard.
//  */
// export function milleBornesCardKey(milleBornesCard: MilleBornesCard): MilleBornesCardKey {
//     for (const [key, val] of Object.entries(MilleBornesCard)) {
//         if (val === milleBornesCard) {
//             return key as MilleBornesCardKey;
//         }
//     }
//
//     // Should never happen, but just in case...
//     throw new Error(`Failed to find key for MilleBornesCard "${milleBornesCard}".`);
// }


////////////////////////////////////////////////////////////////////////////////
// Card categories
////////////////////////////////////////////////////////////////////////////////


export const distanceCardSchema = milleBornesCardSchema.extract([
    "dist25",
    "dist50",
    "dist75",
    "dist100",
    "dist200",
]);
export type DistanceCard = z.infer<typeof distanceCardSchema>;


export const calamityHazardCardSchema = milleBornesCardSchema.extract([
    "accident",
    "outOfGas",
    "flatTire",
]);
export type CalamityHazardCard = z.infer<typeof calamityHazardCardSchema>;


export const calamityRemedyCardSchema = milleBornesCardSchema.extract([
    "repairs",
    "gasoline",
    "spareTire",
]);
export type CalamityRemedyCard = z.infer<typeof calamityRemedyCardSchema>;


export const safetyCardSchema = milleBornesCardSchema.extract([
    "drivingAce",
    "extraTank",
    "punctureProof",
    "rightOfWay",
]);
export type SafetyCard = z.infer<typeof safetyCardSchema>;
