import { inspect } from "@repo/depot/inspect";
import { NoneOption, Option, SomeOption } from "@repo/depot/option";


/**
 * An enumeration of all card types in the Mille Bornes game. This includes
 * distance cards, hazard cards, remedy cards, and safety cards.
 *
 * @example
 * // To iterate over the values in this enumeration:
 * for (const curVal of Object.values(MilleBornesCard)) {...}
 */
// Allow PascalCase so this object can look like its corresponding type.
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


/**
 * A type representing any valid Mille Bornes card value.
 */
export type MilleBornesCard = typeof MilleBornesCard[keyof typeof MilleBornesCard];


/**
 * A type representing any valid key in the MilleBornesCard enumeration.
 */
export type MilleBornesCardKey = keyof typeof MilleBornesCard;


/**
 * Type guard to check if a value is a valid MilleBornesCard.
 *
 * @param val - The value to check
 * @return True if the value is a valid MilleBornesCard, false otherwise
 */
export function isMilleBornesCard(val: unknown): val is MilleBornesCard {
    return typeof val === "string" &&
        Object.values(MilleBornesCard).includes(val as MilleBornesCard);
}


/**
 * Asserts that a value is a valid MilleBornesCard, throwing an error if it is
 * not.
 *
 * @param val - The value to assert
 * @throws Error if the value is not a valid MilleBornesCard
 */
export function assertMilleBornesCard(val: unknown): asserts val is MilleBornesCard {
    if (!isMilleBornesCard(val)) {
        throw new Error(`Failed assertion.  "${inspect(val)}" is not a MilleBornesCard.`);
    }
}


/**
 * Gets the key name for a given MilleBornesCard value.
 *
 * @param milleBornesCard - The card value to get the key name for
 * @return The key name corresponding to the card value
 * @throws Error if no key is found for the given card value
 */
export function milleBornesCardKeyName(milleBornesCard: MilleBornesCard): MilleBornesCardKey {
    for (const [key, val] of Object.entries(MilleBornesCard)) {
        if (val === milleBornesCard) {
            return key as MilleBornesCardKey;
        }
    }

    // Should never happen, but just in case...
    throw new Error(`Failed to find key for MilleBornesCard "${milleBornesCard}".`);
}


////////////////////////////////////////////////////////////////////////////////
// Standard card counts and percentages
////////////////////////////////////////////////////////////////////////////////

/**
 * A mapped type where keys are MilleBornesCard keys and values are the number
 * of cards.
 */
export type CardCounts = {
    [K in MilleBornesCardKey]: number;
};


/**
 * An object containing the standard count of each card type in a standard
 * Mille Bornes deck.
 */
const standardCardCounts: CardCounts = {
    dist25:          10,
    dist50:          10,
    dist75:          10,
    dist100:         12,
    dist200:         4,
    accident:        3,
    outOfGas:        3,
    flatTire:        3,
    speedLimit:      4,
    stop:            5,
    repairs:         6,
    gasoline:        6,
    spareTire:       6,
    endOfSpeedLimit: 6,
    roll:            14,
    drivingAce:      1,
    extraTank:       1,
    punctureProof:   1,
    rightOfWay:      1,
};


/**
 * Gets the standard count of a specific card type in a standard Mille Bornes
 * deck.
 *
 * @param card - The card type to get the count for
 * @return The number of cards of the specified type in a standard deck
 * @throws Error if no standard count is found for the card
 */
export function getStandardCardCount(card: MilleBornesCard): number {
    const key = milleBornesCardKeyName(card);
    const count = standardCardCounts[key];
    if (count === undefined) {
        throw new Error(`No standard count found for card: ${card}`);
    }
    return count;
}


/**
 * Calculates the percentage of a specific card type in a standard Mille Bornes
 * deck.
 *
 * @param card - The card type to calculate the percentage for
 * @return The percentage of the specified card type in the deck
 */
export function standardCardPercentage(card: MilleBornesCard): number {
    const totalCards = getStandardTotalCardCount();
    const cardCount = getStandardCardCount(card);
    return cardCount / totalCards * 100;
}


/**
 * Cached total number of cards in a standard Mille Bornes deck to avoid
 * recalculation.
 */
let cachedStandardTotalCardCount: Option<number> = NoneOption.get();

/**
 * Get the total number of cards in a standard Mille Bornes deck.
 *
 * @return The total number of cards in a standard Mille Bornes deck.
 */
export function getStandardTotalCardCount(): number {
    if (cachedStandardTotalCardCount.isNone) {
        // We have not calculated the total number of cards yet.  Do it now.
        let totalCount = 0;
        for (const curCard of Object.values(MilleBornesCard)) {
            const count = getStandardCardCount(curCard);
            totalCount += count;
        }
        // Set the cache.
        cachedStandardTotalCardCount = new SomeOption(totalCount);
    }

    return cachedStandardTotalCardCount.value;
}
