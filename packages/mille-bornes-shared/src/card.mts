import { z } from "zod";


////////////////////////////////////////////////////////////////////////////////

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Card = {
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
export const cardSchema = z.enum(Card);
export type Card = z.infer<typeof cardSchema>;
// Enumerating values of Card:
//     for (const cur of Object.values(Card)) {}
//     for (const cur of cardSchema.options) {}

// /**
//  * A type representing a valid key in the Card enumeration.
//  * Useful when creating mapped types.  For example:
//  *     export type CardCounts = {
//  *         [K in CardKey]: number;
//  *     };
//  */
// export type CardKey = keyof typeof Card;


// /**
//  * Gets the key name for a given Card value.  Useful when indexing
//  * into a type (probably a mapped type) that has the same keys as
//  * Card.
//  *
//  * @param Card - The Card to find the key of
//  * @return The key that corresponds to the specified Card.
//  */
// export function CardKey(card: Card): CardKey {
//     for (const [key, val] of Object.entries(Card)) {
//         if (val === card) {
//             return key as CardKey;
//         }
//     }
//
//     // Should never happen, but just in case...
//     throw new Error(`Failed to find key for Card "${card}".`);
// }


////////////////////////////////////////////////////////////////////////////////
// Card categories
////////////////////////////////////////////////////////////////////////////////


export const distanceCardSchema = cardSchema.extract([
    "dist25",
    "dist50",
    "dist75",
    "dist100",
    "dist200",
]);
export type DistanceCard = z.infer<typeof distanceCardSchema>;


export const calamityHazardCardSchema = cardSchema.extract([
    "accident",
    "outOfGas",
    "flatTire",
]);
export type CalamityHazardCard = z.infer<typeof calamityHazardCardSchema>;


export const calamityRemedyCardSchema = cardSchema.extract([
    "repairs",
    "gasoline",
    "spareTire",
]);
export type CalamityRemedyCard = z.infer<typeof calamityRemedyCardSchema>;


export const safetyCardSchema = cardSchema.extract([
    "drivingAce",
    "extraTank",
    "punctureProof",
    "rightOfWay",
]);
export type SafetyCard = z.infer<typeof safetyCardSchema>;
