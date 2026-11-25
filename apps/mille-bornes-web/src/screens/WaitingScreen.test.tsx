import type { PendingView } from "@repo/mille-bornes-core/pendingView";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createFakeApi, failWire, neverSettles } from "../testing/fakeApi.mjs";
import {
    pendingViewForSeats,
    type FixtureSeat,
    type PendingOptions
} from "../testing/pendingFixtures.mjs";
import { WaitingScreen, type WaitingData } from "./WaitingScreen.js";


const hostile = "<img src=x onerror=alert(1)>";
const long = "ABCDEFGHIJKLMNOPQRST";
const robotIcon = "\u{1F916}";
const four: ReadonlyArray<FixtureSeat> = [
    { name: "Ann" },
    { name: "Bob" },
    { name: "Cy", kind: "Robot" },
    { name: "Di" }
];
const five: ReadonlyArray<FixtureSeat> = [
    { name: "Ann" },
    { name: "Bob" },
    { name: "Cy" },
    { name: "Di" },
    { name: "Ed" }
];


function waiting(pending: PendingView): WaitingData {
    return { kind: "Waiting", pending };
}


function setup(seats: ReadonlyArray<FixtureSeat> = four, options: PendingOptions = {}) {
    const { view, ids } = pendingViewForSeats(seats, options);
    const fake = createFakeApi();
    const rendered = render(<WaitingScreen screen={waiting(view)} api={fake.api} />);
    return { ...fake, ...rendered, view, ids, user: userEvent.setup() };
}


// The joiner of the seat list, whose data wrongly says every seat is a robot:
// the contract is `kind: null`, and the screen must not show a marker anyway.
function setupJoiner(seats: ReadonlyArray<FixtureSeat> = four) {
    const { view, ids } = pendingViewForSeats(seats, { viewer: 1 });
    const risky: PendingView = {
        ...view,
        seats: view.seats.map((s) => ({ ...s, kind: "Robot" as const }))
    };
    const fake = createFakeApi();
    const rendered = render(<WaitingScreen screen={waiting(risky)} api={fake.api} />);
    return { ...fake, ...rendered, view, ids, user: userEvent.setup() };
}


function twice(element: HTMLElement): void {
    // Both land before React has re-rendered the buttons as disabled.
    act(() => {
        element.click();
        element.click();
    });
}


