import {
    Card, cardSchema, describeCard, distanceCardSchema, distanceMiles, hazardCardSchema,
    remedyCardSchema, remedyFor, safetyCardSchema, safetyFor
} from "./card.mjs";


describe("card", () => {

    describe("cardSchema", () => {

        it("has 19 cards and the Card values", () => {
            expect(cardSchema.options.length).toBe(19);
            expect(cardSchema.options).toEqual(Object.values(Card));
        });

    });


    describe("category schemas", () => {

        it("partition the cards", () => {
            expect(distanceCardSchema.options).toEqual(["25", "50", "75", "100", "200"]);
            expect(hazardCardSchema.options).toEqual(
                ["Accident", "Out of Gas", "Flat Tire", "Speed Limit", "Stop"]
            );
            expect(remedyCardSchema.options).toEqual(
                ["Repairs", "Gasoline", "Spare Tire", "End of Speed Limit", "Roll"]
            );
            expect(safetyCardSchema.options).toEqual(
                ["Driving Ace", "Extra Tank", "Puncture Proof", "Right of Way"]
            );
        });

    });


    describe("distanceMiles()", () => {

        it("returns the miles for each distance card", () => {
            expect(distanceMiles(Card.dist25) as number).toBe(25);
            expect(distanceMiles(Card.dist50) as number).toBe(50);
            expect(distanceMiles(Card.dist75) as number).toBe(75);
            expect(distanceMiles(Card.dist100) as number).toBe(100);
            expect(distanceMiles(Card.dist200) as number).toBe(200);
        });

    });


    describe("remedyFor()", () => {

        it("returns the remedy for each hazard", () => {
            expect(remedyFor(Card.accident)).toBe(Card.repairs);
            expect(remedyFor(Card.outOfGas)).toBe(Card.gasoline);
            expect(remedyFor(Card.flatTire)).toBe(Card.spareTire);
            expect(remedyFor(Card.speedLimit)).toBe(Card.endOfSpeedLimit);
            expect(remedyFor(Card.stop)).toBe(Card.roll);
        });

    });


    describe("safetyFor()", () => {

        it("returns the safety for each hazard", () => {
            expect(safetyFor(Card.accident)).toBe(Card.drivingAce);
            expect(safetyFor(Card.outOfGas)).toBe(Card.extraTank);
            expect(safetyFor(Card.flatTire)).toBe(Card.punctureProof);
            expect(safetyFor(Card.speedLimit)).toBe(Card.rightOfWay);
            expect(safetyFor(Card.stop)).toBe(Card.rightOfWay);
        });

    });


    describe("describeCard()", () => {

        it("returns a non-empty sentence without 'undefined' for every card", () => {
            for (const card of cardSchema.options) {
                const text = describeCard(card);
                expect(text.length).toBeGreaterThan(0);
                expect(text).not.toContain("undefined");
            }
        });

    });

});
