import { NoneOption, SomeOption } from "@repo/depot/option";
import { Card } from "@repo/mille-bornes-core/card";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Piles } from "./Piles.js";


describe("Piles", () => {

    describe("the draw pile", () => {

        it("shows the count and says it in its label", () => {
            render(<Piles drawPileCount={62} discardTop={NoneOption.get()} />);
            const pile = screen.getByRole("img", { name: "Draw pile, 62 cards" });
            expect(pile).toHaveTextContent("62");
            expect(pile).toHaveAttribute("data-anim-anchor", "draw-pile");
        });


        it("says one card in the singular", () => {
            render(<Piles drawPileCount={1} discardTop={NoneOption.get()} />);
            expect(screen.getByRole("img", { name: "Draw pile, 1 card" })).toBeInTheDocument();
        });

    });


    describe("the discard pile", () => {

        it("shows an empty state when nothing was discarded", () => {
            render(<Piles drawPileCount={10} discardTop={NoneOption.get()} />);
            const pile = screen.getByRole("group", { name: "Discard pile, empty" });
            expect(pile).toHaveTextContent("Discard");
            expect(pile).toHaveAttribute("data-anim-anchor", "discard-pile");
            expect(pile.querySelector("[data-card]")).toBeNull();
        });


        it("shows the top card face", () => {
            render(<Piles drawPileCount={10} discardTop={new SomeOption(Card.roll)} />);
            const pile = screen.getByRole("group", { name: "Discard pile" });
            expect(within(pile).getByText("Roll")).toBeInTheDocument();
            expect(pile.querySelector("[data-card]")).toHaveAttribute("data-card", "Roll");
        });

    });

});
