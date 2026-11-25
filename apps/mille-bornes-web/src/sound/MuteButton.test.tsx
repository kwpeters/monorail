import { SomeOption } from "@repo/depot/option";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createFakeAudio, createMemoryStorage } from "../testing/fakeAudio.mjs";
import { createAudioEngine, muteStorageKey, type AudioContextLike } from "./audioEngine.mjs";
import { MuteButton } from "./MuteButton.js";


function show(initial: Record<string, string> = {}) {
    const audio = createFakeAudio();
    const storage = createMemoryStorage(initial);
    const createContext = vi.fn(() => new SomeOption<AudioContextLike>(audio.context));
    const engine = createAudioEngine({ createContext, storage });
    return { ...render(<MuteButton engine={engine} />), engine, storage, createContext, audio };
}


describe("MuteButton", () => {

    it("offers to mute while sound is on, and to unmute once muted", async () => {
        const user = userEvent.setup();
        const { engine } = show();
        expect(screen.getByRole("button", { name: "Mute sounds" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Mute sounds" }));
        expect(engine.muted).toBe(true);
        expect(screen.getByRole("button", { name: "Unmute sounds" })).toBeInTheDocument();
        await user.click(screen.getByRole("button", { name: "Unmute sounds" }));
        expect(engine.muted).toBe(false);
        expect(screen.getByRole("button", { name: "Mute sounds" })).toBeInTheDocument();
    });


    it("has no aria-pressed, since its name already says what a press does", async () => {
        const user = userEvent.setup();
        show();
        const button = screen.getByRole("button");
        expect(button).not.toHaveAttribute("aria-pressed");
        await user.click(button);
        expect(button).not.toHaveAttribute("aria-pressed");
    });


    it("keeps the emoji from screen readers", () => {
        show();
        const icon = screen.getByRole("button").querySelector("[aria-hidden='true']")!;
        expect(icon.textContent).toBe("\u{1F50A}");
    });


    it("is a 44 pixel target", () => {
        show();
        expect(screen.getByRole("button")).toHaveClass("mute-button");
    });


    it("persists the choice, and starts muted when it was muted before", async () => {
        const user = userEvent.setup();
        const { storage, unmount } = show();
        await user.click(screen.getByRole("button"));
        expect(storage.items.get(muteStorageKey)).toBe("true");
        unmount();
        show({ [muteStorageKey]: "true" });
        expect(screen.getByRole("button", { name: "Unmute sounds" })).toBeInTheDocument();
    });


    it("is the first gesture: it unlocks the audio", async () => {
        const user = userEvent.setup();
        const { createContext, engine } = show();
        expect(createContext).not.toHaveBeenCalled();
        await user.click(screen.getByRole("button"));
        expect(createContext).toHaveBeenCalledOnce();
        expect(engine.unlocked).toBe(true);
    });


    it("works from the keyboard", async () => {
        const user = userEvent.setup();
        const { engine } = show();
        await user.tab();
        await user.keyboard("{Enter}");
        expect(engine.muted).toBe(true);
        await user.keyboard(" ");
        expect(engine.muted).toBe(false);
    });

});
