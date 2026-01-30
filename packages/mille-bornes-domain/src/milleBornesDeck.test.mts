import { NonnegativeInteger } from "@repo/depot/nonnegativeInteger";
import { PositiveInteger } from "@repo/depot/positiveInteger";
import { createDeck, shuffleDeck } from "./milleBornesDeck.mjs";
import { type CardCounts, standardCardCounts, MilleBornesCard } from "./milleBornesCard.mjs";


describe("createDeck()", () => {

    it("creates a deck with the correct number of cards when multiplier is 1", () => {
        const deck = createDeck(standardCardCounts, PositiveInteger.create(1)).throwIfFailed();

        expect(deck.length).toEqual(106);
        expect(deck.filter((card) => card === MilleBornesCard.dist25).length).toEqual(10);
        expect(deck.filter((card) => card === MilleBornesCard.roll).length).toEqual(14);
        expect(deck.filter((card) => card === MilleBornesCard.drivingAce).length).toEqual(1);
    });


    it("creates a deck with multiplied card counts when multiplier is greater than 1", () => {
        const cardCounts: CardCounts = {
            dist25:          NonnegativeInteger.create(2),
            dist50:          NonnegativeInteger.create(2),
            dist75:          NonnegativeInteger.create(2),
            dist100:         NonnegativeInteger.create(2),
            dist200:         NonnegativeInteger.create(2),
            accident:        NonnegativeInteger.create(1),
            outOfGas:        NonnegativeInteger.create(1),
            flatTire:        NonnegativeInteger.create(1),
            speedLimit:      NonnegativeInteger.create(1),
            stop:            NonnegativeInteger.create(1),
            repairs:         NonnegativeInteger.create(1),
            gasoline:        NonnegativeInteger.create(1),
            spareTire:       NonnegativeInteger.create(1),
            endOfSpeedLimit: NonnegativeInteger.create(1),
            roll:            NonnegativeInteger.create(2),
            drivingAce:      NonnegativeInteger.create(1),
            extraTank:       NonnegativeInteger.create(1),
            punctureProof:   NonnegativeInteger.create(1),
            rightOfWay:      NonnegativeInteger.create(1),
        };

        const deck = createDeck(cardCounts, PositiveInteger.create(3)).throwIfFailed();

        expect(deck.length).toEqual(75);
        expect(deck.filter((card) => card === MilleBornesCard.dist25).length).toEqual(6);
        expect(deck.filter((card) => card === MilleBornesCard.roll).length).toEqual(6);
        expect(deck.filter((card) => card === MilleBornesCard.drivingAce).length).toEqual(3);
    });


    it("returns a FailedResult when all card counts are zero", () => {
        const cardCounts: CardCounts = {
            dist25:          NonnegativeInteger.create(0),
            dist50:          NonnegativeInteger.create(0),
            dist75:          NonnegativeInteger.create(0),
            dist100:         NonnegativeInteger.create(0),
            dist200:         NonnegativeInteger.create(0),
            accident:        NonnegativeInteger.create(0),
            outOfGas:        NonnegativeInteger.create(0),
            flatTire:        NonnegativeInteger.create(0),
            speedLimit:      NonnegativeInteger.create(0),
            stop:            NonnegativeInteger.create(0),
            repairs:         NonnegativeInteger.create(0),
            gasoline:        NonnegativeInteger.create(0),
            spareTire:       NonnegativeInteger.create(0),
            endOfSpeedLimit: NonnegativeInteger.create(0),
            roll:            NonnegativeInteger.create(0),
            drivingAce:      NonnegativeInteger.create(0),
            extraTank:       NonnegativeInteger.create(0),
            punctureProof:   NonnegativeInteger.create(0),
            rightOfWay:      NonnegativeInteger.create(0),
        };

        const result = createDeck(cardCounts, PositiveInteger.create(1));
        expect(result.failed).toBeTruthy();
    });

});


describe("shuffleDeck()", () => {

    it("returns a shuffled deck with the same number of cards", () => {

        const unshuffledDeck = createDeck(standardCardCounts, PositiveInteger.create(1)).throwIfFailed();
        const shuffledDeck = shuffleDeck(unshuffledDeck);

        expect(shuffledDeck.length).toEqual(106);
        expect(shuffledDeck.length).toEqual(unshuffledDeck.length);
    });


    it("returns a shuffled deck containing the same cards as the original", () => {
        const cardCounts: CardCounts = {
            dist25:          NonnegativeInteger.create(5),
            dist50:          NonnegativeInteger.create(5),
            dist75:          NonnegativeInteger.create(5),
            dist100:         NonnegativeInteger.create(5),
            dist200:         NonnegativeInteger.create(5),
            accident:        NonnegativeInteger.create(2),
            outOfGas:        NonnegativeInteger.create(2),
            flatTire:        NonnegativeInteger.create(2),
            speedLimit:      NonnegativeInteger.create(2),
            stop:            NonnegativeInteger.create(2),
            repairs:         NonnegativeInteger.create(3),
            gasoline:        NonnegativeInteger.create(3),
            spareTire:       NonnegativeInteger.create(3),
            endOfSpeedLimit: NonnegativeInteger.create(3),
            roll:            NonnegativeInteger.create(7),
            drivingAce:      NonnegativeInteger.create(1),
            extraTank:       NonnegativeInteger.create(1),
            punctureProof:   NonnegativeInteger.create(1),
            rightOfWay:      NonnegativeInteger.create(1),
        };

        const deck = createDeck(cardCounts, PositiveInteger.create(1)).throwIfFailed();
        const shuffledDeck = shuffleDeck(deck);

        expect(shuffledDeck.filter((card) => card === MilleBornesCard.dist25).length).toEqual(5);
        expect(shuffledDeck.filter((card) => card === MilleBornesCard.roll).length).toEqual(7);
        expect(shuffledDeck.filter((card) => card === MilleBornesCard.drivingAce).length).toEqual(1);
    });

});
