import { Card, cardSchema } from "@repo/mille-bornes-core/card";
import { createDeck } from "@repo/mille-bornes-core/deck";
import { describe, expect, it } from "vitest";
import { cardFace } from "./cardFace.mjs";


describe("cardFace", () => {

    const cards = [...new Set(createDeck("Standard"))];


    it("covers every card of the standard deck", () => {
        expect(cards).toHaveLength(cardSchema.options.length);
    });


    it("gives every card an emoji and a non-empty label", () => {
        for (const card of cards) {
            const face = cardFace(card);
            expect(face.emoji, card).not.toBe("");
            expect(face.label, card).not.toBe("");
        }
    });


    it("gives every card a different label", () => {
        const labels = cards.map((card) => cardFace(card).label);
        expect(new Set(labels).size).toBe(labels.length);
    });


    it("gives every card a blurb of one sentence ending in a period", () => {
        for (const card of cards) {
            expect(cardFace(card).blurb, card).toMatch(/^[^.!?]+\.$/u);
        }
    });


    it("uses the rulebook names", () => {
        expect(cardFace(Card.flatTire).label).toBe("Flat Tire");
        expect(cardFace(Card.endOfSpeedLimit).label).toBe("End of Speed Limit");
        expect(cardFace(Card.punctureProof).label).toBe("Puncture Proof");
        expect(cardFace(Card.dist50).label).toBe("50 miles");
    });


    it("classifies cards by kind", () => {
        expect(cardFace(Card.dist100).kind).toBe("Distance");
        expect(cardFace(Card.stop).kind).toBe("Hazard");
        expect(cardFace(Card.roll).kind).toBe("Remedy");
        expect(cardFace(Card.rightOfWay).kind).toBe("Safety");
    });


    it("says Speed Limit allows only 25- and 50-mile cards", () => {
        expect(cardFace(Card.speedLimit).blurb).toContain("only 25- and 50-mile cards");
    });


    it("says a remedy needs a Roll first unless the team has Right of Way", () => {
        for (const card of [Card.repairs, Card.gasoline, Card.spareTire]) {
            expect(cardFace(card).blurb, card).toContain("unless it has Right of Way");
        }
    });


    it("explains a hazard in the friendly way the help shows", () => {
        expect(cardFace(Card.flatTire).blurb).toBe(
            "Flat Tire stops the team you play it on until they play a Spare Tire."
        );
    });

});
