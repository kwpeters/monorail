import type { GameEvent } from "@repo/mille-bornes-core/events";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { idOf, team, viewForSeats } from "../testing/viewFixtures.mjs";
import { LastMove } from "./LastMove.js";


describe("LastMove", () => {

    const view = viewForSeats(2);
    const ann = idOf(view, "Ann");
    const bob = idOf(view, "Bob");
    const first: ReadonlyArray<GameEvent> = [
        { type: "DistancePlayed", player: bob, card: "50", team: team(1) },
    ];
    const second: ReadonlyArray<GameEvent> = [
        { type: "CardDrawn", player: ann, card: null },
        { type: "CardDiscarded", player: ann, card: "Stop" },
    ];


    it("starts with a neutral line in a polite status region", () => {
        render(<LastMove events={[]} view={view} />);
        expect(screen.getByRole("status")).toHaveTextContent("Good luck!");
    });


    it("shows the last line of the latest batch", () => {
        render(<LastMove events={second} view={view} />);
        expect(screen.getByRole("status")).toHaveTextContent("You discarded Stop.");
    });


    it("shows the newest batch when a new one arrives", () => {
        const { rerender } = render(<LastMove events={first} view={view} />);
        expect(screen.getByRole("status")).toHaveTextContent("Bob drove 50 miles.");
        rerender(<LastMove events={second} view={view} />);
        expect(screen.getByRole("status")).toHaveTextContent("You discarded Stop.");
    });


    it("keeps the line across a re-render with no events", () => {
        const { rerender } = render(<LastMove events={first} view={view} />);
        rerender(<LastMove events={[]} view={view} />);
        expect(screen.getByRole("status")).toHaveTextContent("Bob drove 50 miles.");
    });

});
