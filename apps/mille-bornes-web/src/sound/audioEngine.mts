import { NoneOption, SomeOption, type Option } from "@repo/depot/option";
import { startPlaybackSession } from "./playbackSession.mjs";
import { soundPack, type SoundName, type Tone } from "./soundPack.mjs";


/** The one `localStorage` key that holds the mute choice. */
export const muteStorageKey = "milleBornes.muted";


/** The most sounds that may play at once; a new one cuts the oldest short. */
export const maxSimultaneousSounds = 8;


/** The part of `AudioParam` the engine uses. */
export interface AudioParamLike {
    setValueAtTime(value: number, time: number): unknown;
    linearRampToValueAtTime(value: number, time: number): unknown;
    exponentialRampToValueAtTime(value: number, time: number): unknown;
}


/** The part of `AudioNode` the engine uses. */
export interface AudioNodeLike {
    connect(destination: unknown): unknown;
    disconnect(): void;
}


/** The part of `OscillatorNode` the engine uses. */
export interface OscillatorLike extends AudioNodeLike {
    type:      OscillatorType;
    frequency: AudioParamLike;
    onended:   ((event: Event) => unknown) | null;
    start(when?: number): void;
    stop(when?: number): void;
}


/** The part of `GainNode` the engine uses. */
export interface GainLike extends AudioNodeLike {
    gain: AudioParamLike;
}


/**
 * The part of `AudioContext` the engine uses, so a test can pass a fake.
 * `state` is a string because Safari adds "interrupted" to the standard
 * "running", "suspended" and "closed".
 */
export interface AudioContextLike {
    readonly currentTime: number;
    readonly destination: unknown;
    readonly state:       string;
    resume(): Promise<void>;
    createOscillator(): OscillatorLike;
    createGain(): GainLike;
}


/** The part of `Storage` the engine uses. */
export interface StorageLike {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}


/**
 * Plays the game's synthesized sounds.  Nothing here ever throws: sound is
 * an enhancement, and the game is fully playable without it.
 */
export interface AudioEngine {
    /** Whether a gesture has made the context run, so `play` makes noise. */
    readonly unlocked: boolean;

    /** Whether sounds (and vibration, which follows this) are switched off. */
    readonly muted: boolean;

    /**
     * Creates the audio context (once) and resumes it.  Call it from a user
     * gesture (browsers keep audio silent until one); calling it again is
     * cheap and retries a resume that failed.
     */
    unlock(): void;

    /**
     * Plays a sound.  A no-op until the context is running, while muted, and
     * for a sound the context fails to build.
     * @param name - The sound
     */
    play(name: SoundName): void;

    /**
     * Switches sound off or on and remembers the choice.
     * @param m - True to mute
     */
    setMuted(m: boolean): void;
}


// The swell at the start of a note, so it does not click.
const attackSeconds = 0.012;

// An exponential ramp cannot reach 0; this is silent enough.
const silence = 0.0001;

// How long after its end an oscillator is stopped, for the fade to finish.
const stopSlackSeconds = 0.02;


interface LiveSound {
    stop: () => void;
}


// Schedules one note on the context.  Returns what cuts it short.
function startTone(ctx: AudioContextLike, tone: Tone, onEnded: () => void): () => void {
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const start = ctx.currentTime + tone.delayMs / 1000;
    const end = start + tone.ms / 1000;
    osc.type = tone.wave;
    osc.frequency.setValueAtTime(tone.hz, start);
    if (tone.slideToHz !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(tone.slideToHz, end);
    }
    amp.gain.setValueAtTime(silence, start);
    amp.gain.linearRampToValueAtTime(tone.peak, start + Math.min(attackSeconds, tone.ms / 4000));
    amp.gain.exponentialRampToValueAtTime(silence, end);
    osc.connect(amp);
    amp.connect(ctx.destination);
    let released = false;
    const release = (): void => {
        if (released) {
            return;
        }
        released = true;
        try {
            osc.disconnect();
            amp.disconnect();
        }
        catch {
            // Already disconnected.
        }
        onEnded();
    };
    osc.onended = release;
    osc.start(start);
    osc.stop(end + stopSlackSeconds);
    return () => {
        try {
            osc.stop();
        }
        catch {
            // Not running any more.
        }
        release();
    };
}


