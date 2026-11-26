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
 * brings no batch, nor for a batch the animator skipped (a backlog after a
 * phone woke up would otherwise sound all at once).  Vibration follows the mute choice and needs
 * `navigator.vibrate`.  Never throws.
 * @returns A stable `onBatchStart(events, view)`
 */
export function useSound(): (
    events: ReadonlyArray<GameEvent>,
    view: PlayerView,
    skipped?: boolean
) => void {
    const engine = useAudioEngine();
    const timers = useRef(new Set<number>());

    useEffect(() => {
        const pending = timers.current;
        return () => {
            pending.forEach((id) => window.clearTimeout(id));
            pending.clear();
        };
    }, []);

    return useCallback((events, view, skipped = false) => {
        if (skipped) {
            return;
        }
        let slot = 0;
        // A hazard that lands in its own batch opened no window: it sounds
        // once, and nothing alerts the hit team to a window.
        const landedAtOnce = events.some((e) => e.type === "HazardPlayed") &&
            events.some((e) => e.type === "HazardLanded");
        for (const event of events) {
            if (landedAtOnce && event.type === "HazardLanded") {
                continue;
            }
            const sounds = soundsFor(event, view)
            .filter((name) => !(landedAtOnce && name === "windowAlert"));
            const buzz = landedAtOnce && event.type === "HazardPlayed" ?
                NoneOption.get() :
                vibrationFor(event, view);
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
 * The listeners stay for the whole session: a phone that locks or switches
 * apps suspends the context again (iOS may refuse a resume made outside a
 * gesture), and the next tap must wake it.  `unlock()` is cheap and calls
 * `resume()` only when the context is not running.
 * @param engine - The engine to unlock
 */
export function useUnlockOnGesture(engine: AudioEngine): void {
    useEffect(() => {
        // These count as a gesture for audio (a bare `pointerdown` does not
        // on iOS); `touchend` and `click` hedge for `pointerup`.  The handler
        // is synchronous: `resume()` must be called inside the gesture.
        const events = ["pointerup", "touchend", "click", "keydown"] as const;
        const onGesture = (): void => engine.unlock();
        events.forEach((type) => window.addEventListener(type, onGesture));
        return () => {
            events.forEach((type) => window.removeEventListener(type, onGesture));
        };
    }, [engine]);
}
