import { NoneOption } from "@repo/depot/option";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { createContext, useCallback, useContext, useEffect, useRef } from "react";
import { createAudioEngine, type AudioEngine } from "./audioEngine.mjs";
import { soundsFor, vibrationFor } from "./soundPack.mjs";


/** How long after one event's sound the next event's sound starts. */
export const staggerMs = 120;


// What a screen with no provider (a test of one screen) gets: it never plays.
const silentEngine = createAudioEngine({
    createContext: () => NoneOption.get(),
    storage:       { getItem: () => null, setItem: () => undefined }
});


/**
 * The one audio engine of the app session.  `App` makes it once and provides
 * it, so the mute choice and the unlocked context survive a change of
 * screen; a module-level singleton would be shared by every test.
 */
export const AudioEngineContext = createContext<AudioEngine>(silentEngine);


/**
 * Gets the app's audio engine.
 * @returns The engine `App` provided, or one that never plays when there is
 * none
 */
export function useAudioEngine(): AudioEngine {
    return useContext(AudioEngineContext);
}


// Buzzes the phone where it can (iOS has no Vibration API); never throws.
function vibrate(pattern: ReadonlyArray<number>): void {
    try {
        if ("vibrate" in navigator) {
            navigator.vibrate([...pattern]);
        }
    }
    catch {
        // A browser that refuses (no recent tap) just does not buzz.
    }
}


/**
 * Makes the function that plays a batch's sounds and vibration, to pass to
 * `useAnimator` as `onBatchStart` so they line up with the motion.  Each
 * event of the batch sounds a `staggerMs` after the one before (events that
 * are silent for this viewer take no slot), and those still waiting are
 * cancelled on unmount.  Nothing plays for a reconnect snapshot, because it
 * brings no batch.  Vibration follows the mute choice and needs
 * `navigator.vibrate`.  Never throws.
 * @returns A stable `onBatchStart(events, view)`
 */
export function useSound(): (events: ReadonlyArray<GameEvent>, view: PlayerView) => void {
    const engine = useAudioEngine();
    const timers = useRef(new Set<number>());

    useEffect(() => {
        const pending = timers.current;
        return () => {
            pending.forEach((id) => window.clearTimeout(id));
            pending.clear();
        };
    }, []);

    return useCallback((events, view) => {
        let slot = 0;
        for (const event of events) {
            const sounds = soundsFor(event, view);
            const buzz = vibrationFor(event, view);
            if (sounds.length === 0 && buzz.isNone) {
                continue;
            }
            const run = (): void => {
                try {
                    sounds.forEach((name) => engine.play(name));
                    if (buzz.isSome && !engine.muted) {
                        vibrate(buzz.value);
                    }
                }
                catch {
                    // Sound is an enhancement: a failure loses only itself.
                }
            };
            if (slot === 0) {
                run();
            }
            else {
                const id = window.setTimeout(() => {
                    timers.current.delete(id);
                    run();
                }, slot * staggerMs);
                timers.current.add(id);
            }
            slot++;
        }
    }, [engine]);
}


/**
 * Unlocks the engine on the user's gestures: browsers keep audio silent
 * until one, so the first tap or key press creates and resumes the context.
 * The listeners stay until the context runs, so a resume that failed is
 * tried again on the next gesture.
 * @param engine - The engine to unlock
 */
export function useUnlockOnGesture(engine: AudioEngine): void {
    useEffect(() => {
        // `pointerup` and `keydown` are the events that count as a gesture
        // for audio in every browser (a bare `pointerdown` does not in iOS).
        const events = ["pointerup", "keydown"] as const;
        const onGesture = (): void => {
            engine.unlock();
            if (engine.unlocked) {
                stop();
            }
        };
        const stop = (): void => {
            events.forEach((type) => window.removeEventListener(type, onGesture));
        };
        events.forEach((type) => window.addEventListener(type, onGesture));
        return stop;
    }, [engine]);
}
