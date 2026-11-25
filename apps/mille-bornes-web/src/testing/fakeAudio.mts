import { vi, type Mock } from "vitest";
import type { AudioContextLike, AudioEngine, StorageLike } from "../sound/audioEngine.mjs";


// Test support: never import this from production code.


/** One oscillator the fake context made, with what was asked of it. */
export interface FakeOscillator {
    type:        OscillatorType;
    hz:          number[];
    slides:      number[];
    startedAt:   number[];
    stoppedAt:   number[];
    connected:   boolean;
    disconnects: number;
    onended:     (() => void) | null;
}


/** A fake `AudioContext` and what happened to it. */
export interface FakeAudio {
    context:     AudioContextLike;
    oscillators: FakeOscillator[];
    /** Makes every oscillator end, as the browser does once a sound is over. */
    endAll:      () => void;
    resume:      Mock<() => Promise<void>>;
    setState:    (state: string) => void;
}


/**
 * Makes a fake `AudioContext`.
 * @param state - Its state at first (default `running`)
 * @param resume - What `resume()` does (default: becomes `running`)
 * @returns The fake and a record of what is done to it
 */
export function createFakeAudio(
    state = "running",
    resume?: () => Promise<void>
): FakeAudio {
    const oscillators: FakeOscillator[] = [];
    let current = state;
    // Like a browser, it is running a moment after resume() is called.
    const resumeFn = vi.fn(resume ?? ((): Promise<void> => Promise.resolve().then(() => {
        current = "running";
    })));
    const param = (record: number[], slides: number[]) => ({
        setValueAtTime:               (v: number) => void record.push(v),
        linearRampToValueAtTime:      () => undefined,
        exponentialRampToValueAtTime: (v: number) => void slides.push(v)
    });
    const context: AudioContextLike = {
        currentTime: 10,
        destination: {},
        get state() {
            return current;
        },
        resume:     () => resumeFn(),
        createGain: () => ({
            gain:       param([], []),
            connect:    () => undefined,
            disconnect: () => undefined
        }),
        createOscillator: () => {
            const osc: FakeOscillator = {
                type:        "sine",
                hz:          [],
                slides:      [],
                startedAt:   [],
                stoppedAt:   [],
                connected:   false,
                disconnects: 0,
                onended:     null
            };
            oscillators.push(osc);
            return {
                get type() {
                    return osc.type;
                },
                set type(t: OscillatorType) {
                    osc.type = t;
                },
                get onended() {
                    return osc.onended;
                },
                set onended(f: ((e: Event) => unknown) | null) {
                    osc.onended = f === null ? null : () => void f(new Event("ended"));
                },
                frequency: param(osc.hz, osc.slides),
                connect:   () => {
                    osc.connected = true;
                },
                disconnect: () => {
                    osc.disconnects++;
                },
                start: (t = 0) => void osc.startedAt.push(t),
                stop:  (t = 0) => void osc.stoppedAt.push(t)
            };
        }
    };
    return {
        context,
        oscillators,
        endAll:   () => oscillators.forEach((o) => o.onended?.()),
        resume:   resumeFn,
        setState: (s) => {
            current = s;
        }
    };
}


/** An in-memory storage, with the items it holds. */
export interface MemoryStorage extends StorageLike {
    items: Map<string, string>;
}


/**
 * Makes an in-memory storage.
 * @param initial - Items saved before the test starts
 * @returns The storage
 */
export function createMemoryStorage(initial: Record<string, string> = {}): MemoryStorage {
    const items = new Map(Object.entries(initial));
    return {
        items,
        getItem: (key) => items.get(key) ?? null,
        setItem: (key, value) => void items.set(key, value)
    };
}


/** An engine that only records what is played. */
export interface FakeEngine extends AudioEngine {
    played:  Mock<(name: string) => void>;
    unlocks: Mock<() => void>;
}


/**
 * Makes an engine that plays nothing and records the calls.
 * @param muted - Whether it starts muted
 * @returns The engine
 */
export function createFakeEngine(muted = false): FakeEngine {
    let isMuted = muted;
    const played = vi.fn<(name: string) => void>();
    const unlocks = vi.fn<() => void>();
    return {
        played,
        unlocks,
        unlock:   unlocks,
        play:     played,
        unlocked: false,
        get muted() {
            return isMuted;
        },
        setMuted: (m) => {
            isMuted = m;
        }
    };
}
