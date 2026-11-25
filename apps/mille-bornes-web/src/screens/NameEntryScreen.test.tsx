import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createFakeApi, failWire, neverSettles, okWire } from "../testing/fakeApi.mjs";
import { NameEntryScreen } from "./NameEntryScreen.js";


function setup() {
    const fake = createFakeApi();
    const onSignedIn = vi.fn();
    render(<NameEntryScreen api={fake.api} onSignedIn={onSignedIn} />);
    return { ...fake, onSignedIn, user: userEvent.setup() };
}


describe("NameEntryScreen", () => {

    it("has one labeled name field that suggests a nickname and stops at 20 characters", () => {
        setup();
        const field = screen.getByLabelText("Your name");
        expect(field).toHaveAttribute("autocomplete", "nickname");
        expect(field).toHaveAttribute("maxlength", "20");
        expect(screen.getAllByRole("textbox")).toHaveLength(1);
    });


    describe("Join", () => {

        it("creates the session with the trimmed name", async () => {
            const { procs, user } = setup();
            await user.type(screen.getByLabelText("Your name"), "  Ann  ");
            await user.click(screen.getByRole("button", { name: "Join" }));
            expect(procs.create).toHaveBeenCalledExactlyOnceWith({ name: "Ann" });
        });


        it("also submits with the Enter key", async () => {
            const { procs, user } = setup();
            await user.type(screen.getByLabelText("Your name"), "Ann{Enter}");
            expect(procs.create).toHaveBeenCalledExactlyOnceWith({ name: "Ann" });
        });


        it("hands the credential to the app on success", async () => {
            const { procs, onSignedIn, user } = setup();
            procs.create.mockResolvedValue(okWire({ playerId: "p9", token: "t9", name: "Ann" }));
            await user.type(screen.getByLabelText("Your name"), "Ann");
            await user.click(screen.getByRole("button", { name: "Join" }));
            await waitFor(() => {
                expect(onSignedIn).toHaveBeenCalledExactlyOnceWith({ playerId: "p9", token: "t9" });
            });
        });


        it("asks for a name locally without calling the server", async () => {
            const { procs, onSignedIn, user } = setup();
            await user.type(screen.getByLabelText("Your name"), "   ");
            await user.click(screen.getByRole("button", { name: "Join" }));
            expect(screen.getByRole("alert"))
            .toHaveTextContent("Please type a name or tap Surprise me");
            expect(procs.create).not.toHaveBeenCalled();
            expect(onSignedIn).not.toHaveBeenCalled();
        });


        it("shows a refusal under the field and keeps what was typed", async () => {
            const { procs, onSignedIn, user } = setup();
            procs.create.mockResolvedValue(failWire("That name is taken."));
            await user.type(screen.getByLabelText("Your name"), "Ann");
            await user.click(screen.getByRole("button", { name: "Join" }));
            expect(await screen.findByRole("alert")).toHaveTextContent("That name is taken.");
            expect(screen.getByLabelText("Your name")).toHaveValue("Ann");
            expect(onSignedIn).not.toHaveBeenCalled();
        });


        it("does not accept a success value it cannot read", async () => {
            const { procs, onSignedIn, user } = setup();
            procs.create.mockResolvedValue(okWire({ playerId: "p9" }));
            await user.type(screen.getByLabelText("Your name"), "Ann");
            await user.click(screen.getByRole("button", { name: "Join" }));
            expect(await screen.findByRole("alert")).toBeInTheDocument();
            expect(onSignedIn).not.toHaveBeenCalled();
        });

    });


    describe("Surprise me", () => {

        it("creates the session with no name", async () => {
            const { procs, user } = setup();
            await user.click(screen.getByRole("button", { name: "Surprise me" }));
            expect(procs.create).toHaveBeenCalledExactlyOnceWith({ name: null });
        });


        it("works even when something was typed", async () => {
            const { procs, user } = setup();
            await user.type(screen.getByLabelText("Your name"), "Ann");
            await user.click(screen.getByRole("button", { name: "Surprise me" }));
            expect(procs.create).toHaveBeenCalledExactlyOnceWith({ name: null });
        });

    });


    describe("while a request is in flight", () => {

        it("sends one request when Enter is pressed twice quickly", async () => {
            const { procs, user } = setup();
            procs.create.mockReturnValue(neverSettles());
            await user.type(screen.getByLabelText("Your name"), "Ann{Enter}{Enter}");
            expect(procs.create).toHaveBeenCalledTimes(1);
        });


        it("sends one request when two submits arrive before React re-renders", async () => {
            const { procs, user } = setup();
            procs.create.mockReturnValue(neverSettles());
            await user.type(screen.getByLabelText("Your name"), "Ann");
            const form = screen.getByLabelText("Your name").closest("form")!;
            act(() => {
                fireEvent.submit(form);
                fireEvent.submit(form);
            });
            expect(procs.create).toHaveBeenCalledTimes(1);
        });


        it("disables both buttons, sends once, and enables them after a refusal", async () => {
            const { procs, user } = setup();
            let finish: (wire: unknown) => void = () => undefined;
            procs.create.mockReturnValue(new Promise((resolve) => {
                finish = resolve;
            }));
            await user.type(screen.getByLabelText("Your name"), "Ann");
            const join = screen.getByRole("button", { name: "Join" });
            const surprise = screen.getByRole("button", { name: "Surprise me" });
            await user.click(join);
            expect(join).toBeDisabled();
            expect(surprise).toBeDisabled();

            await user.click(join);
            await user.click(surprise);
            expect(procs.create).toHaveBeenCalledTimes(1);

            finish(failWire("That name is taken."));
            await screen.findByRole("alert");
            expect(join).toBeEnabled();
            expect(surprise).toBeEnabled();
        });

    });

});
