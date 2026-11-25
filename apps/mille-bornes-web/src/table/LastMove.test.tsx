import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { annPlays } from "../testing/engineBatches.mjs";
import { LastMove } from "./LastMove.js";


// The batches are what the real engine emits: the play, then the next turn
// and its draw.
describe("LastMove", () => {

    const drove = annPlays({ type: "Drive", card: "50" });
    const discarded = annPlays({ type: "Discard", card: "25" });
    const { view } = drove;


    it("starts with a neutral line in a polite status region", () => {
        render(<LastMove events={[]} view={view} />);
        expect(screen.getByRole("status")).toHaveTextContent("Good luck!");
    });


    it("shows the move, not the draw that ends the batch", () => {
        expect(drove.events.at(-1)?.type).toBe("CardDrawn");
        render(<LastMove events={drove.events} view={view} />);
        expect(screen.getByRole("status")).toHaveTextContent("You drove 50 miles.");
        expect(screen.getByRole("status")).not.toHaveTextContent(/drew/u);
    });


    it("shows the newest batch when a new one arrives", () => {
        const { rerender } = render(<LastMove events={drove.events} view={view} />);
        rerender(<LastMove events={discarded.events} view={view} />);
        expect(screen.getByRole("status")).toHaveTextContent("You discarded 25 miles.");
    });


    it("keeps the line across a re-render with no events", () => {
        const { rerender } = render(<LastMove events={drove.events} view={view} />);
        rerender(<LastMove events={[]} view={view} />);
        expect(screen.getByRole("status")).toHaveTextContent("You drove 50 miles.");
    });

});
