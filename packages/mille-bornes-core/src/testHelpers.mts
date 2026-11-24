import { type Card, cardSchema } from "./card.mjs";
import { cardCounts, type DeckKind, type ShuffledDeck } from "./deck.mjs";


/**
 * Test support: builds a deck with specific cards at the top.  Never import
 * this from production code.
 * @param hands - Card lists placed first, in order (hand 0 at index 0, ...)
 * @param nextDraws - Cards placed immediately after the hands
 * @param kind - The kind of deck (default Standard)
 * @returns A valid deck: the requested cards in order, then the remaining cards
 * of the kind in standard order
 * @throws If the requested cards exceed the kind's counts
 */
export function deckFor(
    hands: ReadonlyArray<ReadonlyArray<Card>>,
    nextDraws: ReadonlyArray<Card> = [],
    kind: DeckKind = "Standard"
): ShuffledDeck {
    const requested = [...hands.flat(), ...nextDraws];
    const remaining = { ...cardCounts(kind) };
    for (const card of requested) {
        if (--remaining[card] < 0) {
            throw new Error(`deckFor: too many "${card}" cards requested for a ${kind} deck.`);
        }
    }
    const rest = cardSchema.options.flatMap((card) => Array.from({ length: remaining[card] }, () => card));
    return [...requested, ...rest] as unknown as ShuffledDeck;
}
