import { NoneOption, SomeOption } from "@repo/depot/option";
import { describe, expect, it, vi } from "vitest";
import { createFakeAudio, createMemoryStorage } from "../testing/fakeAudio.mjs";
import {
    createAudioEngine, maxSimultaneousSounds, muteStorageKey, type AudioContextLike
} from "./audioEngine.mjs";
import { soundPack } from "./soundPack.mjs";


function engineWith(audio = createFakeAudio(), initial: Record<string, string> = {}) {
    const storage = createMemoryStorage(initial);
    const createContext = vi.fn(() => new SomeOption<AudioContextLike>(audio.context));
    const engine = createAudioEngine({ createContext, storage });
    return { engine, audio, storage, createContext };
}


describe("createAudioEngine", () => {

    describe("unlock", () => {

        it("makes no context until it is called, and only one however often", () => {
            const { engine, createContext } = engineWith();
            expect(createContext).not.toHaveBeenCalled();
            expect(engine.unlocked).toBe(false);
            engine.unlock();
            engine.unlock();
            expect(createContext).toHaveBeenCalledOnce();
            expect(engine.unlocked).toBe(true);
        });


        it("resumes a suspended context and plays once it is running", async () => {
            const { engine, audio } = engineWith(createFakeAudio("suspended"));
            engine.unlock();
            expect(audio.resume).toHaveBeenCalledOnce();
            expect(engine.unlocked).toBe(false);
            engine.play("drive");
            expect(audio.oscillators).toHaveLength(0);
            await Promise.resolve();
            expect(engine.unlocked).toBe(true);
            engine.play("drive");
            expect(audio.oscillators.length).toBeGreaterThan(0);
        });


        it("never throws when there is no context", () => {
            const engine = createAudioEngine({
                createContext: () => NoneOption.get(),
                storage:       createMemoryStorage()
            });
            expect(() => engine.unlock()).not.toThrow();
            expect(() => engine.play("honk")).not.toThrow();
            expect(engine.unlocked).toBe(false);
        });


        it("never throws when making the context throws", () => {
            const createContext = vi.fn((): never => {
                throw new Error("no AudioContext");
            });
            const engine = createAudioEngine({ createContext, storage: createMemoryStorage() });
            expect(() => engine.unlock()).not.toThrow();
            expect(() => engine.play("honk")).not.toThrow();
            expect(engine.unlocked).toBe(false);
        });


        it("never throws when resume() rejects or throws, and play stays a no-op", async () => {
            for (const resume of [
                () => Promise.reject(new Error("blocked")),
                (): Promise<void> => {
                    throw new Error("sync");
                }
            ]) {
                const audio = createFakeAudio("suspended", resume);
                const { engine } = engineWith(audio);
                expect(() => engine.unlock()).not.toThrow();
                await Promise.resolve();
                expect(() => engine.play("drive")).not.toThrow();
                expect(audio.oscillators).toHaveLength(0);
                expect(engine.unlocked).toBe(false);
            }
        });


        it("prepares the session once, before the context is made", () => {
            const order: string[] = [];
            const prepareSession = vi.fn(() => {
                order.push("prepare");
            });
            const createContext = vi.fn(() => {
                order.push("context");
                return new SomeOption<AudioContextLike>(createFakeAudio().context);
            });
            const engine = createAudioEngine({
                createContext,
                storage: createMemoryStorage(),
                prepareSession
            });
            expect(prepareSession).not.toHaveBeenCalled();
            for (let i = 0; i < 5; i++) {
                engine.unlock();
            }
            expect(prepareSession).toHaveBeenCalledOnce();
            expect(order).toEqual(["prepare", "context"]);
        });


        it("still makes and resumes the context when preparing the session throws", () => {
            const audio = createFakeAudio("suspended");
            const prepareSession = vi.fn((): void => {
                throw new Error("no session");
            });
            const engine = createAudioEngine({
                createContext: () => new SomeOption<AudioContextLike>(audio.context),
                storage:       createMemoryStorage(),
                prepareSession
            });
            expect(() => engine.unlock()).not.toThrow();
            expect(() => engine.unlock()).not.toThrow();
            expect(audio.resume).toHaveBeenCalled();
            // Not retried on later taps.
            expect(prepareSession).toHaveBeenCalledOnce();
        });


        it("tries again on the next gesture after a failed resume", async () => {
            let allow = false;
            const audio = createFakeAudio("suspended", () => {
                if (!allow) {
                    return Promise.reject(new Error("blocked"));
                }
                audio.setState("running");
                return Promise.resolve();
            });
            const { engine } = engineWith(audio);
            engine.unlock();
            await Promise.resolve();
            allow = true;
            engine.unlock();
            await Promise.resolve();
            engine.play("drive");
            expect(audio.oscillators.length).toBeGreaterThan(0);
        });

    });


    describe("play", () => {

        it("does nothing before unlock", () => {
            const { engine, audio, createContext } = engineWith();
            engine.play("drive");
            expect(audio.oscillators).toHaveLength(0);
            expect(createContext).not.toHaveBeenCalled();
        });


        it("schedules one oscillator per tone, with the tone's wave, pitch and timing", () => {
            const { engine, audio } = engineWith();
            engine.unlock();
            engine.play("hazard");
            const tones = soundPack.hazard;
            expect(audio.oscillators).toHaveLength(tones.length);
            tones.forEach((t, i) => {
                const osc = audio.oscillators[i]!;
                expect(osc.type).toBe(t.wave);
                expect(osc.hz).toEqual([t.hz]);
                expect(osc.slides).toEqual(t.slideToHz === undefined ? [] : [t.slideToHz]);
                // The fake clock reads 10 s.
                expect(osc.startedAt).toEqual([10 + t.delayMs / 1000]);
                expect(osc.stoppedAt[0]).toBeGreaterThan(10 + (t.delayMs + t.ms) / 1000 - 0.001);
                expect(osc.connected).toBe(true);
            });
        });


        it("schedules every sound of the pack", () => {
            const { engine, audio } = engineWith();
            engine.unlock();
            for (const [name, tones] of Object.entries(soundPack)) {
                const before = audio.oscillators.length;
                engine.play(name as keyof typeof soundPack);
                expect(audio.oscillators.length - before).toBe(tones.length);
                audio.endAll();
            }
        });


        it("schedules nothing while muted, and again after unmuting", () => {
            const { engine, audio } = engineWith();
            engine.unlock();
            engine.setMuted(true);
            engine.play("drive");
            expect(audio.oscillators).toHaveLength(0);
            engine.setMuted(false);
            engine.play("drive");
            expect(audio.oscillators.length).toBeGreaterThan(0);
        });


        it("gives every tone an attack from silence and a release to silence", () => {
            const { engine, audio } = engineWith();
            engine.unlock();
            for (const [name, tones] of Object.entries(soundPack)) {
                const first = audio.oscillators.length;
                engine.play(name as keyof typeof soundPack);
                tones.forEach((tone, i) => {
                    const calls = audio.gains[first + i]!;
                    const osc = audio.oscillators[first + i]!;
                    const start = 10 + tone.delayMs / 1000;
                    const end = start + tone.ms / 1000;
                    const [set, attack, release] = calls;
                    expect(calls).toHaveLength(3);
                    // Starts silent at the note's start.
                    expect(set).toMatchObject({ kind: "set", time: start });
                    expect(set!.value).toBeLessThanOrEqual(0.001);
                    // Ramps to the peak within the attack window (15 ms at most).
                    expect(attack).toMatchObject({ kind: "linear", value: tone.peak });
                    expect(attack!.time).toBeGreaterThan(start);
                    expect(attack!.time - start).toBeLessThanOrEqual(0.015);
                    // Fades to near silence before the oscillator stops.
                    expect(release).toMatchObject({ kind: "exponential", time: end });
                    expect(release!.value).toBeGreaterThan(0);
                    expect(release!.value).toBeLessThanOrEqual(0.001);
                    expect(osc.stoppedAt[0]).toBeGreaterThan(release!.time);
                    for (const call of calls) {
                        expect(call.value).toBeLessThanOrEqual(1);
                        expect(call.value).toBeGreaterThanOrEqual(0);
                    }
                });
                audio.endAll();
            }
        });


        it("releases the nodes of a sound once its oscillators end", () => {
            const { engine, audio } = engineWith();
            engine.unlock();
            engine.play("yourTurn");
            expect(audio.oscillators.every((o) => o.disconnects === 0)).toBe(true);
            audio.endAll();
            expect(audio.oscillators.every((o) => o.disconnects > 0)).toBe(true);
        });


        it("never throws when the context fails to build a node", () => {
            const audio = createFakeAudio();
            audio.context.createOscillator = () => {
                throw new Error("out of nodes");
            };
            const { engine } = engineWith(audio);
            engine.unlock();
            expect(() => engine.play("drive")).not.toThrow();
            // The failed sound does not hold a slot.
            const working = createFakeAudio();
            audio.context.createOscillator = () => working.context.createOscillator();
            expect(() => engine.play("drive")).not.toThrow();
        });


        it("starts nothing when the context was closed or interrupted", () => {
            const { engine, audio } = engineWith();
            engine.unlock();
            audio.setState("interrupted");
            engine.play("drive");
            expect(audio.oscillators).toHaveLength(0);
        });


        it("drops the oldest sound when too many play at once", () => {
            const { engine, audio } = engineWith();
            engine.unlock();
            const tones = soundPack.discard.length;
            for (let i = 0; i < maxSimultaneousSounds + 3; i++) {
                engine.play("discard");
            }
            expect(audio.oscillators).toHaveLength((maxSimultaneousSounds + 3) * tones);
            const stopped = audio.oscillators.filter((o) => o.stoppedAt.length > 1);
            // The three oldest were cut short (stop() called again, at once).
            expect(stopped).toHaveLength(3 * tones);
            expect(audio.oscillators.slice(0, 3 * tones)).toEqual(stopped);
        });


        it("makes room again as sounds end", () => {
            const { engine, audio } = engineWith();
            engine.unlock();
            for (let i = 0; i < maxSimultaneousSounds; i++) {
                engine.play("discard");
            }
            audio.endAll();
            engine.play("discard");
            expect(audio.oscillators.filter((o) => o.stoppedAt.length > 1)).toHaveLength(0);
        });

    });


    describe("muted", () => {

        it("stops sounds that are already playing, and frees their slots", () => {
            const { engine, audio } = engineWith();
            engine.unlock();
            engine.play("coupFourre");
            engine.play("hazard");
            const scheduled = audio.oscillators.length;
            expect(audio.oscillators.every((o) => o.stoppedAt.length === 1)).toBe(true);
            engine.setMuted(true);
            expect(audio.oscillators).toHaveLength(scheduled);
            // Each was stopped at once (a second stop call) and disconnected.
            expect(audio.oscillators.every((o) => o.stoppedAt.length === 2)).toBe(true);
            expect(audio.oscillators.every((o) => o.disconnects > 0)).toBe(true);
            // The browser then fires `ended`: releasing twice is harmless.
            expect(() => audio.endAll()).not.toThrow();
            expect(audio.oscillators.every((o) => o.disconnects === 1)).toBe(true);
            // Muting again, or unmuting, stops nothing more.
            engine.setMuted(true);
            engine.setMuted(false);
            expect(audio.oscillators.every((o) => o.stoppedAt.length === 2)).toBe(true);
            engine.play("drive");
            expect(audio.oscillators.length).toBeGreaterThan(scheduled);
        });


        it("starts unmuted with nothing stored", () => {
            expect(engineWith().engine.muted).toBe(false);
        });


        it("persists the choice in storage under one key, and a new engine reads it", () => {
            const { engine, storage } = engineWith();
            engine.setMuted(true);
            expect(engine.muted).toBe(true);
            expect(storage.items.get(muteStorageKey)).toBe("true");
            const next = createAudioEngine({
                createContext: () => NoneOption.get(),
                storage
            });
            expect(next.muted).toBe(true);
            engine.setMuted(false);
            expect(storage.items.get(muteStorageKey)).toBe("false");
            expect(storage.items.size).toBe(1);
        });


        it("reads a corrupt stored value as unmuted", () => {
            for (const corrupt of ["", "yes", "1", "{\"muted\":true}", "TRUE"]) {
                expect(engineWith(createFakeAudio(), { [muteStorageKey]: corrupt }).engine.muted)
                .toBe(false);
            }
        });


        it("behaves as unmuted and unpersisted when storage throws", () => {
            const storage = {
                getItem: (): string | null => {
                    throw new Error("denied");
                },
                setItem: (): void => {
                    throw new Error("denied");
                }
            };
            const engine = createAudioEngine({ createContext: () => NoneOption.get(), storage });
            expect(engine.muted).toBe(false);
            expect(() => engine.setMuted(true)).not.toThrow();
            // The choice still holds for this visit.
            expect(engine.muted).toBe(true);
        });

    });

});
