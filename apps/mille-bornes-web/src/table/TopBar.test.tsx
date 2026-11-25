import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TopBar } from "./TopBar.js";


function bar(text: string): HTMLElement {
    return screen.getByText(text).closest<HTMLElement>("[aria-live]")!;
}


describe("TopBar", () => {

    it("shows the text in a polite live region", () => {
        render(<TopBar text="Your turn" tone="MyTurn" />);
        expect(bar("Your turn")).toHaveAttribute("aria-live", "polite");
    });


    it("keeps the live region mounted when the text changes", () => {
        const { rerender } = render(<TopBar text="Your turn" tone="MyTurn" />);
        const region = bar("Your turn");
        rerender(<TopBar text="Waiting for Bob" tone="Waiting" />);
        expect(bar("Waiting for Bob")).toBe(region);
    });


    it("is green for MyTurn, red for Alert and blue for everything else", () => {
        const { rerender } = render(<TopBar text="x" tone="MyTurn" />);
        expect(bar("x")).toHaveClass("tone-green");
        rerender(<TopBar text="x" tone="Alert" />);
        expect(bar("x")).toHaveClass("tone-red");
        rerender(<TopBar text="x" tone="Waiting" />);
        expect(bar("x")).toHaveClass("tone-blue");
        rerender(<TopBar text="x" tone="Info" />);
        expect(bar("x")).toHaveClass("tone-blue");
    });


    it("renders HTML in the text as text", () => {
        const { container } = render(<TopBar text="<b>hi</b>" tone="Info" />);
        expect(container.querySelector("b")).toBeNull();
        expect(screen.getByText("<b>hi</b>")).toBeInTheDocument();
    });

});
