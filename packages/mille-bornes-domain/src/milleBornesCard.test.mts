import { getStandardCardCount, getStandardTotalCardCount, MilleBornesCard } from "./milleBornesCard.mjs";

describe("getStandardCardCount()", () => {

    it("returns the expected card count", () => {
        expect(getStandardCardCount(MilleBornesCard.dist25)).toEqual(10);
        expect(getStandardCardCount(MilleBornesCard.dist50)).toEqual(10);
        expect(getStandardCardCount(MilleBornesCard.dist75)).toEqual(10);
        expect(getStandardCardCount(MilleBornesCard.dist100)).toEqual(12);
        expect(getStandardCardCount(MilleBornesCard.dist200)).toEqual(4);
        expect(getStandardCardCount(MilleBornesCard.accident)).toEqual(3);
        expect(getStandardCardCount(MilleBornesCard.outOfGas)).toEqual(3);
        expect(getStandardCardCount(MilleBornesCard.flatTire)).toEqual(3);
        expect(getStandardCardCount(MilleBornesCard.speedLimit)).toEqual(4);
        expect(getStandardCardCount(MilleBornesCard.stop)).toEqual(5);
        expect(getStandardCardCount(MilleBornesCard.repairs)).toEqual(6);
        expect(getStandardCardCount(MilleBornesCard.gasoline)).toEqual(6);
        expect(getStandardCardCount(MilleBornesCard.spareTire)).toEqual(6);
        expect(getStandardCardCount(MilleBornesCard.endOfSpeedLimit)).toEqual(6);
        expect(getStandardCardCount(MilleBornesCard.roll)).toEqual(14);
        expect(getStandardCardCount(MilleBornesCard.drivingAce)).toEqual(1);
        expect(getStandardCardCount(MilleBornesCard.extraTank)).toEqual(1);
        expect(getStandardCardCount(MilleBornesCard.punctureProof)).toEqual(1);
        expect(getStandardCardCount(MilleBornesCard.rightOfWay)).toEqual(1);
    });

});


describe("getStandardTotalCardCount()", () => {

    it("returns the expected count", () => {
        expect(getStandardTotalCardCount()).toEqual(106);
    });

});
