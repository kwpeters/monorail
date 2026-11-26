import type { RaceResult } from "@repo/mille-bornes-core/game";
import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { describeRaceResult, raceWinner } from "../text/describeEvent.mjs";
import { finishedGame, screenOf } from "../testing/finishedGames.mjs";
import type { PlayingData } from "./GameScreen.js";
import { RaceSummary } from "./RaceSummary.js";


// A 2-seat Short game whose first race is a trip completed, and a 3-seat
// Quick game whose first race is a tie.
const two = finishedGame(2, { seed: 4, length: "Short" });
const three = finishedGame(3, { seed: 21, length: "Quick" });


function raceOver(
    game = two.raceOvers[0]!,
    name = "Ann",
    remainingMs: number | null = 20000
): PlayingData {
    return screenOf(game, name, {
        timer: remainingMs === null ? null : { kind: "NextRace", remainingMs },
    });
}


function resultOf(data: PlayingData): RaceResult {
    const { phase } = data.view;
    if (phase.kind !== "RaceOver") {
        throw new Error("Not a race over.");
    }
    return phase.result;
}


function show(data: PlayingData) {
    const rendered = render(<RaceSummary screen={data} />);
    return {
        ...rendered,
        again: (next: PlayingData): void => rendered.rerender(<RaceSummary screen={next} />),
    };
}


function tick(ms: number): void {
    act(() => {
        vi.advanceTimersByTime(ms);
    });
}


describe("RaceSummary", () => {

    beforeEach(() => {
        vi.useFakeTimers();
    });


    afterEach(() => {
        vi.useRealTimers();
    });


    it("shows the score sheet of the race", () => {
        show(raceOver());
        const region = screen.getByRole("region", { name: "Score sheet" });
        expect(within(region).getByRole("rowheader", { name: "Combined total" }))
        .toBeInTheDocument();
        expect(within(region).getAllByRole("columnheader")).toHaveLength(3);
    });


    it("says how the race ended, in the viewer's terms", () => {
        const data = raceOver();
        show(data);
        expect(screen.getByText(describeRaceResult(resultOf(data), data.view.me.team)))
        .toBeInTheDocument();
    });


    it("marks the team that won the race in text", () => {
        const data = raceOver();
        show(data);
        const winner = raceWinner(resultOf(data)).toNullable(null);
        expect(winner).not.toBeNull();
        const heads = screen.getAllByRole("columnheader").slice(1);
        expect(heads[winner!]).toHaveTextContent("Race winner");
        expect(screen.getAllByText("Race winner")).toHaveLength(1);
    });


    it("says a tie is a tie and marks no winner", () => {
        show(raceOver(three.raceOvers[0]));
        expect(screen.getByText("No team could play another card, and it is a tie.")).toBeInTheDocument();
        expect(screen.queryByText("Race winner")).not.toBeInTheDocument();
    });


    describe("the countdown to the next race", () => {

        function countdown(): HTMLElement {
            return screen.getByRole("timer");
        }


        it("starts from the timer's remaining time", () => {
            show(raceOver(two.raceOvers[0], "Ann", 17400));
            expect(countdown()).toHaveTextContent("Next race in 18 s");
        });


        it("counts down once a second and stops at 0, never negative", () => {
            show(raceOver(two.raceOvers[0], "Ann", 2500));
            expect(countdown()).toHaveTextContent("Next race in 3 s");
            tick(1000);
            expect(countdown()).toHaveTextContent("Next race in 2 s");
            tick(10000);
            expect(countdown()).toHaveTextContent("Next race in 0 s");
            expect(countdown().textContent).not.toContain("-");
            expect(vi.getTimerCount()).toBe(0);
        });


        it("starts again from a new screen's time", () => {
            const { again } = show(raceOver(two.raceOvers[0], "Ann", 20000));
            tick(5000);
            expect(countdown()).toHaveTextContent("Next race in 15 s");
            again(raceOver(two.raceOvers[0], "Ann", 8000));
            expect(countdown()).toHaveTextContent("Next race in 8 s");
        });


        it("is not a live region, so it is not announced every second", () => {
            show(raceOver());
            expect(countdown().closest("[aria-live]")).toBeNull();
        });


        it("is absent when the screen has no NextRace timer", () => {
            show(raceOver(two.raceOvers[0], "Ann", null));
            expect(screen.queryByRole("timer")).not.toBeInTheDocument();
            expect(screen.queryByText(/Next race/u)).not.toBeInTheDocument();
        });


        it("stops its clock when it goes away", () => {
            const { unmount } = show(raceOver());
            unmount();
            expect(vi.getTimerCount()).toBe(0);
        });

    });

});
