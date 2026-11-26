import { Card } from "@repo/mille-bornes-core/card";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CardView } from "./CardView.js";


describe("CardView", () => {

    it("carries the card value in data-card", () => {
        const { container } = render(<CardView card={Card.flatTire} />);
        expect(container.firstElementChild).toHaveAttribute("data-card", "Flat Tire");
    });


    it("shows an emoji (hidden from assistive tech) and the label of a hazard", () => {
        render(<CardView card={Card.flatTire} />);
        expect(screen.getByText("Flat Tire")).toBeInTheDocument();
        expect(screen.getByText("\u{1F4A8}")).toHaveAttribute("aria-hidden", "true");
    });


    it("shows the miles of a distance card big, with the full label for assistive tech", () => {
        render(<CardView card={Card.dist75} />);
        expect(screen.getByText("75 miles")).toHaveClass("visually-hidden");
        expect(screen.getByText("75")).toHaveClass("card-miles");
        expect(screen.getByText("75")).toHaveAttribute("aria-hidden", "true");
    });


    it("shows a short label on End of Speed Limit, keeping its full name for assistive tech", () => {
        render(<CardView card={Card.endOfSpeedLimit} />);
        expect(screen.getByText("End of Limit")).toHaveAttribute("aria-hidden", "true");
        expect(screen.getByText("End of Speed Limit")).toHaveClass("visually-hidden");
    });


    it("is made of spans only, so it can sit inside a button", () => {
        const { container } = render(<CardView card={Card.dist75} />);
        expect(container.firstElementChild!.tagName).toBe("SPAN");
        expect(container.querySelectorAll(":not(span)")).toHaveLength(0);
    });


    it("has a kind class so each kind can have its own color", () => {
        const { container } = render(<CardView card={Card.drivingAce} />);
        expect(container.firstElementChild).toHaveClass("kind-safety");
    });

});
