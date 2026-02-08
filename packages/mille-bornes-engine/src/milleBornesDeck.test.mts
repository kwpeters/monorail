import { NonnegativeInteger } from "@repo/depot/nonnegativeInteger";
import { PositiveInteger } from "@repo/depot/positiveInteger";
import { assertNever } from "@repo/depot/never";
import { Card, cardSchema } from "@repo/mille-bornes-shared/card";
import { standardCardCountFn, createDeck, shuffleDeck } from "./milleBornesDeck.mjs";


describe("standardCardCountFn()", () => {

    it("returns the expected total number of cards", () => {
        const total = cardSchema.options.reduce((acc, card) => acc + standardCardCountFn(card), 0);
        expect(total).toEqual(106);
    });

});


describe("createDeck()", () => {

    it("creates a deck with the correct number of cards when multiplier is 1", () => {
        const deck = createDeck(standardCardCountFn).throwIfFailed();

        expect(deck.length).toEqual(106);
        expect(deck.filter((card) => card === Card.dist25).length).toEqual(10);
        expect(deck.filter((card) => card === Card.roll).length).toEqual(14);
        expect(deck.filter((card) => card === Card.drivingAce).length).toEqual(1);
    });


    it("creates a deck with multiplied card counts when multiplier is greater than 1", () => {
        const cardCountFn = (card: Card) => {
            switch (card) {
                case Card.dist25:
                case Card.dist50:
                case Card.dist75:
                case Card.dist100:
                case Card.dist200:
                    return NonnegativeInteger.create(2);
                case Card.accident:
                case Card.outOfGas:
                case Card.flatTire:
                case Card.speedLimit:
                case Card.stop:
                case Card.repairs:
                case Card.gasoline:
                case Card.spareTire:
                case Card.endOfSpeedLimit:
                    return NonnegativeInteger.create(1);
                case Card.roll:
                    return NonnegativeInteger.create(2);
                case Card.drivingAce:
                case Card.extraTank:
                case Card.punctureProof:
                case Card.rightOfWay:
                    return NonnegativeInteger.create(1);
                default:
                    assertNever(card);
                    break;
            }
        };
        const deck = createDeck(cardCountFn, PositiveInteger.create(3)).throwIfFailed();

        expect(deck.length).toEqual(75);
        expect(deck.filter((card) => card === Card.dist25).length).toEqual(6);
        expect(deck.filter((card) => card === Card.roll).length).toEqual(6);
        expect(deck.filter((card) => card === Card.drivingAce).length).toEqual(3);
    });


    it("returns a FailedResult when all card counts are zero", () => {
        const cardCountFn = (card: Card) => {
            switch (card) {
                case Card.dist25:
                case Card.dist50:
                case Card.dist75:
                case Card.dist100:
                case Card.dist200:
                case Card.accident:
                case Card.outOfGas:
                case Card.flatTire:
                case Card.speedLimit:
                case Card.stop:
                case Card.repairs:
                case Card.gasoline:
                case Card.spareTire:
                case Card.endOfSpeedLimit:
                case Card.roll:
                case Card.drivingAce:
                case Card.extraTank:
                case Card.punctureProof:
                case Card.rightOfWay:
                    return NonnegativeInteger.create(0);
                default:
                    assertNever(card);
                    break;
            }
        };

        const result = createDeck(cardCountFn);
        expect(result.failed).toBeTruthy();
    });

});


describe("shuffleDeck()", () => {

    it("returns a shuffled deck with the same number of cards", () => {

        const unshuffledDeck = createDeck(standardCardCountFn).throwIfFailed();
        const shuffledDeck = shuffleDeck(unshuffledDeck);

        expect(shuffledDeck.length).toEqual(106);
        expect(shuffledDeck.length).toEqual(unshuffledDeck.length);
    });


    it("returns a shuffled deck containing the same cards as the original", () => {
        const cardCountFn = (card: Card) => {
            switch (card) {
                case Card.dist25:
                case Card.dist50:
                case Card.dist75:
                case Card.dist100:
                case Card.dist200:
                    return NonnegativeInteger.create(5);
                case Card.accident:
                case Card.outOfGas:
                case Card.flatTire:
                case Card.speedLimit:
                case Card.stop:
                    return NonnegativeInteger.create(2);
                case Card.repairs:
                case Card.gasoline:
                case Card.spareTire:
                case Card.endOfSpeedLimit:
                    return NonnegativeInteger.create(3);
                case Card.roll:
                    return NonnegativeInteger.create(7);
                case Card.drivingAce:
                case Card.extraTank:
                case Card.punctureProof:
                case Card.rightOfWay:
                    return NonnegativeInteger.create(1);
                default:
                    assertNever(card);
                    break;
            }
        };

        const deck = createDeck(cardCountFn).throwIfFailed();
        const shuffledDeck = shuffleDeck(deck);

        expect(shuffledDeck.filter((card) => card === Card.dist25).length).toEqual(5);
        expect(shuffledDeck.filter((card) => card === Card.roll).length).toEqual(7);
        expect(shuffledDeck.filter((card) => card === Card.drivingAce).length).toEqual(1);
    });

});
