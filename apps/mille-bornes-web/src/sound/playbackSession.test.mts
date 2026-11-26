import { describe, expect, it, vi } from "vitest";
import { createBrowserAudioEngine } from "./audioEngine.mjs";
import {
    silentWavDataUri, startPlaybackSession,
    type AudioElementLike, type AudioSessionLike, type PlaybackSessionEnv
} from "./playbackSession.mjs";


interface FakeAudio extends AudioElementLike {
    tag:        string;
    paused:     boolean;
    attributes: Array<[string, string]>;
}


function fakeEnv(withAudioSession: boolean, play: () => unknown = () => Promise.resolve()) {
    const elements: FakeAudio[] = [];
    const playSpy = vi.fn(function (this: FakeAudio) {
        this.paused = false;
        return play();
    });
    const navigator: { audioSession?: AudioSessionLike } = {};
    if (withAudioSession) {
        navigator.audioSession = { type: "auto" };
    }
    const createElement = vi.fn((tag: "audio"): FakeAudio => {
        const el: FakeAudio = {
            attributes:   [],
            tag,
            src:          "",
            loop:         false,
            playsInline:  false,
            preload:      "",
            paused:       true,
            setAttribute: (name, value) => {
                el.attributes.push([name, value]);
            },
            play:         playSpy
        };
        elements.push(el);
        return el;
    });
    const env: PlaybackSessionEnv = { navigator, document: { createElement } };
    return { env, navigator, createElement, elements, playSpy };
}


describe("startPlaybackSession", () => {

    it("sets the audio session type to playback, makes no element and reports done", () => {
        const { env, navigator, elements } = fakeEnv(true);
        expect(startPlaybackSession(env)).toBe(true);
        expect(navigator.audioSession!.type).toBe("playback");
        expect(elements).toHaveLength(0);
    });


    it("does not throw, and reports not done, when setting the type throws", () => {
        const { env, navigator } = fakeEnv(true);
        Object.defineProperty(navigator.audioSession, "type", {
            set: () => {
                throw new Error("nope");
            }
        });
        expect(startPlaybackSession(env)).toBe(false);
    });


    it("plays one looping silent element when there is no audio session", () => {
        const { env, elements, playSpy, createElement } = fakeEnv(false);
        expect(startPlaybackSession(env)).toBe(false);
        expect(createElement).toHaveBeenCalledOnce();
        expect(elements[0]).toMatchObject({
            tag:         "audio",
            src:         silentWavDataUri,
            loop:        true,
            playsInline: true,
            preload:     "auto"
        });
        expect(elements[0]!.attributes).toEqual([["playsinline", ""]]);
        expect(playSpy).toHaveBeenCalledOnce();
    });


    it("does nothing more while the element is playing, and never makes a second one", () => {
        const { env, elements, playSpy, createElement } = fakeEnv(false);
        startPlaybackSession(env);
        startPlaybackSession(env);
        startPlaybackSession(env);
        expect(createElement).toHaveBeenCalledOnce();
        expect(elements).toHaveLength(1);
        expect(playSpy).toHaveBeenCalledOnce();
    });


    it("plays a paused element again, once per call, without making another", () => {
        const { env, elements, playSpy, createElement } = fakeEnv(false);
        startPlaybackSession(env);
        // iOS paused it, or the first play() was refused.
        elements[0]!.paused = true;
        startPlaybackSession(env);
        expect(playSpy).toHaveBeenCalledTimes(2);
        elements[0]!.paused = true;
        startPlaybackSession(env);
        expect(playSpy).toHaveBeenCalledTimes(3);
        expect(createElement).toHaveBeenCalledOnce();
    });


    it("never throws when play() rejects or throws, and tries again next call", async () => {
        for (const play of [
            () => Promise.reject(new Error("blocked")),
            () => {
                throw new Error("sync");
            }
        ]) {
            const { env, elements, playSpy } = fakeEnv(false, play);
            expect(() => startPlaybackSession(env)).not.toThrow();
            await Promise.resolve();
            elements[0]!.paused = true;
            expect(() => startPlaybackSession(env)).not.toThrow();
            expect(playSpy).toHaveBeenCalledTimes(2);
        }
    });


    it("never throws when the element cannot be made", () => {
        const { env, createElement } = fakeEnv(false);
        createElement.mockImplementation(() => {
            throw new Error("no audio");
        });
        expect(() => startPlaybackSession(env)).not.toThrow();
    });

});


describe("silentWavDataUri", () => {

    it("decodes to a valid, silent WAV", () => {
        const prefix = "data:audio/wav;base64,";
        expect(silentWavDataUri.startsWith(prefix)).toBe(true);
        const binary = atob(silentWavDataUri.slice(prefix.length));
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
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

    it("tries to play the silent clip where audioSession is missing, on each unlock", () => {
        const play = vi.spyOn(HTMLMediaElement.prototype, "play");
        const engine = createBrowserAudioEngine();
        expect(() => engine.unlock()).not.toThrow();
        expect(play).toHaveBeenCalledOnce();
        play.mockRestore();
    });

});
