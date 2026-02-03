import { NonnegativeInteger } from "@repo/depot/nonnegativeInteger";
import { PositiveInteger } from "@repo/depot/positiveInteger";
import { assertNever } from "@repo/depot/never";
import { MilleBornesCard, milleBornesCardSchema } from "@repo/mille-bornes-shared/milleBornesCard";
import { standardCardCountFn, createDeck, shuffleDeck } from "./milleBornesDeck.mjs";


describe("standardCardCountFn()", () => {

    it("returns the expected total number of cards", () => {
        const total = milleBornesCardSchema.options.reduce((acc, card) => acc + standardCardCountFn(card), 0);
        expect(total).toEqual(106);
    });

});


describe("createDeck()", () => {

    it("creates a deck with the correct number of cards when multiplier is 1", () => {
        const deck = createDeck(standardCardCountFn).throwIfFailed();

        expect(deck.length).toEqual(106);
        expect(deck.filter((card) => card === MilleBornesCard.dist25).length).toEqual(10);
        expect(deck.filter((card) => card === MilleBornesCard.roll).length).toEqual(14);
        expect(deck.filter((card) => card === MilleBornesCard.drivingAce).length).toEqual(1);
    });


    it("creates a deck with multiplied card counts when multiplier is greater than 1", () => {
        const cardCountFn = (card: MilleBornesCard) => {
            switch (card) {
                case MilleBornesCard.dist25:
                case MilleBornesCard.dist50:
                case MilleBornesCard.dist75:
                case MilleBornesCard.dist100:
                case MilleBornesCard.dist200:
                    return NonnegativeInteger.create(2);
                case MilleBornesCard.accident:
                case MilleBornesCard.outOfGas:
                case MilleBornesCard.flatTire:
                case MilleBornesCard.speedLimit:
                case MilleBornesCard.stop:
                case MilleBornesCard.repairs:
                case MilleBornesCard.gasoline:
                case MilleBornesCard.spareTire:
                case MilleBornesCard.endOfSpeedLimit:
                    return NonnegativeInteger.create(1);
                case MilleBornesCard.roll:
                    return NonnegativeInteger.create(2);
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
        const deck = createDeck(cardCountFn, PositiveInteger.create(3)).throwIfFailed();

        expect(deck.length).toEqual(75);
        expect(deck.filter((card) => card === MilleBornesCard.dist25).length).toEqual(6);
        expect(deck.filter((card) => card === MilleBornesCard.roll).length).toEqual(6);
        expect(deck.filter((card) => card === MilleBornesCard.drivingAce).length).toEqual(3);
    });


    it("returns a FailedResult when all card counts are zero", () => {
        const cardCountFn = (card: MilleBornesCard) => {
            switch (card) {
                case MilleBornesCard.dist25:
                case MilleBornesCard.dist50:
                case MilleBornesCard.dist75:
                case MilleBornesCard.dist100:
                case MilleBornesCard.dist200:
                case MilleBornesCard.accident:
                case MilleBornesCard.outOfGas:
                case MilleBornesCard.flatTire:
                case MilleBornesCard.speedLimit:
                case MilleBornesCard.stop:
                case MilleBornesCard.repairs:
                case MilleBornesCard.gasoline:
                case MilleBornesCard.spareTire:
                case MilleBornesCard.endOfSpeedLimit:
                case MilleBornesCard.roll:
                case MilleBornesCard.drivingAce:
                case MilleBornesCard.extraTank:
                case MilleBornesCard.punctureProof:
                case MilleBornesCard.rightOfWay:
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
        const cardCountFn = (card: MilleBornesCard) => {
            switch (card) {
                case MilleBornesCard.dist25:
                case MilleBornesCard.dist50:
                case MilleBornesCard.dist75:
                case MilleBornesCard.dist100:
                case MilleBornesCard.dist200:
                    return NonnegativeInteger.create(5);
                case MilleBornesCard.accident:
                case MilleBornesCard.outOfGas:
                case MilleBornesCard.flatTire:
                case MilleBornesCard.speedLimit:
                case MilleBornesCard.stop:
                    return NonnegativeInteger.create(2);
                case MilleBornesCard.repairs:
                case MilleBornesCard.gasoline:
                case MilleBornesCard.spareTire:
                case MilleBornesCard.endOfSpeedLimit:
                    return NonnegativeInteger.create(3);
                case MilleBornesCard.roll:
                    return NonnegativeInteger.create(7);
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

        const deck = createDeck(cardCountFn).throwIfFailed();
        const shuffledDeck = shuffleDeck(deck);

        expect(shuffledDeck.filter((card) => card === MilleBornesCard.dist25).length).toEqual(5);
        expect(shuffledDeck.filter((card) => card === MilleBornesCard.roll).length).toEqual(7);
        expect(shuffledDeck.filter((card) => card === MilleBornesCard.drivingAce).length).toEqual(1);
    });

});