describe("WaitingScreen", () => {

    describe("the organizer's screen", () => {

        it("shows the format line and the seats grouped into teams", () => {
            setup(four, { length: "Short" });
            expect(screen.getByText(/^(?:Quick|Short|Full):/u))
            .toHaveTextContent(/^Short:.*2,000 points/u);
            const team1 = screen.getByRole("region", { name: "Team 1" });
            const team2 = screen.getByRole("region", { name: "Team 2" });
            expect(within(team1).getByText("Ann")).toBeInTheDocument();
            expect(within(team1).getByText("Cy")).toBeInTheDocument();
            expect(within(team2).getByText("Bob")).toBeInTheDocument();
            expect(within(team2).getByText("Di")).toBeInTheDocument();
        });


        it("marks the player's own seat as you", () => {
            setup();
            expect(within(screen.getByRole("region", { name: "Team 1" })).getByText("(you)"))
            .toBeInTheDocument();
            expect(screen.getAllByText("(you)")).toHaveLength(1);
        });


        it("marks a robot with an icon and hidden text only when kind is Robot", () => {
            setup();
            const cy = screen.getByText("Cy").closest("li")!;
            expect(within(cy).getByText("Robot")).toHaveClass("visually-hidden");
            expect(screen.getAllByText("Robot")).toHaveLength(1);
            expect(screen.getAllByText(robotIcon)).toHaveLength(1);
        });


        it("marks nothing when the seat kinds are not known", () => {
            const { view } = pendingViewForSeats(four);
            const unknown = { ...view, seats: view.seats.map((s) => ({ ...s, kind: null })) };
            render(<WaitingScreen screen={waiting(unknown)} api={createFakeApi().api} />);
            expect(screen.queryByText("Robot")).not.toBeInTheDocument();
            expect(screen.queryByText(robotIcon)).not.toBeInTheDocument();
        });


        it("lists the seats as Players when the seat count has no teams", () => {
            setup(five);
            const players = screen.getByRole("region", { name: "Players" });
            expect(within(players).getAllByRole("listitem")).toHaveLength(5);
            expect(screen.queryByRole("region", { name: /^Team/u })).not.toBeInTheDocument();
        });


        it("has no Waiting for line and no Leave game button", () => {
            setup();
            expect(screen.queryByText(/waiting for/iu)).not.toBeInTheDocument();
            expect(screen.queryByRole("button", { name: "Leave game" })).not.toBeInTheDocument();
        });

    });


    describe("the game length", () => {

        it("shows three buttons with the current one pressed", () => {
            setup(four, { length: "Full" });
            expect(screen.getByRole("button", { name: "Full", pressed: true })).toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Quick", pressed: false }))
            .toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Short", pressed: false }))
            .toBeInTheDocument();
        });


        it("sets the length that was tapped", async () => {
            const { procs, user } = setup();
            await user.click(screen.getByRole("button", { name: "Short" }));
            expect(procs.setLength).toHaveBeenCalledExactlyOnceWith({ length: "Short" });
        });


        it("does not send the length that is already chosen", async () => {
            const { procs, user } = setup();
            await user.click(screen.getByRole("button", { name: "Quick" }));
            expect(procs.setLength).not.toHaveBeenCalled();
        });


        it("marks the selected length with a check mark, not only a color", () => {
            setup(four, { length: "Short" });
            const checked = (name: string): boolean => within(screen.getByRole("button", { name }))
            .queryByText("✓") !== null;
            expect(checked("Short")).toBe(true);
            expect(checked("Quick")).toBe(false);
            expect(checked("Full")).toBe(false);
            expect(screen.getByRole("button", { name: "Short", pressed: true }))
            .toBeInTheDocument();
        });


        it("words the format line for each length", () => {
            setup(four, { length: "Quick" });
            expect(screen.getByText(/^(?:Quick|Short|Full):/u))
            .toHaveTextContent(/^Quick:.*finish the trip/u);
        });


        it("words the Full format line", () => {
            setup(four, { length: "Full" });
            expect(screen.getByText(/^(?:Quick|Short|Full):/u))
            .toHaveTextContent(/^Full:.*5,000 points/u);
        });

    });


    describe("Start game", () => {

        it("is disabled with the reason visible when the game cannot start", () => {
            const { view } = setup([{ name: "Ann" }]);
            expect(view.start.ok).toBe(false);
            expect(screen.getByRole("button", { name: "Start game" })).toBeDisabled();
            const reason = view.start.ok ? "" : view.start.reason;
            expect(reason).not.toBe("");
            expect(screen.getByRole("status")).toHaveTextContent(reason);
        });


        it("is enabled when the game can start, with no reason shown", async () => {
            const { procs, user } = setup();
            const start = screen.getByRole("button", { name: "Start game" });
            expect(start).toBeEnabled();
            expect(screen.getByRole("status")).toBeEmptyDOMElement();
            await user.click(start);
            expect(procs.start).toHaveBeenCalledTimes(1);
        });


        it("sends one request for two taps in the same tick", () => {
            const { procs } = setup();
            procs.start.mockReturnValue(neverSettles());
            twice(screen.getByRole("button", { name: "Start game" }));
            expect(procs.start).toHaveBeenCalledTimes(1);
        });

    });


    describe("Add a robot", () => {

        it("adds a robot", async () => {
            const { procs, user } = setup();
            await user.click(screen.getByRole("button", { name: "Add a robot" }));
            expect(procs.addRobot).toHaveBeenCalledTimes(1);
        });


        it("sends one request for two taps in the same tick", () => {
            const { procs } = setup();
            procs.addRobot.mockReturnValue(neverSettles());
            twice(screen.getByRole("button", { name: "Add a robot" }));
            expect(procs.addRobot).toHaveBeenCalledTimes(1);
        });

    });


    describe("Remove", () => {

        it("is on every seat but the organizer's own", () => {
            setup();
            expect(screen.queryByRole("button", { name: "Remove Ann" })).not.toBeInTheDocument();
            expect(screen.getAllByRole("button", { name: /^Remove / })).toHaveLength(3);
        });


        it("removes the seat that was tapped", async () => {
            const { procs, user, ids } = setup();
            await user.click(screen.getByRole("button", { name: "Remove Cy" }));
            expect(procs.removeSeat).toHaveBeenCalledExactlyOnceWith({ seat: ids[2] });
        });


        it("sends one request for two taps in the same tick", () => {
            const { procs } = setup();
            procs.removeSeat.mockReturnValue(neverSettles());
            twice(screen.getByRole("button", { name: "Remove Bob" }));
            expect(procs.removeSeat).toHaveBeenCalledTimes(1);
        });

    });


    describe("Swap seats", () => {

        async function enter(user: ReturnType<typeof userEvent.setup>): Promise<void> {
            await user.click(screen.getByRole("button", { name: "Swap seats" }));
        }


        it("sends the two ids in tap order after two taps", async () => {
            const { procs, user, ids } = setup();
            await enter(user);
            await user.click(screen.getByRole("button", { name: "Swap Di" }));
            expect(screen.getByRole("button", { name: "Swap Di", pressed: true }))
            .toBeInTheDocument();
            expect(procs.swapSeats).not.toHaveBeenCalled();
            await user.click(screen.getByRole("button", { name: "Swap Bob" }));
            expect(procs.swapSeats).toHaveBeenCalledExactlyOnceWith({ a: ids[3], b: ids[1] });
            expect(screen.queryByRole("button", { name: "Swap Bob" })).not.toBeInTheDocument();
        });


        it("offers Swap on every seat and no Remove while swapping", async () => {
            const { user } = setup();
            await enter(user);
            expect(screen.getAllByRole("button", { name: /^Swap [A-Z]/u })).toHaveLength(4);
            expect(screen.queryByRole("button", { name: /^Remove / })).not.toBeInTheDocument();
        });


        it("cancels the first selection when the same seat is tapped again", async () => {
            const { procs, user } = setup();
            await enter(user);
            await user.click(screen.getByRole("button", { name: "Swap Bob" }));
            await user.click(screen.getByRole("button", { name: "Swap Bob" }));
            expect(screen.getByRole("button", { name: "Swap Bob", pressed: false }))
            .toBeInTheDocument();
            expect(procs.swapSeats).not.toHaveBeenCalled();
        });


        it("leaves swap mode on the Cancel button", async () => {
            const { procs, user } = setup();
            await enter(user);
            await user.click(screen.getByRole("button", { name: "Swap Bob" }));
            await user.click(screen.getByRole("button", { name: "Cancel swap" }));
            expect(screen.queryByRole("button", { name: "Swap Bob" })).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: "Remove Bob" })).toBeInTheDocument();
            expect(procs.swapSeats).not.toHaveBeenCalled();
        });


        it("leaves swap mode on Escape", async () => {
            const { procs, user } = setup();
            await enter(user);
            await user.keyboard("{Escape}");
            expect(screen.queryByRole("button", { name: "Swap Bob" })).not.toBeInTheDocument();
            expect(procs.swapSeats).not.toHaveBeenCalled();
        });


        it("shows a refusal and leaves swap mode", async () => {
            const { procs, user } = setup();
            procs.swapSeats.mockResolvedValue(failWire("Someone just left."));
            await enter(user);
            await user.click(screen.getByRole("button", { name: "Swap Di" }));
            await user.click(screen.getByRole("button", { name: "Swap Bob" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("Someone just left.");
            expect(screen.getByRole("button", { name: "Swap seats" })).toBeEnabled();
        });

    });


    describe("Cancel game", () => {

        function dialog(): HTMLDialogElement {
            return document.querySelector("dialog")!;
        }


        it("opens a confirmation dialog without calling the server", async () => {
            const { procs, user } = setup();
            expect(dialog()).not.toHaveAttribute("open");
            await user.click(screen.getByRole("button", { name: "Cancel game" }));
            expect(dialog()).toHaveAttribute("open");
            expect(procs.cancel).not.toHaveBeenCalled();
        });


        it("calls pending.cancel once when confirmed", async () => {
            const { procs, user } = setup();
            await user.click(screen.getByRole("button", { name: "Cancel game" }));
            await user.click(within(dialog()).getByRole("button", { name: "Cancel the game" }));
            expect(procs.cancel).toHaveBeenCalledTimes(1);
            expect(dialog()).not.toHaveAttribute("open");
        });


        it("closes on Escape without calling it and returns focus to the trigger", async () => {
            const { procs, user } = setup();
            const trigger = screen.getByRole("button", { name: "Cancel game" });
            await user.click(trigger);
            await user.keyboard("{Escape}");
            expect(dialog()).not.toHaveAttribute("open");
            expect(procs.cancel).not.toHaveBeenCalled();
            expect(trigger).toHaveFocus();
        });


        it("puts the first focus on Keep the game, not the destructive button", async () => {
            const { user } = setup();
            await user.click(screen.getByRole("button", { name: "Cancel game" }));
            expect(within(dialog()).getByRole("button", { name: "Keep the game" })).toHaveFocus();
        });


        it("returns focus to the trigger after a refused cancel", async () => {
            const { procs, user } = setup();
            procs.cancel.mockResolvedValue(failWire("Too late."));
            await user.click(screen.getByRole("button", { name: "Cancel game" }));
            await user.click(within(dialog()).getByRole("button", { name: "Cancel the game" }));
            await screen.findByRole("alert");
            expect(screen.getByRole("button", { name: "Cancel game" })).toHaveFocus();
        });


        it("closes only the dialog on Escape while swapping", async () => {
            const { user } = setup();
            await user.click(screen.getByRole("button", { name: "Swap seats" }));
            await user.click(screen.getByRole("button", { name: "Cancel game" }));
            await user.keyboard("{Escape}");
            expect(dialog()).not.toHaveAttribute("open");
            expect(screen.getByRole("button", { name: "Swap Bob" })).toBeInTheDocument();
        });


        it("closes on Keep the game without calling it", async () => {
            const { procs, user } = setup();
            await user.click(screen.getByRole("button", { name: "Cancel game" }));
            await user.click(within(dialog()).getByRole("button", { name: "Keep the game" }));
            expect(dialog()).not.toHaveAttribute("open");
            expect(procs.cancel).not.toHaveBeenCalled();
        });


        it("shows a refusal after the dialog closed", async () => {
            const { procs, user } = setup();
            procs.cancel.mockResolvedValue(failWire("Too late."));
            await user.click(screen.getByRole("button", { name: "Cancel game" }));
            await user.click(within(dialog()).getByRole("button", { name: "Cancel the game" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("Too late.");
            expect(screen.getByRole("button", { name: "Cancel game" })).toBeEnabled();
        });

    });


    describe("a refusal from the server", () => {

        it("shows the message inline and leaves the controls usable", async () => {
            const { procs, user } = setup();
            procs.addRobot.mockResolvedValue(failWire("The table is full."));
            await user.click(screen.getByRole("button", { name: "Add a robot" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("The table is full.");
            expect(screen.getByRole("button", { name: "Add a robot" })).toBeEnabled();
            expect(screen.getByRole("button", { name: "Start game" })).toBeEnabled();

            await user.click(screen.getByRole("button", { name: "Add a robot" }));
            expect(procs.addRobot).toHaveBeenCalledTimes(2);
        });


        it("clears the message when the next request starts", async () => {
            const { procs, user } = setup();
            procs.start.mockResolvedValueOnce(failWire("Not yet."));
            await user.click(screen.getByRole("button", { name: "Start game" }));
            await screen.findByRole("alert");
            await user.click(screen.getByRole("button", { name: "Start game" }));
            expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        });


        it("disables the buttons while a request is in flight", async () => {
            const { procs, user } = setup();
            procs.start.mockReturnValue(neverSettles());
            await user.click(screen.getByRole("button", { name: "Start game" }));
            expect(screen.getByRole("button", { name: "Add a robot" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "Remove Bob" })).toBeDisabled();
        });

    });


    describe("the joiner's screen", () => {

        it("says who the game waits for and shows the teams and the format", () => {
            setupJoiner();
            expect(screen.getByText(/waiting for/iu))
            .toHaveTextContent("Waiting for Ann to start the game...");
            expect(screen.getByText(/^(?:Quick|Short|Full):/u)).toHaveTextContent(/^Quick:/u);
            expect(within(screen.getByRole("region", { name: "Team 2" })).getByText("(you)"))
            .toBeInTheDocument();
        });


        it("renders no robot marker and no organizer controls", () => {
            setupJoiner();
            expect(screen.queryByText("Robot")).not.toBeInTheDocument();
            expect(screen.queryByText(robotIcon)).not.toBeInTheDocument();
            for (const name of [
                /start game/iu, /add a robot/iu, /^remove/iu, /^swap/iu, /cancel game/iu,
                /^quick$/iu, /^short$/iu, /^full$/iu
            ]) {
                expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
            }
            expect(document.querySelector("dialog")).toBeNull();
        });


        it("shows the reason as a hint when the seat count has no teams", () => {
            const { view } = setupJoiner(five);
            const reason = view.start.ok ? "" : view.start.reason;
            expect(reason).not.toBe("");
            expect(screen.getByRole("region", { name: "Players" })).toBeInTheDocument();
            expect(screen.getByText(reason)).toBeInTheDocument();
        });


        it("leaves the game", async () => {
            const { procs, user } = setupJoiner();
            await user.click(screen.getByRole("button", { name: "Leave game" }));
            expect(procs.leave).toHaveBeenCalledTimes(1);
        });


        it("sends one leave request for two taps in the same tick", () => {
            const { procs } = setupJoiner();
            procs.leave.mockReturnValue(neverSettles());
            twice(screen.getByRole("button", { name: "Leave game" }));
            expect(procs.leave).toHaveBeenCalledTimes(1);
        });


        it("shows a refusal and keeps Leave usable", async () => {
            const { procs, user } = setupJoiner();
            procs.leave.mockResolvedValue(failWire("Please try again."));
            await user.click(screen.getByRole("button", { name: "Leave game" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("Please try again.");
            expect(screen.getByRole("button", { name: "Leave game" })).toBeEnabled();
        });

    });


    describe("names from other people", () => {

        const six: ReadonlyArray<FixtureSeat> = [
            { name: long },
            { name: hostile },
            { name: "Cy" },
            { name: "Di" },
            { name: "Ed" },
            { name: "Flo", kind: "Robot" }
        ];


        it("renders HTML in a name as text", () => {
            const { container } = setup(six);
            expect(container.querySelector("img")).toBeNull();
            expect(screen.getByText(hostile)).toBeInTheDocument();
        });


        it("truncates every seat name of a table of six", () => {
            setup(six);
            expect(screen.getAllByRole("listitem")).toHaveLength(6);
            expect(screen.getByText(long)).toHaveClass("truncate");
            for (const name of [hostile, "Cy", "Di", "Ed", "Flo"]) {
                expect(screen.getByText(name)).toHaveClass("truncate");
            }
        });


        it("truncates the organizer's name in the joiner's waiting line", () => {
            const { view } = pendingViewForSeats(six, { viewer: 2 });
            render(<WaitingScreen screen={waiting(view)} api={createFakeApi().api} />);
            const line = screen.getByText(/waiting for/iu);
            expect(line.querySelector(".truncate")).toHaveTextContent(long);
        });

    });

});
