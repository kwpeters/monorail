import { z } from "zod";
import { Miles } from "./miles.mjs";


/**
 * The cards in a Mille Bornes deck.  The keys are identifiers and the values
 * are the card's display names (which are also its serialized form).
 */
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


/** Schema for distance cards (25, 50, 75, 100 and 200 miles). */
export const distanceCardSchema = cardSchema.extract([
    "dist25",
    "dist50",
    "dist75",
    "dist100",
    "dist200",
]);
export type DistanceCard = z.infer<typeof distanceCardSchema>;


/** Schema for hazard cards, which are played against an opponent. */
export const hazardCardSchema = cardSchema.extract([
    "accident",
    "outOfGas",
    "flatTire",
    "speedLimit",
    "stop",
]);
export type HazardCard = z.infer<typeof hazardCardSchema>;


/** Schema for hazards that stop the car (all hazards except Speed Limit). */
export const blockingHazardSchema = hazardCardSchema.exclude(["speedLimit"]);
export type BlockingHazard = z.infer<typeof blockingHazardSchema>;


/** Schema for remedy cards, which cure a hazard. */
export const remedyCardSchema = cardSchema.extract([
    "repairs",
    "gasoline",
    "spareTire",
    "endOfSpeedLimit",
    "roll",
]);
export type RemedyCard = z.infer<typeof remedyCardSchema>;


/** Schema for safety cards, which give permanent immunity to hazards. */
export const safetyCardSchema = cardSchema.extract([
    "drivingAce",
    "extraTank",
    "punctureProof",
    "rightOfWay",
]);
export type SafetyCard = z.infer<typeof safetyCardSchema>;


const milesByCard: Readonly<Record<DistanceCard, Miles>> = {
    [Card.dist25]:  Miles.tryCreate(25).throwIfFailed(),
    [Card.dist50]:  Miles.tryCreate(50).throwIfFailed(),
    [Card.dist75]:  Miles.tryCreate(75).throwIfFailed(),
    [Card.dist100]: Miles.tryCreate(100).throwIfFailed(),
    [Card.dist200]: Miles.tryCreate(200).throwIfFailed(),
};


/**
 * Gets the distance a distance card advances a car.
 * @param card - The distance card
 * @returns The miles on the card
 */
export function distanceMiles(card: DistanceCard): Miles {
    return milesByCard[card];
}


const remedyByHazard: Readonly<Record<HazardCard, RemedyCard>> = {
    [Card.accident]:   Card.repairs,
    [Card.outOfGas]:   Card.gasoline,
    [Card.flatTire]:   Card.spareTire,
    [Card.speedLimit]: Card.endOfSpeedLimit,
    [Card.stop]:       Card.roll,
};


/**
 * Gets the remedy card that cures a hazard.
 * @param hazard - The hazard card
 * @returns The remedy card
 */
export function remedyFor(hazard: HazardCard): RemedyCard {
    return remedyByHazard[hazard];
}


const safetyByHazard: Readonly<Record<HazardCard, SafetyCard>> = {
    [Card.accident]:   Card.drivingAce,
    [Card.outOfGas]:   Card.extraTank,
    [Card.flatTire]:   Card.punctureProof,
    [Card.speedLimit]: Card.rightOfWay,
    [Card.stop]:       Card.rightOfWay,
};


/**
 * Gets the safety card that makes a player immune to a hazard.
 * @param hazard - The hazard card
 * @returns The safety card
 */
export function safetyFor(hazard: HazardCard): SafetyCard {
    return safetyByHazard[hazard];
}


const descriptions: Readonly<Record<Card, string>> = {
    [Card.dist25]:          "Drive your car 25 miles closer to the finish line.",
    [Card.dist50]:          "Drive your car 50 miles closer to the finish line.",
    [Card.dist75]:          "Drive your car 75 miles closer to the finish line.",
    [Card.dist100]:         "Drive your car 100 miles closer to the finish line.",
    [Card.dist200]:         "Drive your car 200 miles closer to the finish line; you can play only two of these per trip.",
    [Card.accident]:        "Play on an opponent to stop their car until they play Repairs.",
    [Card.outOfGas]:        "Play on an opponent to stop their car until they play Gasoline.",
    [Card.flatTire]:        "Play on an opponent to stop their car until they play Spare Tire.",
    [Card.speedLimit]:      "Play on an opponent to limit them to 50-mile cards until they play End of Speed Limit.",
    [Card.stop]:            "Play on an opponent to stop their car until they play Roll.",
    [Card.repairs]:         "Fixes an Accident so you can get going again with a Roll.",
    [Card.gasoline]:        "Fixes Out of Gas so you can get going again with a Roll.",
    [Card.spareTire]:       "Fixes a Flat Tire so you can get going again with a Roll.",
    [Card.endOfSpeedLimit]: "Lifts a Speed Limit so you can play any distance card again.",
    [Card.roll]:            "Start your car or get it moving again after a Stop or a fixed problem.",
    [Card.drivingAce]:      "Safety: you can never have an Accident, and you can fix one you already have.",
    [Card.extraTank]:       "Safety: you can never run Out of Gas, and you can fix it if you already are.",
    [Card.punctureProof]:   "Safety: you can never get a Flat Tire, and you can fix one you already have.",
    [Card.rightOfWay]:      "Safety: you can never be stopped or limited in speed, and you do not need Roll to start.",
};


/**
 * Describes a card in one plain sentence for brand-new players.
 * @param card - The card to describe
 * @returns A short description of what the card does
 */
export function describeCard(card: Card): string {
    return descriptions[card];
}
