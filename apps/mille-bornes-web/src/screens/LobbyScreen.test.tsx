import { GameId } from "@repo/mille-bornes-core/ids";
import { type PlayerName } from "@repo/mille-bornes-core/playerName";
import type { PendingSummary } from "@repo/mille-bornes-core/pendingView";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createFakeApi, failWire, neverSettles } from "../testing/fakeApi.mjs";
import { LobbyScreen, type LobbyData } from "./LobbyScreen.js";


// Not validated on purpose: the client must cope with whatever arrives.
function name(raw: string): PlayerName {
    return raw as PlayerName;
}


function game(
    organizer: string,
    others:    ReadonlyArray<string> = [],
    options:   Partial<PendingSummary> = {}
): PendingSummary {
    return {
        id:            GameId.create(),
        length:        "Quick",
        organizerName: name(organizer),
        seatNames:     [name(organizer), ...others.map(name)],
        isFull:        false,
        ...options
    };
}


function lobby(games: ReadonlyArray<PendingSummary> = [], notice: string | null = null): LobbyData {
    return { kind: "Lobby", notice, games };
}


function setup(data: LobbyData = lobby()) {
    const fake = createFakeApi();
    const view = render(<LobbyScreen screen={data} api={fake.api} />);
    return { ...fake, ...view, user: userEvent.setup() };
}


