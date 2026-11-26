import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createAudioEngine, muteStorageKey, type AudioEngine } from "../sound/audioEngine.mjs";
import { createFakeEngine, createMemoryStorage } from "../testing/fakeAudio.mjs";
import { TableMenu } from "./TableMenu.js";


function show(
    onEndGame: Option<() => void> = NoneOption.get(),
    engine: AudioEngine = createFakeEngine()
) {
    const rendered = render(
        <>
            <TableMenu engine={engine} onEndGame={onEndGame} />
            <button type="button">Elsewhere</button>
        </>
    );
    return { ...rendered, engine, user: userEvent.setup() };
}


function menuButton(): HTMLElement {
    return screen.getByRole("button", { name: "Menu" });
}


function labels(): string[] {
    return screen.queryAllByRole("menuitem").map((i) => i.textContent);
}


describe("TableMenu", () => {

    describe("the button", () => {

        it("is named Menu, announces a menu popup, and starts collapsed", () => {
            show();
            const button = menuButton();
            expect(button).toHaveAttribute("type", "button");
            expect(button).toHaveAttribute("aria-haspopup", "menu");
            expect(button).toHaveAttribute("aria-expanded", "false");
            expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        });


        it("keeps its icon from screen readers", () => {
            show();
            expect(menuButton().querySelector("[aria-hidden='true']")).not.toBeNull();
        });


        it("opens the menu on a tap, leaving the focus on the button", async () => {
            const { user } = show();
            await user.click(menuButton());
            expect(menuButton()).toHaveAttribute("aria-expanded", "true");
            expect(screen.getByRole("menu", { name: "Menu" })).toBeInTheDocument();
            expect(menuButton()).toHaveFocus();
        });


        it("closes the menu on a second tap", async () => {
            const { user } = show();
            await user.click(menuButton());
            await user.click(menuButton());
            expect(screen.queryByRole("menu")).not.toBeInTheDocument();
            expect(menuButton()).toHaveAttribute("aria-expanded", "false");
        });


        it("opens on Enter and on Space, with the first item focused", async () => {
            for (const key of ["{Enter}", " "]) {
                const { user, unmount } = show();
                menuButton().focus();
                await user.keyboard(key);
                expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();
                unmount();
            }
        });


        it("opens on the Down arrow, with the first item focused", async () => {
            const { user } = show();
            menuButton().focus();
            await user.keyboard("{ArrowDown}");
            expect(screen.getByRole("menu")).toBeInTheDocument();
            expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();
        });

    });


    describe("the items", () => {

        it("offer Mute sounds alone to a player who is not the organizer", async () => {
            const { user } = show();
            await user.click(menuButton());
            expect(labels()).toHaveLength(1);
            expect(labels()[0]).toContain("Mute sounds");
        });


        it("add End game for the organizer", async () => {
            const { user } = show(new SomeOption(vi.fn()));
            await user.click(menuButton());
            expect(labels()).toHaveLength(2);
            expect(labels()[0]).toContain("Mute sounds");
            expect(labels()[1]).toBe("End game");
        });


        it("are not in the tab order, since the menu is one stop", async () => {
            const { user } = show(new SomeOption(vi.fn()));
            await user.click(menuButton());
            for (const item of screen.getAllByRole("menuitem")) {
                expect(item).toHaveAttribute("tabindex", "-1");
            }
        });


        it("take the arrow keys, Home and End, wrapping at both ends", async () => {
            const { user } = show(new SomeOption(vi.fn()));
            menuButton().focus();
            await user.keyboard("{Enter}");
            const [mute, end] = screen.getAllByRole("menuitem");
            await user.keyboard("{ArrowDown}");
            expect(end).toHaveFocus();
            await user.keyboard("{ArrowDown}");
            expect(mute).toHaveFocus();
            await user.keyboard("{ArrowUp}");
            expect(end).toHaveFocus();
            await user.keyboard("{Home}");
            expect(mute).toHaveFocus();
            await user.keyboard("{End}");
            expect(end).toHaveFocus();
        });


        it("take the focus from the button on the Down arrow once open", async () => {
            const { user } = show(new SomeOption(vi.fn()));
            await user.click(menuButton());
            await user.keyboard("{ArrowDown}");
            expect(screen.getAllByRole("menuitem")[0]).toHaveFocus();
        });

    });


    describe("Mute sounds", () => {

        it("flips to Unmute sounds in the open menu, mutes the engine, and persists", async () => {
            const storage = createMemoryStorage();
            const engine = createAudioEngine({
                createContext: () => NoneOption.get(),
                storage
            });
            const { user } = show(NoneOption.get(), engine);
            await user.click(menuButton());
            await user.click(screen.getByRole("menuitem", { name: "Mute sounds" }));
            expect(engine.muted).toBe(true);
            expect(storage.items.get(muteStorageKey)).toBe("true");
            expect(screen.getByRole("menuitem", { name: "Unmute sounds" })).toBeInTheDocument();
            expect(screen.getByRole("menu")).toBeInTheDocument();
            await user.click(screen.getByRole("menuitem", { name: "Unmute sounds" }));
            expect(engine.muted).toBe(false);
            expect(storage.items.get(muteStorageKey)).toBe("false");
            expect(screen.getByRole("menuitem", { name: "Mute sounds" })).toBeInTheDocument();
        });


        it("shows the engine's state when the menu opens again", async () => {
            const { user, engine } = show();
            await user.click(menuButton());
            await user.click(screen.getByRole("menuitem", { name: "Mute sounds" }));
            await user.click(menuButton());
            await user.click(menuButton());
            expect(engine.muted).toBe(true);
            expect(screen.getByRole("menuitem", { name: "Unmute sounds" })).toBeInTheDocument();
        });

    });


    describe("End game", () => {

        it("calls the action, closes the menu and gives the focus back to the button", async () => {
            const endGame = vi.fn();
            const { user } = show(new SomeOption(endGame));
            await user.click(menuButton());
            await user.click(screen.getByRole("menuitem", { name: "End game" }));
            expect(endGame).toHaveBeenCalledOnce();
            expect(screen.queryByRole("menu")).not.toBeInTheDocument();
            expect(menuButton()).toHaveFocus();
        });


        it("has the button focused when the action runs, so a dialog returns there", async () => {
            let focused: Element | null = null;
            const { user } = show(new SomeOption(() => {
                focused = document.activeElement;
            }));
            await user.click(menuButton());
            await user.click(screen.getByRole("menuitem", { name: "End game" }));
            expect(focused).toBe(menuButton());
        });

    });


    describe("closing", () => {

        it("happens on Escape, and the focus returns to the button", async () => {
            const { user } = show();
            menuButton().focus();
            await user.keyboard("{Enter}");
            await user.keyboard("{Escape}");
            expect(screen.queryByRole("menu")).not.toBeInTheDocument();
            expect(menuButton()).toHaveFocus();
            expect(menuButton()).toHaveAttribute("aria-expanded", "false");
        });


        it("happens on Escape pressed with the focus on the button", async () => {
            const { user } = show();
            await user.click(menuButton());
            await user.keyboard("{Escape}");
            expect(screen.queryByRole("menu")).not.toBeInTheDocument();
            expect(menuButton()).toHaveFocus();
        });


        it("happens on a tap outside", async () => {
            const { user } = show();
            await user.click(menuButton());
            await user.click(document.body);
            expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        });


        it("happens on a press outside with no click after it (iOS, on plain text)", () => {
            show();
            fireEvent.click(menuButton());
            fireEvent.pointerDown(document.body);
            expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        });


        it("does not happen on a press inside the menu", async () => {
            const { user } = show();
            await user.click(menuButton());
            fireEvent.pointerDown(screen.getByRole("menu"));
            expect(screen.getByRole("menu")).toBeInTheDocument();
        });


        it("happens when Tab moves the focus out of it, and leaves the focus there", async () => {
            const { user } = show();
            menuButton().focus();
            await user.keyboard("{Enter}");
            await user.tab();
            expect(screen.getByRole("button", { name: "Elsewhere" })).toHaveFocus();
            expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        });

    });

});
