import { SomeOption } from "@repo/depot/option";
import { fireEvent, render, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createFakeAudio, createFakeEngine, createMemoryStorage } from "../testing/fakeAudio.mjs";
import { createAudioEngine, type AudioContextLike } from "./audioEngine.mjs";
import { SoundProvider } from "./SoundProvider.js";
import { useAudioEngine } from "./useSound.js";


const gestures: ReadonlyArray<readonly [string, () => void]> = [
    ["pointerup", () => void fireEvent.pointerUp(window)],
    ["touchend", () => void fireEvent.touchEnd(window)],
    ["click", () => void fireEvent.click(window)],
    ["keydown", () => void fireEvent.keyDown(window, { key: "a" })]
];


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


    it.each(gestures)("unlocks the engine on %s, however many times", (_type, gesture) => {
        const engine = createFakeEngine();
        render(<SoundProvider engine={engine}><p>app</p></SoundProvider>);
        expect(engine.unlocks).not.toHaveBeenCalled();
        gesture();
        expect(engine.unlocks).toHaveBeenCalledTimes(1);
        gesture();
        expect(engine.unlocks).toHaveBeenCalledTimes(2);
    });


    it("keeps listening for the session, even once the engine says it is unlocked", () => {
        const engine = createFakeEngine();
        Object.defineProperty(engine, "unlocked", { value: true });
        render(<SoundProvider engine={engine}><p>app</p></SoundProvider>);
        for (const [, gesture] of gestures) {
            gesture();
        }
        expect(engine.unlocks).toHaveBeenCalledTimes(gestures.length);
    });


    describe("with a context that suspends again, as after a phone lock", () => {

        function showWithAudio() {
            const audio = createFakeAudio("suspended");
            const engine = createAudioEngine({
                createContext: () => new SomeOption<AudioContextLike>(audio.context),
                storage:       createMemoryStorage()
            });
            const rendered = render(<SoundProvider engine={engine}><p>app</p></SoundProvider>);
            return { audio, engine, ...rendered };
        }


        it.each(gestures)("resumes it once on the next %s", async (_type, gesture) => {
            const { audio, engine } = showWithAudio();
            gesture();
            await Promise.resolve();
            expect(audio.resume).toHaveBeenCalledTimes(1);
            expect(engine.unlocked).toBe(true);

            // Running: a gesture does not touch the context.
            gesture();
            expect(audio.resume).toHaveBeenCalledTimes(1);

            // The phone locks and the context is suspended again.
            audio.setState("suspended");
            expect(engine.unlocked).toBe(false);
            gesture();
            await Promise.resolve();
            expect(audio.resume).toHaveBeenCalledTimes(2);
            expect(engine.unlocked).toBe(true);
            gesture();
            expect(audio.resume).toHaveBeenCalledTimes(2);
        });


        it("calls resume() synchronously inside the gesture", () => {
            const { audio } = showWithAudio();
            fireEvent.touchEnd(window);
            expect(audio.resume).toHaveBeenCalledTimes(1);
        });

    });


    it("removes all its listeners on unmount", () => {
        const engine = createFakeEngine();
        const { unmount } = render(<SoundProvider engine={engine}><p>app</p></SoundProvider>);
        unmount();
        for (const [, gesture] of gestures) {
            gesture();
        }
        expect(engine.unlocks).not.toHaveBeenCalled();
    });

});
