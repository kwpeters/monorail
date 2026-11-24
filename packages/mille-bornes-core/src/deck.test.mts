import { Card, cardSchema } from "./card.mjs";
import { cardCounts, createDeck, ShuffledDeck, shuffleDeck } from "./deck.mjs";
import { deckFor } from "./testHelpers.mjs";


/**
 * Creates a deterministic pseudo-random number generator (mulberry32).
 * @param seed - The seed
 * @returns A function returning numbers in [0, 1)
 */
function seededRand(seed: number): () => number {
    let a = seed;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}


function countOf(deck: ReadonlyArray<Card>, card: Card): number {
    return deck.filter((x) => x === card).length;
}


describe("deck", () => {

    describe("cardCounts()", () => {

        it("returns the standard counts", () => {
            const counts = cardCounts("Standard");
            expect(counts[Card.dist25]).toBe(10);
            expect(counts[Card.dist50]).toBe(10);
            expect(counts[Card.dist75]).toBe(10);
            expect(counts[Card.dist100]).toBe(12);
            expect(counts[Card.dist200]).toBe(4);
            expect(counts[Card.accident]).toBe(3);
            expect(counts[Card.outOfGas]).toBe(3);
            expect(counts[Card.flatTire]).toBe(3);
            expect(counts[Card.speedLimit]).toBe(4);
            expect(counts[Card.stop]).toBe(5);
            expect(counts[Card.repairs]).toBe(6);
            expect(counts[Card.gasoline]).toBe(6);
            expect(counts[Card.spareTire]).toBe(6);
            expect(counts[Card.endOfSpeedLimit]).toBe(6);
            expect(counts[Card.roll]).toBe(14);
            expect(counts[Card.drivingAce]).toBe(1);
            expect(counts[Card.extraTank]).toBe(1);
            expect(counts[Card.punctureProof]).toBe(1);
            expect(counts[Card.rightOfWay]).toBe(1);
        });


        it("returns the reduced counts", () => {
            const standard = cardCounts("Standard");
            const reduced = cardCounts("Reduced");
            const changed: Partial<Record<Card, number>> = {
                [Card.stop]:       4,
                [Card.accident]:   2,
                [Card.outOfGas]:   2,
                [Card.flatTire]:   2,
                [Card.speedLimit]: 3
            };
            for (const card of cardSchema.options) {
                expect(reduced[card]).toBe(changed[card] ?? standard[card]);
            }
        });

    });


    describe("createDeck()", () => {

        it("has 106 cards with the standard counts", () => {
            const deck = createDeck();
            expect(deck.length).toBe(106);
            for (const c of cardSchema.options) {
                expect(deck.filter((x) => x === c).length).toBe(cardCounts("Standard")[c]);
            }
        });


        it("creates a valid 101-card reduced deck", () => {
            const deck = createDeck("Reduced");
            expect(deck.length).toBe(101);
            expect(ShuffledDeck.kind(deck)).toBe("Reduced");
        });

    });


    describe("ShuffledDeck.tryCreate()", () => {

        it("rejects a deck missing a card", () => {
            expect(ShuffledDeck.tryCreate(createDeck().slice(1)).failed).toBeTrue();
        });


        it("accepts a permutation of either kind", () => {
            const standard = [...createDeck()].reverse();
            const reduced = [...createDeck("Reduced")].reverse();
            expect(ShuffledDeck.tryCreate(standard).succeeded).toBeTrue();
            expect(ShuffledDeck.tryCreate(reduced).succeeded).toBeTrue();
        });


        it("rejects a 106-card deck with one card swapped for another", () => {
            const cards = [...createDeck()];
            const idx = cards.indexOf(Card.roll);
            cards[idx] = Card.stop;
            expect(ShuffledDeck.tryCreate(cards).failed).toBeTrue();
        });


        it("rejects a 101-card deck with one extra Stop", () => {
            const cards = [...createDeck("Reduced"), Card.stop];
            expect(ShuffledDeck.tryCreate(cards).failed).toBeTrue();
        });

    });


    describe("ShuffledDeck.kind()", () => {

        it("reports the kind of the deck", () => {
            expect(ShuffledDeck.kind(createDeck("Standard"))).toBe("Standard");
            expect(ShuffledDeck.kind(createDeck("Reduced"))).toBe("Reduced");
        });

    });


    describe("shuffleDeck()", () => {

        it("returns a valid standard deck that differs from creation order", () => {
            const deck = shuffleDeck("Standard", seededRand(1));
            expect(ShuffledDeck.tryCreate(deck).succeeded).toBeTrue();
            expect(ShuffledDeck.kind(deck)).toBe("Standard");
            expect(deck).not.toEqual(createDeck());
        });


        it("is deterministic for the same seeded rand", () => {
            expect(shuffleDeck("Standard", seededRand(7))).toEqual(
                shuffleDeck("Standard", seededRand(7))
            );
        });


        it("returns a valid 101-card reduced deck", () => {
            const deck = shuffleDeck("Reduced", seededRand(3));
            expect(deck.length).toBe(101);
            expect(ShuffledDeck.kind(deck)).toBe("Reduced");
        });


        it("defaults to a standard deck with a default rand", () => {
            const deck = shuffleDeck();
            expect(ShuffledDeck.kind(deck)).toBe("Standard");
        });

    });


    describe("deckFor()", () => {

        it("places the hands, then the next draws, then the rest", () => {
            const hand0 = [Card.roll, Card.roll, Card.stop, Card.dist25, Card.dist25, Card.dist200];
            const hand1 = [Card.drivingAce, Card.roll, Card.gasoline, Card.dist50, Card.dist50, Card.dist75];
            const deck = deckFor([hand0, hand1], [Card.extraTank]);
            expect(deck.slice(0, 6)).toEqual(hand0);
            expect(deck.slice(6, 12)).toEqual(hand1);
            expect(deck[12]).toBe(Card.extraTank);
            expect(ShuffledDeck.tryCreate(deck).succeeded).toBeTrue();
            expect(deck.length).toBe(106);
            expect(countOf(deck, Card.roll)).toBe(14);
        });


        it("supports the reduced kind", () => {
            const deck = deckFor([[Card.stop]], [], "Reduced");
            expect(ShuffledDeck.kind(deck)).toBe("Reduced");
            expect(deck[0]).toBe(Card.stop);
        });


        it("throws if the requested cards exceed the kind's counts", () => {
            expect(() => deckFor([[Card.drivingAce, Card.drivingAce]])).toThrow();
            const fiveStops = [Card.stop, Card.stop, Card.stop, Card.stop, Card.stop];
            expect(() => deckFor([fiveStops], [], "Reduced")).toThrow();
        });

    });

});
