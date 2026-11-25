import { type Brand } from "@repo/depot/brand";
import { getRandom } from "@repo/depot/random";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { Card, cardSchema } from "./card.mjs";


/**
 * The kind of deck: the standard 106-card deck or a reduced 101-card deck.
 */
export type DeckKind = "Standard" | "Reduced";


const standardCounts: Readonly<Record<Card, number>> = {
    [Card.dist25]:          10,
    [Card.dist50]:          10,
    [Card.dist75]:          10,
    [Card.dist100]:         12,
    [Card.dist200]:         4,
    [Card.accident]:        3,
    [Card.outOfGas]:        3,
    [Card.flatTire]:        3,
    [Card.speedLimit]:      4,
    [Card.stop]:            5,
    [Card.repairs]:         6,
    [Card.gasoline]:        6,
    [Card.spareTire]:       6,
    [Card.endOfSpeedLimit]: 6,
    [Card.roll]:            14,
    [Card.drivingAce]:      1,
    [Card.extraTank]:       1,
    [Card.punctureProof]:   1,
    [Card.rightOfWay]:      1,
};


const reducedCounts: Readonly<Record<Card, number>> = {
    ...standardCounts,
    [Card.accident]:   2,
    [Card.outOfGas]:   2,
    [Card.flatTire]:   2,
    [Card.speedLimit]: 3,
    [Card.stop]:       4,
};


/**
 * Gets how many of each card a deck of the specified kind contains.
 * @param kind - The kind of deck
 * @returns The number of copies of each card
 */
export function cardCounts(kind: DeckKind): Readonly<Record<Card, number>> {
    return kind === "Standard" ? standardCounts : reducedCounts;
}


// 106 and 101.
const deckSizes: ReadonlyArray<number> = (["Standard", "Reduced"] as const)
.map((kind) => Object.values(cardCounts(kind)).reduce((sum, n) => sum + n, 0));


function countsMatch(cards: ReadonlyArray<Card>, kind: DeckKind): boolean {
    const expected = cardCounts(kind);
    const actual = new Map<Card, number>();
    for (const card of cards) {
        actual.set(card, (actual.get(card) ?? 0) + 1);
    }
    // Callers pass only valid Cards, so equal counts for every Card means the
    // same multiset.
    return cardSchema.options.every((card) => (actual.get(card) ?? 0) === expected[card]);
}


/**
 * A complete deck of cards in play order (index 0 is drawn first).  Always a
 * permutation of a Standard or Reduced deck.
 */
export type ShuffledDeck = Brand<ReadonlyArray<Card>, "ShuffledDeck">;


export namespace ShuffledDeck {

    /**
     * Validates a list of cards as a ShuffledDeck.
     * @param cards - The cards, in play order
     * @returns A successful result containing the ShuffledDeck or a failed
     * result containing an error message
     */
    export function tryCreate(cards: ReadonlyArray<Card>): Result<ShuffledDeck, string> {
        // The length first, so a huge or sparse array is never walked.
        if (!deckSizes.includes(cards.length)) {
            return new FailedResult(`A deck must have ${deckSizes.join(" or ")} cards, not ${cards.length}.`);
        }
        if (!cards.every((card) => cardSchema.safeParse(card).success)) {
            return new FailedResult("A deck may contain only valid cards.");
        }
        if (!countsMatch(cards, "Standard") && !countsMatch(cards, "Reduced")) {
            return new FailedResult("A deck must be a permutation of a Standard or Reduced deck.");
        }
        return new SucceededResult([...cards] as unknown as ShuffledDeck);
    }


    /**
     * Determines which kind of deck a ShuffledDeck is.
     * @param deck - The deck
     * @returns The kind of deck
     */
    export function kind(deck: ShuffledDeck): DeckKind {
        return countsMatch(deck, "Standard") ? "Standard" : "Reduced";
    }

}


function cardsInStandardOrder(kind: DeckKind): Card[] {
    const counts = cardCounts(kind);
    return cardSchema.options.flatMap((card) => Array.from({ length: counts[card] }, () => card));
}


/**
 * Creates an unshuffled deck in standard order.
 * @param kind - The kind of deck (default Standard)
 * @returns The deck
 */
export function createDeck(kind: DeckKind = "Standard"): ShuffledDeck {
    return cardsInStandardOrder(kind) as unknown as ShuffledDeck;
}


/**
 * Creates a shuffled deck (Fisher-Yates).
 * @param kind - The kind of deck (default Standard)
 * @param rand - Returns a number in [0, 1); injected for deterministic tests
 * @returns The shuffled deck
 */
export function shuffleDeck(kind: DeckKind = "Standard", rand: () => number = getRandom): ShuffledDeck {
    const cards = cardsInStandardOrder(kind);
    for (let i = cards.length - 1; i > 0; i--) {
        // An injected rand may return NaN, a negative number or 1 or more;
        // clamp the index so the result is always a permutation.
        const r = rand();
        const j = r >= 0 ? Math.min(i, Math.floor(r * (i + 1))) : 0;
        [cards[i], cards[j]] = [cards[j]!, cards[i]!];
    }
    return cards as unknown as ShuffledDeck;
}
