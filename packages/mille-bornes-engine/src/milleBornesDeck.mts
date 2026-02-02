import * as _ from "lodash-es";
import { PositiveInteger } from "@repo/depot/positiveInteger";
import { type Brand } from "@repo/depot/brand";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { NonnegativeInteger } from "@repo/depot/nonnegativeInteger";
import { assertNever } from "@repo/depot/never";
import { MilleBornesCard, schMilleBornesCard } from "@repo/mille-bornes-shared/milleBornesCard";


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
            return NonnegativeInteger.create(0);
    }
};


/**
 * A branded type representing an ordered Mille Bornes deck of cards.
 */
export type MilleBornesDeck = Brand<Array<MilleBornesCard>, "MilleBornesDeck">;


/**
 * A branded type representing a shuffled Mille Bornes deck of cards.
 */
export type MilleBornesShuffledDeck = Brand<Array<MilleBornesCard>, "MilleBornesShuffledDeck">;


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
    const deck: Array<MilleBornesCard> = [];

    for (const curCard of schMilleBornesCard.options) {
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
