import { Card } from "@repo/mille-bornes-core/card";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Hand } from "./Hand.js";


describe("Hand", () => {

    it("is labelled Your hand and anchored for animations", () => {
        render(<Hand cards={[Card.dist25]} />);
        const hand = screen.getByRole("region", { name: "Your hand" });
        expect(hand).toHaveAttribute("data-anim-anchor", "hand");
    });


    it("shows each card, in order, including duplicates", () => {
        const cards = [Card.dist25, Card.dist25, Card.roll, Card.accident, Card.drivingAce];
        render(<Hand cards={cards} />);
        const hand = screen.getByRole("region", { name: "Your hand" });
        expect(within(hand).getAllByRole("listitem")).toHaveLength(5);
        expect([...hand.querySelectorAll("[data-card]")].map((c) => c.getAttribute("data-card")))
        .toEqual(cards);
    });


    it("shows an empty hand without cards", () => {
        render(<Hand cards={[]} />);
        expect(document.querySelectorAll("[data-card]")).toHaveLength(0);
    });

});
