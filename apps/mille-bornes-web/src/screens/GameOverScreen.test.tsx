import type { TeamIndex } from "@repo/mille-bornes-core/ids";
import { render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { describe, expect, it } from "vitest";
import { finishedGame, screenOf } from "../testing/finishedGames.mjs";
import { createFakeApi, failWire, neverSettles, type FakeApi } from "../testing/fakeApi.mjs";
import { describeTeamName } from "../text/teamName.mjs";
import { GameOverScreen } from "./GameOverScreen.js";
import type { PlayingData } from "./GameScreen.js";


const hostile = "<img src=x onerr=1>";
const long = "ABCDEFGHIJKLMNOPQRST";
const robot = "Sir Honks-a-Lot";


const game = finishedGame(2, { seed: 4, length: "Short", names: ["Ann", robot], robots: [robot] });


function show(data: PlayingData, fake: FakeApi = createFakeApi()) {
    return { ...render(<GameOverScreen screen={data} api={fake.api} />), fake };
}


function over(name = "Ann", g = game.gameOver): PlayingData {
    return screenOf(g, name);
}


function winnerOf(data: PlayingData): TeamIndex {
    if (data.view.phase.kind !== "GameOver") {
        throw new Error("Not a game over.");
    }
    return data.view.phase.winner;
}


function headline(): HTMLElement {
    return screen.getByRole("heading", { level: 2 });
}


function whoWasWho(): HTMLElement {
    return screen.getByRole("list", { name: "Who was who" });
}


describe("GameOverScreen", () => {

    describe("the winner", () => {

        it.each(["Ann", robot])("announces the winning team to %s", (name) => {
            const data = over(name);
            show(data);
            const winner = winnerOf(data);
            if (winner === data.view.me.team) {
                expect(headline()).toHaveTextContent("Your team wins!");
            }
            else {
                const name = describeTeamName(data.view, winner);
                expect(headline()).toHaveTextContent(`${name} wins!`);
                expect(headline()).not.toHaveTextContent("Your team");
            }
        });


        it("tells each team's players in their own terms", () => {
            const annWon = winnerOf(over("Ann")) === 0;
            const { unmount } = show(over("Ann"));
            expect(headline().textContent.startsWith("Your team")).toBe(annWon);
            unmount();
            show(over(robot));
            expect(headline().textContent.startsWith("Your team")).toBe(!annWon);
        });


        it("marks the winner in the final score sheet in text", () => {
            const data = over();
            show(data);
            const heads = screen.getAllByRole("columnheader").slice(1);
            expect(heads[winnerOf(data)]).toHaveTextContent("Winner");
            expect(screen.getAllByText("Winner")).toHaveLength(1);
        });


        it("shows the final score sheet for every team", () => {
            show(over());
            const region = screen.getByRole("region", { name: "Score sheet" });
            expect(region).toHaveAttribute("tabindex", "0");
            expect(within(region).getAllByRole("columnheader")).toHaveLength(3);
        });

    });


    describe("the reveal", () => {

        it("lists every seat with its kind", () => {
            show(over());
            const items = within(whoWasWho()).getAllByRole("listitem").map((li) => li.textContent);
            expect(items).toEqual(["Ann was... a human!", `${robot} was... a robot!`]);
        });


        it("lists every seat of a table of six", () => {
            const six = finishedGame(6, { seed: 1, length: "Quick", robots: ["Di", "Cy"] });
            show(over("Ann", six.gameOver));
            const items = within(whoWasWho()).getAllByRole("listitem").map((li) => li.textContent);
            expect(items).toHaveLength(6);
            expect(items.filter((t) => t.endsWith("a robot!"))).toHaveLength(2);
            expect(items.filter((t) => t.endsWith("a human!"))).toHaveLength(4);
            expect(items).toContain("Di was... a robot!");
            expect(items).toContain("Ann was... a human!");
        });


        it("is the same for every viewer", () => {
            const { unmount } = show(over("Ann"));
            const ann = whoWasWho().textContent;
            unmount();
            show(over(robot));
            expect(whoWasWho().textContent).toBe(ann);
        });


        it("renders HTML in a name as text, and truncates long names", () => {
            const odd = finishedGame(2, {
                seed: 4, length: "Short", names: [hostile, long], robots: [long],
            });
            const { container } = show(over(hostile, odd.gameOver));
            expect(container.querySelector("img")).toBeNull();
            const items = within(whoWasWho()).getAllByRole("listitem");
            expect(items[0]).toHaveTextContent(`${hostile} was... a human!`);
            expect(items[1]).toHaveTextContent(`${long} was... a robot!`);
            for (const li of items) {
                expect(li.querySelector(".truncate")).not.toBeNull();
            }
        });

    });


    describe("six seats with 20-character names", () => {

        const names = ["A", "B", "C", "D", "E", "F"].map((c) => c.repeat(20));
        const six = finishedGame(6, { seed: 1, length: "Quick", names, robots: [names[2]!] });


        it("truncates every name in the reveal and wraps them in the score sheet", () => {
            show(over(names[0], six.gameOver));
            const items = within(whoWasWho()).getAllByRole("listitem");
            expect(items).toHaveLength(6);
            for (const li of items) {
                expect(li.querySelector(".reveal-name")).toHaveClass("truncate");
            }
            const heads = screen.getAllByRole("columnheader").slice(1);
            expect(heads).toHaveLength(3);
            // The score sheet never cuts a name off: one line per player.
            for (const th of heads) {
                expect(th.querySelector(".truncate")).toBeNull();
                expect(th.querySelectorAll(".score-member")).toHaveLength(2);
            }
        });

    });


    describe("Back to lobby", () => {

        function leave(): HTMLElement {
            return screen.getByRole("button", { name: "Back to lobby" });
        }


        it("leaves the finished game once", async () => {
            const { fake } = show(over());
            await userEvent.setup().click(leave());
            expect(fake.procs.leaveGame).toHaveBeenCalledOnce();
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });


        it("sends one request for a double click", async () => {
            const { fake } = show(over());
            const button = leave();
            await act(async () => {
                button.click();
                button.click();
                await Promise.resolve();
            });
            expect(fake.procs.leaveGame).toHaveBeenCalledOnce();
        });


        it("ignores further clicks while the request is in flight", async () => {
            const fake = createFakeApi();
            fake.procs.leaveGame.mockReturnValueOnce(neverSettles());
            show(over(), fake);
            const user = userEvent.setup();
            await user.click(leave());
            await user.click(leave());
            expect(fake.procs.leaveGame).toHaveBeenCalledOnce();
        });


        it("shows a refusal inline and can be tried again", async () => {
            const fake = createFakeApi();
            fake.procs.leaveGame.mockResolvedValueOnce(failWire("You are not in a game."));
            show(over(), fake);
            const user = userEvent.setup();
            await user.click(leave());
            expect(await screen.findByRole("alert")).toHaveTextContent("You are not in a game.");
            await user.click(leave());
            await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
            expect(fake.procs.leaveGame).toHaveBeenCalledTimes(2);
        });

    });

});
