import { act, render, screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createFakeApi, failWire, neverSettles, type FakeApi } from "../testing/fakeApi.mjs";
import { EndGameDialog } from "./EndGameDialog.js";


function show(fake: FakeApi = createFakeApi()) {
    return { ...render(<EndGameDialog api={fake.api} />), fake };
}


function dialog(): HTMLDialogElement {
    return document.querySelector("dialog")!;
}


function trigger(): HTMLElement {
    return screen.getByRole("button", { name: "End game" });
}


function confirm(): HTMLElement {
    return within(dialog()).getByRole("button", { name: "End game" });
}


describe("EndGameDialog", () => {

    it("shows an End game control and a closed dialog", () => {
        show();
        expect(trigger()).toBeInTheDocument();
        expect(dialog()).not.toHaveAttribute("open");
        const title = within(dialog()).getByRole("heading", { hidden: true });
        expect(title).toHaveTextContent("End the game for everyone?");
        expect(dialog()).toHaveAttribute("aria-labelledby", title.id);
    });


    it("opens the question without calling the server, Keep playing first", async () => {
        const { fake } = show();
        await userEvent.setup().click(trigger());
        expect(dialog()).toHaveAttribute("open");
        expect(within(dialog()).getByText("End the game for everyone?")).toBeInTheDocument();
        expect(within(dialog()).getByRole("button", { name: "Keep playing" })).toHaveFocus();
        expect(fake.procs.endGame).not.toHaveBeenCalled();
    });


    it("closes on Escape without ending, and returns focus to the control", async () => {
        const { fake } = show();
        const user = userEvent.setup();
        await user.click(trigger());
        await user.keyboard("{Escape}");
        expect(dialog()).not.toHaveAttribute("open");
        expect(trigger()).toHaveFocus();
        expect(fake.procs.endGame).not.toHaveBeenCalled();
    });


    it("closes on Keep playing without ending", async () => {
        const { fake } = show();
        const user = userEvent.setup();
        await user.click(trigger());
        await user.click(within(dialog()).getByRole("button", { name: "Keep playing" }));
        expect(dialog()).not.toHaveAttribute("open");
        expect(fake.procs.endGame).not.toHaveBeenCalled();
    });


    it("ends the game once on confirming, however fast it is tapped", async () => {
        const { fake } = show();
        await userEvent.setup().click(trigger());
        const button = confirm();
        await act(async () => {
            button.click();
            button.click();
            await Promise.resolve();
        });
        expect(dialog()).not.toHaveAttribute("open");
        expect(fake.procs.endGame).toHaveBeenCalledOnce();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });


    it("shows a refusal in the page after the dialog closed", async () => {
        const fake = createFakeApi();
        fake.procs.endGame.mockResolvedValueOnce(failWire("Only the organizer can end the game."));
        show(fake);
        const user = userEvent.setup();
        await user.click(trigger());
        await user.click(confirm());
        const alert = await screen.findByRole("alert");
        expect(alert).toHaveTextContent("Only the organizer can end the game.");
        expect(dialog()).not.toHaveAttribute("open");
        expect(dialog()).not.toContainElement(alert);
        await waitFor(() => expect(trigger()).toHaveFocus());
    });


    it("can be tried again after a refusal, and clears the old message", async () => {
        const fake = createFakeApi();
        fake.procs.endGame.mockResolvedValueOnce(failWire("Not now."));
        show(fake);
        const user = userEvent.setup();
        await user.click(trigger());
        await user.click(confirm());
        await screen.findByRole("alert");
        await user.click(trigger());
        await user.click(confirm());
        await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
        expect(fake.procs.endGame).toHaveBeenCalledTimes(2);
    });


    it("cannot be sent again while the request is in flight", async () => {
        const fake = createFakeApi();
        fake.procs.endGame.mockReturnValueOnce(neverSettles());
        show(fake);
        const user = userEvent.setup();
        await user.click(trigger());
        await user.click(confirm());
        expect(trigger()).toBeDisabled();
        expect(fake.procs.endGame).toHaveBeenCalledOnce();
    });

});
