import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { stepsFor, type Step } from "./steps.mjs";


/** What `createAnimator()` needs. */
export interface AnimatorDeps {
    /**
     * Shows one step.  The animator aborts `signal` when the step must end
     * early (a Hold that is over, or `stop()`), and always once the step is
     * done, so the step can clean up.  A rejection is ignored.
     */
    play:          (step: Step, signal: AbortSignal) => Promise<void>;

    /** Read before each step; when true, no step is played at all. */
    reducedMotion: () => boolean;

    /**
     * Called once as each batch starts, before its first step (also when its
     * steps are skipped), with the view the batch arrived with.  `skipped`
     * is true when backlog protection skips the batch's steps: it is still
     * announced (the last move line needs it), but a sound should not play.
     */
    onBatchStart?: (
        events: ReadonlyArray<GameEvent>,
        view: PlayerView,
        skipped: boolean
    ) => void;
}


/** Plays batches of events one after another. */
export interface Animator {
    /**
     * Queues a batch; it plays after every batch queued before it.  Ends a
     * Hold in flight, since the hazard window it shows is over.
     * @param events - The batch, in order
     * @param view - The view the batch arrived with (it names the players)
     * @param onDone - Called when the batch's steps are over (not after
     * `stop()`, and not for a dropped batch)
     * @returns A function that drops the batch if it has not started yet
     */
    enqueue: (
        events: ReadonlyArray<GameEvent>,
        view: PlayerView,
        onDone?: () => void
    ) => () => void;

    /**
     * Ends the Hold in flight, if any, for a hazard window that is known to
     * be over (a reconnect snapshot shows it); the batch then finishes.
     */
    endHold: () => void;

    /** @returns A promise that resolves once nothing is playing or queued */
    whenIdle: () => Promise<void>;

    /** Ends the step in flight and drops the queue; ignores later batches. */
    stop: () => void;
}


interface Queued {
    readonly events: ReadonlyArray<GameEvent>;
    readonly view:   PlayerView;
    readonly onDone: () => void;
}


// More batches than this waiting (a hidden tab, a slow phone) and all but the
// newest `playInFull` are started without their steps.
const maxWaiting = 5;
const playInFull = 2;


/**
 * Makes the animation queue: batches play strictly in the order queued, one
 * step at a time, and never overlap.  A failing `play` never stalls it.
 * @param deps - How to play a step, the motion preference and the batch
 * start hook
 * @returns The animator, idle
 */
export function createAnimator(deps: AnimatorDeps): Animator {
    const waiting: Queued[] = [];
    let running = false;
    let stopped = false;
    let idleWaiters: Array<() => void> = [];
    const noop = (): void => undefined;

    // Ends the step in flight; ends the Hold in flight (and its cap timer).
    let endStep = noop;
    let endCurrentHold = noop;

    // A call, so the loop below sees a stop() made while it awaited.
    const isStopped = (): boolean => stopped;

    const becomeIdle = (): void => {
        running = false;
        const waiters = idleWaiters;
        idleWaiters = [];
        waiters.forEach((resolve) => resolve());
    };

    const start = (batch: Queued, skipped = false): void => {
        try {
            deps.onBatchStart?.(batch.events, batch.view, skipped);
        }
        catch {
            // A hook that throws (a sound) must not stop the animations.
        }
    };

    // The store's consume (and its listeners) must not stall the queue.
    const finish = (batch: Queued): void => {
        try {
            batch.onDone();
        }
        catch {
            // The batch was played; a failing hook only loses its own work.
        }
    };

    const runStep = async (s: Step): Promise<void> => {
        const controller = new AbortController();
        const aborted = new Promise<void>((resolve) => {
            controller.signal.addEventListener("abort", () => resolve(), { once: true });
        });
        const timer = s.kind === "Hold" ?
            window.setTimeout(() => controller.abort(), s.ms) :
            undefined;
        const end = (): void => {
            window.clearTimeout(timer);
            controller.abort();
        };
        endStep = end;
        endCurrentHold = s.kind === "Hold" ? end : noop;
        try {
            // Raced with the signal: a `play` that never settles cannot stall.
            await Promise.race([deps.play(s, controller.signal), aborted]);
        }
        catch {
            // A failed animation only loses its own motion.
        }
        finally {
            window.clearTimeout(timer);
            endStep = noop;
            endCurrentHold = noop;
            controller.abort();
        }
    };

    const run = async (): Promise<void> => {
        // Starts a microtask later, so a stop() right after the first
        // enqueue() (React StrictMode's test unmount) plays nothing.
        await Promise.resolve();
        try {
            while (!isStopped() && waiting.length > 0) {
                if (waiting.length > maxWaiting) {
                    for (const old of waiting.splice(0, waiting.length - playInFull)) {
                        start(old, true);
                        finish(old);
                    }
                }
                const batch = waiting.shift()!;
                start(batch);
                try {
                    // A hazard that landed in the same batch had no window to show.
                    const landedAtOnce = batch.events.some((e) => e.type === "HazardLanded");
                    for (const s of batch.events.flatMap((e) => stepsFor(e, batch.view))) {
                        // A Hold shows a hazard window that the next batch has closed.
                        const over = s.kind === "Hold" && (landedAtOnce || waiting.length > 0);
                        if (isStopped()) {
                            return;
                        }
                        if (!over && !deps.reducedMotion()) {
                            await runStep(s);
                        }
                    }
                }
                catch {
                    // A batch that cannot be shown (an event this page does not
                    // know, say) loses its motion; the queue goes on.
                }
                if (isStopped()) {
                    return;
                }
                finish(batch);
            }
        }
        finally {
            // Whatever happened, the next enqueue() starts the loop again.
            becomeIdle();
        }
    };

    return {
        enqueue: (events, view, onDone = noop) => {
            if (stopped) {
                return noop;
            }
            const entry: Queued = { events, view, onDone };
            waiting.push(entry);
            endCurrentHold();
            if (!running) {
                running = true;
                void run();
            }
            return () => {
                const at = waiting.indexOf(entry);
                if (at >= 0) {
                    waiting.splice(at, 1);
                }
            };
        },

        endHold: () => endCurrentHold(),

        whenIdle: () => running ?
            new Promise<void>((resolve) => {
                idleWaiters.push(resolve);
            }) :
            Promise.resolve(),

        stop: () => {
            stopped = true;
            waiting.length = 0;
            endStep();
            becomeIdle();
        }
    };
}