/**
 * Makes the audio engine.  The context is made lazily by `unlock()`, which a
 * user gesture calls; before that, with no context (the constructor throws or
 * is missing), with a context that cannot resume, or while muted, `play` is a
 * no-op.  The mute choice is kept in `storage` under `muteStorageKey`; a
 * storage that throws, or holds anything but "true", means unmuted.
 * `prepareSession`, if given, runs on every `unlock()`, before the context is
 * made, until it returns true (nothing more to do); a throw counts as false.
 * @param deps - How to make the context, where to keep the mute choice, and an
 * optional gesture-time audio session setup
 * @returns The engine, locked
 */
export function createAudioEngine(deps: {
    createContext:   () => Option<AudioContextLike>;
    storage:         StorageLike;
    prepareSession?: () => boolean;
}): AudioEngine {
    let context: Option<AudioContextLike> = NoneOption.get();
    let prepared = false;
    let muted = ((): boolean => {
        try {
            return deps.storage.getItem(muteStorageKey) === "true";
        }
        catch {
            return false;
        }
    })();
    let live: LiveSound[] = [];

    const running = (): Option<AudioContextLike> => (
        context.isSome && context.value.state === "running" ? context : NoneOption.get()
    );

    // Asks the context to run; a rejection only means "not yet".
    const resume = (ctx: AudioContextLike): void => {
        try {
            ctx.resume().catch(() => undefined);
        }
        catch {
            // A context that cannot resume stays silent.
        }
    };

    return {
        unlock: () => {
            if (!prepared) {
                try {
                    prepared = deps.prepareSession?.() ?? true;
                }
                catch {
                    // Without a playback session the sounds still play; the
                    // next gesture tries again.
                }
            }
            try {
                if (context.isNone) {
                    context = deps.createContext();
                }
                if (context.isSome && context.value.state !== "running") {
                    resume(context.value);
                }
            }
            catch {
                // No AudioContext here: the game stays silent.
            }
        },

        play: (name) => {
            const ctx = running();
            if (muted || ctx.isNone) {
                // A phone that locked suspended the context; try to wake it.
                if (!muted && context.isSome && context.value.state !== "closed") {
                    resume(context.value);
                }
                return;
            }
            const tones = soundPack[name];
            let remaining = tones.length;
            const stops: Array<() => void> = [];
            const sound: LiveSound = { stop: () => stops.forEach((stop) => stop()) };
            const forget = (): void => {
                live = live.filter((s) => s !== sound);
            };
            const toneEnded = (): void => {
                remaining--;
                if (remaining === 0) {
                    forget();
                }
            };
            try {
                while (live.length >= maxSimultaneousSounds) {
                    live.shift()!.stop();
                }
                live.push(sound);
                for (const tone of tones) {
                    stops.push(startTone(ctx.value, tone, toneEnded));
                }
            }
            catch {
                sound.stop();
                forget();
            }
        },

        get unlocked() {
            return running().isSome;
        },

        get muted() {
            return muted;
        },

        setMuted: (m) => {
            muted = m;
            if (m) {
                // Sounds already scheduled are cut short too.
                [...live].forEach((sound) => sound.stop());
            }
            try {
                deps.storage.setItem(muteStorageKey, String(m));
            }
            catch {
                // The choice holds for this visit only.
            }
        }
    };
}


/**
 * Makes the engine for the browser: an `AudioContext` made on first use and
 * `window.localStorage`.
 * @returns The engine; silent where the browser has no Web Audio
 */
export function createBrowserAudioEngine(): AudioEngine {
    return createAudioEngine({
        createContext: () => typeof AudioContext === "function" ?
            new SomeOption<AudioContextLike>(new AudioContext()) :
            NoneOption.get(),
        prepareSession: () => startPlaybackSession({ navigator, document }),
        // Looked up per call: reading `window.localStorage` can itself throw.
        storage:        {
            getItem: (key) => window.localStorage.getItem(key),
            setItem: (key, value) => {
                window.localStorage.setItem(key, value);
            }
        }
    });
}
