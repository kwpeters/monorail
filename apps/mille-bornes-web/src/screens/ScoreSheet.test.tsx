import { NoneOption, SomeOption, type Option } from "@repo/depot/option";
import type { Game, RaceResult } from "@repo/mille-bornes-core/game";
import type { TeamIndex } from "@repo/mille-bornes-core/ids";
import type { RaceScore } from "@repo/mille-bornes-core/scoring";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { finishedGame, screenOf } from "../testing/finishedGames.mjs";
import { team } from "../testing/viewFixtures.mjs";
import { ScoreSheet } from "./ScoreSheet.js";


const hostile = "<img src=x onerr=1>";
const long = "ABCDEFGHIJKLMNOPQRST";


// The rulebook's rows, in its order, and where each one's value is in a
// RaceScore.  Written out here, not imported, so a change to the order or to
// a label is a deliberate test change.
const rows: ReadonlyArray<readonly [string, (s: RaceScore) => number]> = [
    ["Brought forward", (s) => s.broughtForward],
    ["Miles", (s) => s.milestones],
    ["Safeties", (s) => s.safeties],
    ["Coup Fourrés", (s) => s.coupFourres],
    ["Trip completed", (s) => s.tripCompleted],
    ["Delayed action", (s) => s.delayedAction],
    ["Safe trip", (s) => s.safeTrip],
    ["Shutout", (s) => s.shutout],
    ["Extension", (s) => s.extension],
    ["Total for this race", (s) => s.totalForRace],
    ["Combined total", (s) => s.combinedTotal],
];


// Ann's 2-seat Short game: one RaceOver (a trip completed with an Extension
// call), then GameOver.
const two = finishedGame(2, { seed: 4, length: "Short" });

// A 3-seat Quick game: two tied races, then a
// trip completed.
const three = finishedGame(3, { seed: 585, length: "Quick" });


// A 2-seat game whose first race is a trip completed with Delayed Action.
const delayed = finishedGame(2, { seed: 3, length: "Short", random: true });

// A 2-seat game with a Safe Trip in its race and a Shutout in its last.
const bonus = finishedGame(2, { seed: 53, length: "Short" });

const fixtures: ReadonlyArray<Game> = [
    ...two.raceOvers, two.gameOver, ...three.raceOvers, three.gameOver,
    ...delayed.raceOvers, delayed.gameOver, ...bonus.raceOvers, bonus.gameOver,
];


function resultOf(game: Game): RaceResult {
    const { phase } = game;
    if (phase.kind !== "RaceOver" && phase.kind !== "GameOver") {
        throw new Error("Not a finished race.");
    }
    return phase.result;
}


function show(
    game: Game,
    name = "Ann",
    winner: Option<TeamIndex> = NoneOption.get()
) {
    const { view } = screenOf(game, name);
    const result = resultOf(game);
    return {
        result,
        view,
        ...render(
            <ScoreSheet
                view={view}
                result={result}
                winner={winner}
                winnerLabel="Winner"
                caption="Points for each team"
            />
        ),
    };
}


function cellsOf(label: string): string[] {
    const row = screen.getByRole("rowheader", { name: label }).closest("tr")!;
    return within(row).getAllByRole("cell").map((c) => c.textContent);
}


function format(n: number): string {
    return n.toLocaleString("en-US");
}