describe("LobbyScreen", () => {

    it("has a heading and a Start a new game button", () => {
        setup();
        expect(screen.getByRole("heading", { name: "Lobby" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Start a new game" })).toBeEnabled();
    });


    describe("the player's name", () => {

        it("shows the name the server gives for this player", async () => {
            const { procs } = setup();
            expect(await screen.findByText("Ann")).toBeInTheDocument();
            expect(procs.me).toHaveBeenCalledTimes(1);
        });


        it("shows no Playing as line when the server's name is empty", async () => {
            const fake = createFakeApi();
            fake.procs.me.mockResolvedValue({ playerId: "p1", name: "" });
            const { container } = render(<LobbyScreen screen={lobby()} api={fake.api} />);
            await screen.findByRole("button", { name: "Change name" });
            await waitFor(() => expect(fake.procs.me).toHaveBeenCalled());
            expect(screen.queryByText(/playing as/iu)).not.toBeInTheDocument();
            expect(container.querySelector("strong")).toBeNull();
        });


        it("copes when the name cannot be fetched", async () => {
            const fake = createFakeApi();
            fake.procs.me.mockResolvedValue({ unexpected: true });
            render(<LobbyScreen screen={lobby()} api={fake.api} />);
            expect(await screen.findByRole("button", { name: "Change name" })).toBeInTheDocument();
            expect(screen.queryByText("Ann")).not.toBeInTheDocument();
        });


        it("renames through the server and then shows the new name", async () => {
            const { procs, user } = setup();
            await screen.findByText("Ann");
            procs.me.mockResolvedValue({ playerId: "p1", name: "Annie" });

            await user.click(screen.getByRole("button", { name: "Change name" }));
            const field = screen.getByLabelText("New name");
            await user.clear(field);
            await user.type(field, "Annie");
            await user.click(screen.getByRole("button", { name: "Save" }));

            expect(procs.rename).toHaveBeenCalledExactlyOnceWith({ name: "Annie" });
            expect(await screen.findByText("Annie")).toBeInTheDocument();
            expect(screen.queryByLabelText("New name")).not.toBeInTheDocument();
        });


        it("shows the server's refusal and keeps the form open", async () => {
            const { procs, user } = setup();
            await screen.findByText("Ann");
            procs.rename.mockResolvedValue(failWire("That name is taken."));

            await user.click(screen.getByRole("button", { name: "Change name" }));
            await user.clear(screen.getByLabelText("New name"));
            await user.type(screen.getByLabelText("New name"), "Bob");
            await user.click(screen.getByRole("button", { name: "Save" }));

            expect(await screen.findByRole("alert")).toHaveTextContent("That name is taken.");
            expect(screen.getByLabelText("New name")).toHaveValue("Bob");
        });


        it("asks for a name locally without calling the server", async () => {
            const { procs, user } = setup();
            await screen.findByText("Ann");
            await user.click(screen.getByRole("button", { name: "Change name" }));
            await user.clear(screen.getByLabelText("New name"));
            await user.click(screen.getByRole("button", { name: "Save" }));
            expect(screen.getByRole("alert")).toHaveTextContent("Please type a name");
            expect(procs.rename).not.toHaveBeenCalled();
        });


        it("closes the form without renaming on Cancel", async () => {
            const { procs, user } = setup();
            await screen.findByText("Ann");
            await user.click(screen.getByRole("button", { name: "Change name" }));
            await user.click(screen.getByRole("button", { name: "Cancel" }));
            expect(screen.queryByLabelText("New name")).not.toBeInTheDocument();
            expect(procs.rename).not.toHaveBeenCalled();
        });

    });


    describe("two taps in the same tick", () => {

        function twice(element: HTMLElement): void {
            // Both land before React has re-rendered the buttons as disabled.
            act(() => {
                element.click();
                element.click();
            });
        }


        it("start one game", () => {
            const { procs } = setup();
            procs.createGame.mockReturnValue(neverSettles());
            twice(screen.getByRole("button", { name: "Start a new game" }));
            expect(procs.createGame).toHaveBeenCalledTimes(1);
        });


        it("join once", () => {
            const { procs } = setup(lobby([game("Dad")]));
            procs.join.mockReturnValue(neverSettles());
            twice(screen.getByRole("button", { name: "Join Dad's game" }));
            expect(procs.join).toHaveBeenCalledTimes(1);
        });


        it("save a new name once", async () => {
            const { procs, user } = setup();
            await screen.findByText("Ann");
            procs.rename.mockReturnValue(neverSettles());
            await user.click(screen.getByRole("button", { name: "Change name" }));
            await user.type(screen.getByLabelText("New name"), "x");
            const form = screen.getByLabelText("New name").closest("form")!;
            act(() => {
                fireEvent.submit(form);
                fireEvent.submit(form);
            });
            expect(procs.rename).toHaveBeenCalledTimes(1);
        });

    });


    describe("the list of games", () => {

        it("shows an empty-state line when there are no games", () => {
            setup();
            expect(screen.getByText("No games yet. Start one!")).toBeInTheDocument();
        });


        it("shows the organizer, the seat names, the seats taken and the length", () => {
            setup(lobby([
                game("Dad", ["Bob", "Cy"], { length: "Short" }),
                game("Mom")
            ]));
            const dads = screen.getByRole("listitem", { name: "Dad's game" });
            expect(within(dads).getByText("Bob")).toBeInTheDocument();
            expect(within(dads).getByText("Cy")).toBeInTheDocument();
            expect(within(dads).getByText("3 of 6 seats")).toBeInTheDocument();
            expect(within(dads).getByText("Short")).toBeInTheDocument();

            const moms = screen.getByRole("listitem", { name: "Mom's game" });
            expect(within(moms).getByText("1 of 6 seats")).toBeInTheDocument();
            expect(within(moms).getByText("Quick")).toBeInTheDocument();
            expect(screen.queryByText("No games yet. Start one!")).not.toBeInTheDocument();
        });


        it("labels the three lengths Quick, Short and Full", () => {
            setup(lobby([
                game("A", [], { length: "Quick" }),
                game("B", [], { length: "Short" }),
                game("C", [], { length: "Full" })
            ]));
            expect(screen.getByText("Quick")).toBeInTheDocument();
            expect(screen.getByText("Short")).toBeInTheDocument();
            expect(screen.getByText("Full")).toBeInTheDocument();
        });


        it("disables Join and calls it Full for a full game", () => {
            setup(lobby([game("Dad", ["B", "C", "D", "E", "F"], { isFull: true })]));
            const dads = screen.getByRole("listitem", { name: "Dad's game" });
            expect(within(dads).getByRole("button", { name: "Full" })).toBeDisabled();
            expect(within(dads).queryByRole("button", { name: /join/iu })).not.toBeInTheDocument();
        });


        it("joins the game whose Join was tapped", async () => {
            const first = game("Dad");
            const second = game("Mom");
            const { procs, user } = setup(lobby([first, second]));
            await user.click(screen.getByRole("button", { name: "Join Mom's game" }));
            expect(procs.join).toHaveBeenCalledExactlyOnceWith({ gameId: second.id });
        });

    });


    describe("Start a new game", () => {

        it("creates a game", async () => {
            const { procs, user } = setup();
            await user.click(screen.getByRole("button", { name: "Start a new game" }));
            expect(procs.createGame).toHaveBeenCalledTimes(1);
        });

    });


    describe("refusals and requests in flight", () => {

        it("shows the server's message when a join is refused", async () => {
            const { procs, user } = setup(lobby([game("Dad")]));
            procs.join.mockResolvedValue(failWire("That game just filled up."));
            await user.click(screen.getByRole("button", { name: "Join Dad's game" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("That game just filled up.");
            expect(screen.getByRole("button", { name: "Join Dad's game" })).toBeEnabled();
        });


        it("shows the server's message when a new game is refused", async () => {
            const { procs, user } = setup();
            procs.createGame.mockResolvedValue(failWire("You are already in a game."));
            await user.click(screen.getByRole("button", { name: "Start a new game" }));
            expect(await screen.findByRole("alert"))
            .toHaveTextContent("You are already in a game.");
        });


        it("clears an old message when the next request starts", async () => {
            const { procs, user } = setup();
            procs.createGame.mockResolvedValueOnce(failWire("Try again later."));
            await user.click(screen.getByRole("button", { name: "Start a new game" }));
            await screen.findByRole("alert");
            await user.click(screen.getByRole("button", { name: "Start a new game" }));
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });


        it("disables every button of the games while one request is in flight", async () => {
            const { procs, user } = setup(lobby([game("Dad"), game("Mom")]));
            let finish: (wire: unknown) => void = () => undefined;
            procs.join.mockReturnValue(new Promise((resolve) => {
                finish = resolve;
            }));
            await user.click(screen.getByRole("button", { name: "Join Dad's game" }));
            expect(screen.getByRole("button", { name: "Join Dad's game" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Join Mom's game" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Start a new game" })).toBeDisabled();

            await user.click(screen.getByRole("button", { name: "Join Dad's game" }));
            expect(procs.join).toHaveBeenCalledTimes(1);

            finish(failWire("Full."));
            await screen.findByRole("alert");
            expect(screen.getByRole("button", { name: "Start a new game" })).toBeEnabled();
        });

    });


    describe("the notice", () => {

        it("shows it once in a status box and can be dismissed", async () => {
            const { user } = setup(lobby([], "The organizer ended the game."));
            expect(screen.getAllByText("The organizer ended the game.")).toHaveLength(1);
            expect(screen.getByRole("status")).toHaveTextContent("The organizer ended the game.");

            await user.click(screen.getByRole("button", { name: "Dismiss" }));
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
            expect(screen.queryByText("The organizer ended the game.")).not.toBeInTheDocument();
        });


        it("keeps the notice when the next Lobby screen carries none", () => {
            const { api, rerender } = setup(lobby([], "The organizer ended the game."));
            rerender(<LobbyScreen screen={lobby([game("Dad")], null)} api={api} />);
            expect(screen.getByRole("status")).toHaveTextContent("The organizer ended the game.");
        });


        it("shows a new notice again after a dismiss, even with the same text", async () => {
            const { api, rerender, user } = setup(lobby([], "The organizer ended the game."));
            await user.click(screen.getByRole("button", { name: "Dismiss" }));
            expect(screen.queryByRole("status")).not.toBeInTheDocument();

            rerender(
                <LobbyScreen screen={lobby([], "The organizer ended the game.")} api={api} />
            );
            expect(screen.getByRole("status")).toHaveTextContent("The organizer ended the game.");
        });


        it("keeps a dismissed notice hidden when the next screen carries none", async () => {
            const { api, rerender, user } = setup(lobby([], "The organizer ended the game."));
            await user.click(screen.getByRole("button", { name: "Dismiss" }));
            rerender(<LobbyScreen screen={lobby([game("Dad")], null)} api={api} />);
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
        });


        it("shows no status box without a notice", () => {
            setup();
            expect(screen.queryByRole("status")).not.toBeInTheDocument();
        });

    });


    describe("names from other people", () => {

        const hostile = "<img src=x onerror=alert(1)>";


        it("renders HTML in a name as text", () => {
            const { container } = setup(lobby([game(hostile, [hostile])]));
            expect(container.querySelector("img")).toBeNull();
            expect(screen.getAllByText(hostile).length).toBeGreaterThan(0);
        });


        it("renders HTML in a name from the server's me as text", async () => {
            const fake = createFakeApi();
            fake.procs.me.mockResolvedValue({ playerId: "p1", name: hostile });
            const { container } = render(<LobbyScreen screen={lobby()} api={fake.api} />);
            expect(await screen.findByText(hostile)).toBeInTheDocument();
            expect(container.querySelector("img")).toBeNull();
        });


        it("truncates a 20-character name instead of widening the row", () => {
            const long = "ABCDEFGHIJKLMNOPQRST";
            setup(lobby([game(long)]));
            const title = screen.getByRole("heading", { name: `${long}'s game` });
            expect(title).toHaveClass("truncate");
            expect(screen.getByText(long)).toHaveClass("truncate");
        });

    });

});
