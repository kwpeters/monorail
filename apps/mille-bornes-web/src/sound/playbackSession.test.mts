import { describe, expect, it, vi } from "vitest";
import { createBrowserAudioEngine } from "./audioEngine.mjs";
import { silentWavDataUri, startPlaybackSession } from "./playbackSession.mjs";


function fakeEnv(withAudioSession: boolean, play: () => unknown = () => Promise.resolve()) {
    const elements: Array<Record<string, unknown>> = [];
    const playSpy = vi.fn(play);
    const navigator: { audioSession?: { type: string } } = {};
    if (withAudioSession) {
        navigator.audioSession = { type: "auto" };
    }
    const document = {
        createElement: vi.fn((tag: string) => {
            const el: Record<string, unknown> = { tag, play: playSpy, setAttribute: vi.fn() };
            elements.push(el);
            return el;
        })
    };
    return { env: { navigator, document } as never, navigator, document, elements, playSpy };
}


describe("startPlaybackSession", () => {

    it("sets the audio session type to playback and makes no element", () => {
        const { env, navigator, elements } = fakeEnv(true);
        startPlaybackSession(env);
        expect(navigator.audioSession!.type).toBe("playback");
        expect(elements).toHaveLength(0);
    });


    it("does not throw when setting the audio session type throws", () => {
        const { env, navigator } = fakeEnv(true);
        Object.defineProperty(navigator.audioSession, "type", {
            set: () => {
                throw new Error("nope");
            }
        });
        expect(() => startPlaybackSession(env)).not.toThrow();
    });


    it("plays one looping silent element when there is no audio session, once", () => {
        const { env, elements, playSpy, document } = fakeEnv(false);
        startPlaybackSession(env);
        startPlaybackSession(env);
        expect(document.createElement).toHaveBeenCalledOnce();
        expect(elements).toHaveLength(1);
        expect(elements[0]).toMatchObject({
            tag:         "audio",
            src:         silentWavDataUri,
            loop:        true,
            playsInline: true,
            preload:     "auto"
        });
        expect(playSpy).toHaveBeenCalledOnce();
    });


    it("never throws when play() rejects or throws", async () => {
        for (const play of [
            () => Promise.reject(new Error("blocked")),
            () => {
                throw new Error("sync");
            }
        ]) {
            const { env } = fakeEnv(false, play);
            expect(() => startPlaybackSession(env)).not.toThrow();
            await Promise.resolve();
        }
    });


    it("never throws when the element cannot be made", () => {
        const { env, document } = fakeEnv(false);
        document.createElement.mockImplementation(() => {
            throw new Error("no audio");
        });
        expect(() => startPlaybackSession(env)).not.toThrow();
    });

});


describe("silentWavDataUri", () => {

    it("decodes to a valid, silent WAV", () => {
        const prefix = "data:audio/wav;base64,";
        expect(silentWavDataUri.startsWith(prefix)).toBe(true);
        const bytes = Uint8Array.from(atob(silentWavDataUri.slice(prefix.length)), (c) => c.charCodeAt(0));
        const view = new DataView(bytes.buffer);
        const text = (at: number): string => String.fromCharCode(...bytes.slice(at, at + 4));
        expect(text(0)).toBe("RIFF");
        expect(view.getUint32(4, true)).toBe(bytes.length - 8);
        expect(text(8)).toBe("WAVE");
        expect(text(12)).toBe("fmt ");
        expect(view.getUint32(16, true)).toBe(16);
        expect(view.getUint16(20, true)).toBe(1);
        expect(view.getUint16(22, true)).toBe(1);
        const sampleRate = view.getUint32(24, true);
        expect(view.getUint32(28, true)).toBe(sampleRate);
        expect(view.getUint16(32, true)).toBe(1);
        expect(view.getUint16(34, true)).toBe(8);
        expect(text(36)).toBe("data");
        const dataLength = view.getUint32(40, true);
        expect(dataLength).toBe(bytes.length - 44);
        expect(dataLength / sampleRate).toBeCloseTo(0.1, 2);
        expect(bytes.slice(44).every((b) => b === 0x80)).toBe(true);
    });

});


describe("createBrowserAudioEngine", () => {

    it("unlocks without throwing where audioSession and Audio are missing", () => {
        const engine = createBrowserAudioEngine();
        expect(() => engine.unlock()).not.toThrow();
        expect(() => engine.unlock()).not.toThrow();
    });

});
