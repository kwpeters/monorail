import { z } from "zod";
import { NonnegativeInteger } from "@repo/depot/nonnegativeInteger";
import { assertNever } from "@repo/depot/never";


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
export const schMilleBornesCard = z.enum(MilleBornesCard);
export type MilleBornesCard = z.infer<typeof schMilleBornesCard>;
// Enumerating values of MilleBornesCard:
//     for (const cur of Object.values(MilleBornesCard)) {}
//     for (const cur of schMilleBornesCard.options) {}


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

export type CalamityHazardCard = typeof MilleBornesCard.accident |
                          typeof MilleBornesCard.outOfGas |
                          typeof MilleBornesCard.flatTire;


////////////////////////////////////////////////////////////////////////////////
// Standard card counts
////////////////////////////////////////////////////////////////////////////////


/**
 * A function type that takes a MilleBornesCard and returns the count of that
 * card.  Used in deck generation.
 */

export type CardCountFn = (card: MilleBornesCard) => NonnegativeInteger;

export const standardCardCountFn: CardCountFn = (card: MilleBornesCard): NonnegativeInteger => {
    switch (card) {
        case MilleBornesCard.dist25:
        case MilleBornesCard.dist50:
        case MilleBornesCard.dist75:
            return NonnegativeInteger.create(10);
        case MilleBornesCard.dist100:
            return NonnegativeInteger.create(12);
        case MilleBornesCard.dist200:
            return NonnegativeInteger.create(4);
        case MilleBornesCard.accident:
        case MilleBornesCard.outOfGas:
        case MilleBornesCard.flatTire:
            return NonnegativeInteger.create(3);
        case MilleBornesCard.speedLimit:
            return NonnegativeInteger.create(4);
        case MilleBornesCard.stop:
            return NonnegativeInteger.create(5);
        case MilleBornesCard.repairs:
        case MilleBornesCard.gasoline:
        case MilleBornesCard.spareTire:
            return NonnegativeInteger.create(6);
        case MilleBornesCard.endOfSpeedLimit:
            return NonnegativeInteger.create(6);
        case MilleBornesCard.roll:
            return NonnegativeInteger.create(14);
        case MilleBornesCard.drivingAce:
        case MilleBornesCard.extraTank:
        case MilleBornesCard.punctureProof:
        case MilleBornesCard.rightOfWay:
            return NonnegativeInteger.create(1);
        default:
            assertNever(card);
            break;
    }
};
