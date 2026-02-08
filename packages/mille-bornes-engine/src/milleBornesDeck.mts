import * as _ from "lodash-es";
import { PositiveInteger } from "@repo/depot/positiveInteger";
import { type Brand } from "@repo/depot/brand";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { NonnegativeInteger } from "@repo/depot/nonnegativeInteger";
import { assertNever } from "@repo/depot/never";
import { Card, cardSchema } from "@repo/mille-bornes-shared/card";


/**
 * A function type that takes a Card and returns the count of that
 * card.  Used in deck generation.
 */

export type CardCountFn = (card: Card) => NonnegativeInteger;


export const standardCardCountFn: CardCountFn = (card: Card): NonnegativeInteger => {
    switch (card) {
        case Card.dist25:
        case Card.dist50:
        case Card.dist75:
            return NonnegativeInteger.create(10);
        case Card.dist100:
            return NonnegativeInteger.create(12);
        case Card.dist200:
            return NonnegativeInteger.create(4);
        case Card.accident:
        case Card.outOfGas:
        case Card.flatTire:
            return NonnegativeInteger.create(3);
        case Card.speedLimit:
            return NonnegativeInteger.create(4);
        case Card.stop:
            return NonnegativeInteger.create(5);
        case Card.repairs:
        case Card.gasoline:
        case Card.spareTire:
            return NonnegativeInteger.create(6);
        case Card.endOfSpeedLimit:
            return NonnegativeInteger.create(6);
        case Card.roll:
            return NonnegativeInteger.create(14);
        case Card.drivingAce:
        case Card.extraTank:
        case Card.punctureProof:
        case Card.rightOfWay:
            return NonnegativeInteger.create(1);
        default:
            assertNever(card);
            return NonnegativeInteger.create(0);
    }
};


/**
 * A branded type representing an ordered Mille Bornes deck of cards.
 */
export type MilleBornesDeck = Brand<Array<Card>, "MilleBornesDeck">;


/**
 * A branded type representing a shuffled Mille Bornes deck of cards.
 */
export type MilleBornesShuffledDeck = Brand<Array<Card>, "MilleBornesShuffledDeck">;


/**
 * Creates a Mille Bornes deck with the specified card counts and multiplier.
 * The multiplier allows creating decks with multiple copies of the specified
 * card distribution.
 *
 * @param cardCountFn - A function that returns the count of each card type
 * @param multiplier - The number of times to multiply each card count
 * @return If successful, a successful Result containing the new
 * MilleBornesDeck.  Otherwise, a failed Result containing an error message.
 */
export function createDeck(
    cardCountFn: CardCountFn,
    multiplier = PositiveInteger.create(1)
): Result<MilleBornesDeck, string> {
    const deck: Array<Card> = [];

    for (const curCard of cardSchema.options) {
        const count = cardCountFn(curCard);
        for (let i = 0; i < count * multiplier; i++) {
            deck.push(curCard);
        }
    }

    return deck.length > 0 ? new SucceededResult(deck as MilleBornesDeck) : new FailedResult("Deck is empty");
}


/**
 * Shuffles a Mille Bornes deck into a random order.
 *
 * @param deck - The deck to shuffle
 * @return A new shuffled deck with cards in random order
 */
export function shuffleDeck(deck: MilleBornesDeck): MilleBornesShuffledDeck {
    const shuffled = _.shuffle(deck);
    return shuffled as MilleBornesShuffledDeck;
}


export type ShuffledDeckProvider = () => MilleBornesShuffledDeck;


export const standardShuffledDeckProvider: ShuffledDeckProvider = () => {
    const deck = createDeck(standardCardCountFn).throwIfFailed();
    const shuffled = shuffleDeck(deck);
    return shuffled;
};
