import { fireEvent, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createFakeEngine } from "../testing/fakeAudio.mjs";
import { SoundProvider } from "./SoundProvider.js";
import { useAudioEngine } from "./useSound.js";


describe("SoundProvider", () => {

    it("gives every screen the one engine it was made with", () => {
        const engine = createFakeEngine();
        const wrapper = ({ children }: { children: ReactNode }): ReactNode => (
            <SoundProvider engine={engine}>{children}</SoundProvider>
        );
        const { result, rerender } = renderHook(() => useAudioEngine(), { wrapper });
        expect(result.current).toBe(engine);
        rerender();
        expect(result.current).toBe(engine);
    });


    it("makes a browser engine when none is given, muted from nothing", () => {
        const { result } = renderHook(() => useAudioEngine(), { wrapper: SoundProvider });
        expect(result.current.muted).toBe(false);
        // jsdom has no AudioContext: unlocking is a harmless no-op.
        expect(() => result.current.unlock()).not.toThrow();
        expect(() => result.current.play("honk")).not.toThrow();
        expect(result.current.unlocked).toBe(false);
    });


    it("unlocks the engine on a tap or a key press, until it is unlocked", () => {
        const engine = createFakeEngine();
        render(<SoundProvider engine={engine}><p>app</p></SoundProvider>);
        expect(engine.unlocks).not.toHaveBeenCalled();
        fireEvent.pointerUp(window);
        expect(engine.unlocks).toHaveBeenCalledTimes(1);
        fireEvent.keyDown(window, { key: "a" });
        expect(engine.unlocks).toHaveBeenCalledTimes(2);
    });


    it("stops listening once the engine has unlocked", () => {
        const engine = createFakeEngine();
        Object.defineProperty(engine, "unlocked", { value: true });
        render(<SoundProvider engine={engine}><p>app</p></SoundProvider>);
        fireEvent.pointerUp(window);
        fireEvent.pointerUp(window);
        fireEvent.keyDown(window, { key: "a" });
        expect(engine.unlocks).toHaveBeenCalledTimes(1);
    });


    it("removes its listeners on unmount", () => {
        const engine = createFakeEngine();
        const { unmount } = render(<SoundProvider engine={engine}><p>app</p></SoundProvider>);
        unmount();
        fireEvent.pointerUp(window);
        expect(engine.unlocks).not.toHaveBeenCalled();
    });

});