describe("ScoreSheet", () => {

    describe("the rows", () => {

        it.each([
            ["2 seats, a race", two.raceOvers[0]!],
            ["2 seats, the game", two.gameOver],
            ["3 seats, a tied race", three.raceOvers[0]!],
            ["3 seats, a second tied race", three.raceOvers[1]!],
            ["3 seats, the game", three.gameOver],
            ["2 seats, a race with Delayed Action", delayed.raceOvers[0]!],
            ["2 seats, a race with a Safe Trip", bonus.raceOvers[0]!],
            ["2 seats, a game with a Shutout", bonus.gameOver],
        ])("shows every row for every team, equal to the result (%s)", (_name, game) => {
            const { result } = show(game);
            expect(result.scores.length).toBeGreaterThanOrEqual(2);
            for (const [label, valueOf] of rows) {
                expect(cellsOf(label), label).toEqual(result.scores.map((s) => format(valueOf(s))));
            }
        });


        it("lists the rows in the rulebook's order", () => {
            show(two.raceOvers[0]!);
            const labels = screen.getAllByRole("rowheader").map((h) => h.textContent);
            expect(labels).toEqual(rows.map(([label]) => label));
        });


        it("is checked against a nonzero value in every row", () => {
            // A row that is 0 everywhere would pass even if it showed another
            // row's value.
            const scores = fixtures.flatMap((g) => resultOf(g).scores);
            for (const [label, valueOf] of rows) {
                expect(scores.some((s) => valueOf(s) > 0), label).toBe(true);
            }
        });


        it("shows a row that was not earned as 0", () => {
            const { result } = show(three.raceOvers[0]!);
            expect(result.scores.every((s) => s.tripCompleted === 0)).toBe(true);
            expect(cellsOf("Trip completed")).toEqual(result.scores.map(() => "0"));
        });


        it("shows thousands with a separator", () => {
            const { result } = show(three.gameOver);
            const combined = result.scores.map((s) => s.combinedTotal);
            expect(combined.some((n) => n >= 1000)).toBe(true);
            expect(cellsOf("Combined total")).toEqual(combined.map(format));
        });

    });


    describe("the table", () => {

        it("is a labeled, focusable, scrollable region", () => {
            show(two.raceOvers[0]!);
            const region = screen.getByRole("region", { name: "Score sheet" });
            expect(region).toHaveAttribute("tabindex", "0");
            expect(region).toHaveClass("score-scroll");
            expect(within(region).getByRole("table")).toBeInTheDocument();
        });


        it("has a caption, column headings for the teams and row headings for the rows", () => {
            const { result } = show(three.gameOver);
            const table = screen.getByRole("table", { name: "Points for each team" });
            expect(table.querySelector("caption")).toHaveClass("visually-hidden");
            const columns = within(table).getAllByRole("columnheader");
            // The corner heading plus one per team.
            expect(columns).toHaveLength(result.scores.length + 1);
            for (const th of table.querySelectorAll("thead th")) {
                expect(th).toHaveAttribute("scope", "col");
            }
            for (const th of table.querySelectorAll("tbody th")) {
                expect(th).toHaveAttribute("scope", "row");
            }
        });


        it("names the teams with their members", () => {
            show(two.raceOvers[0]!);
            expect(screen.getByRole("columnheader", { name: "Team 1 (you)" })).toBeInTheDocument();
            expect(screen.getByRole("columnheader", { name: "Team 2 (Bob)" })).toBeInTheDocument();
        });


        it("right-aligns the numbers", () => {
            show(two.raceOvers[0]!);
            for (const cell of screen.getAllByRole("cell")) {
                expect(cell).toHaveClass("num");
            }
        });


        it("sets the two totals apart as rows", () => {
            show(two.raceOvers[0]!);
            for (const label of ["Total for this race", "Combined total"]) {
                expect(screen.getByRole("rowheader", { name: label }).closest("tr"))
                .toHaveClass("total");
            }
            expect(screen.getByRole("rowheader", { name: "Miles" }).closest("tr"))
            .not.toHaveClass("total");
        });

    });


    describe("the winner", () => {

        it("is marked in text on the winner's column only", () => {
            show(two.raceOvers[0]!, "Ann", new SomeOption(team(1)));
            const heads = screen.getAllByRole("columnheader").slice(1);
            expect(heads[0]).not.toHaveTextContent("Winner");
            expect(heads[1]).toHaveTextContent("Winner");
            expect(screen.getAllByText("Winner")).toHaveLength(1);
        });


        it("is marked nowhere when there is none", () => {
            show(three.raceOvers[0]!);
            expect(screen.queryByText("Winner")).not.toBeInTheDocument();
        });

    });


    describe("names from other people", () => {

        it("renders HTML in a name as text", () => {
            const game = finishedGame(2, { seed: 4, length: "Short", names: ["Ann", hostile] });
            const { container } = show(game.gameOver);
            expect(container.querySelector("img")).toBeNull();
            expect(screen.getByText(`Team 2 (${hostile})`)).toBeInTheDocument();
        });


        it("truncates the names of a table of 20-character names", () => {
            const names = [long, "Bob"];
            const game = finishedGame(2, { seed: 4, length: "Short", names });
            show(game.gameOver, long);
            const name = screen.getByText("Team 1 (you)");
            expect(name).toHaveClass("truncate");
            const other = screen.getByText("Team 2 (Bob)");
            expect(other).toHaveClass("truncate");
        });


        it("truncates a long name in a team of two", () => {
            const names = ["Ann", long, "Bob", "Di"];
            const game = finishedGame(4, { seed: 1, length: "Short", names });
            show(game.gameOver, "Bob");
            const heading = screen.getByText("Team 2 (you + Di)");
            expect(heading).toHaveClass("truncate");
            expect(screen.getByText(`Team 1 (Ann + ${long})`)).toHaveClass("truncate");
        });

    });

});
