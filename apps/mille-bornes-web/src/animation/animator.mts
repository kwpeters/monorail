import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { releaseAt, stepsForBatch, type Release, type Step } from "./steps.mjs";


/** What `createAnimator()` needs. */
export interface AnimatorDeps {
    /**
     * Shows one step.  The animator aborts `signal` when the step must end
     * early (a Hold that is over, or `stop()`), and always once the step is
     * done, so the step can clean up.  A rejection is ignored.  `release`,
     * when given, lets the step start the next one early (see `Release`).
     */
    play:          (step: Step, signal: AbortSignal, release?: Release) => Promise<void>;

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


/** Plays batches of events one after another; a batch's steps may overlap. */
export interface Animator {
    /**
     * Queues a batch; it plays after every batch queued before it.  Ends a
     * Hold in flight, since the hazard window it shows is over.
     * @param events - The batch, in order
     * @param view - The view the batch arrived with (it names the players)
     * @param onDone - Called when the batch's steps are over (not after
     * `stop()`, and not for a dropped batch)
     * @param onStart - Called as the batch starts, right after
     * `onBatchStart`
     * @returns A function that drops the batch if it has not started yet
     */
    enqueue: (
        events: ReadonlyArray<GameEvent>,
        view: PlayerView,
        onDone?: () => void,
        onStart?: () => void
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
    readonly events:  ReadonlyArray<GameEvent>;
    readonly view:    PlayerView;
    readonly onDone:  () => void;
    readonly onStart: () => void;
}


// More batches than this waiting (a hidden tab, a slow phone) and all but the
// newest `playInFull` are started without their steps.
const maxWaiting = 5;
const playInFull = 2;


/**
 * Makes the animation queue: batches play strictly in the order queued and
 * never overlap; within a batch a step starts when `releaseAt()` allows (a
 * flight when the one before it is 70% through, any other step when the one
 * before it has ended).  A failing `play` never stalls it.
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

    // Ends every step in flight; ends the Hold in flight (and its cap timer).
    const ends = new Set<() => void>();
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
        for (const hook of [
            () => deps.onBatchStart?.(batch.events, batch.view, skipped),
            batch.onStart
        ]) {
            try {
                hook();
            }
            catch {
                // A hook that throws (a sound) must not stop the animations.
            }
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

    // Starts a step.  `done` resolves when it is over; `released` when the
    // next step may start (when `fraction` of it has played, if it says so).
    const runStep = (
        s: Step,
        fraction: number
    ): { done: Promise<void>; released: Promise<void> } => {
        const controller = new AbortController();
        const aborted = new Promise<void>((resolve) => {
            controller.signal.addEventListener("abort", () => resolve(), { once: true });
        });
        let release = noop;
        const released = new Promise<void>((resolve) => {
            release = resolve;
        });
        const timer = s.kind === "Hold" ?
            window.setTimeout(() => controller.abort(), s.ms) :
            undefined;
        const end = (): void => {
            window.clearTimeout(timer);
            controller.abort();
        };
        ends.add(end);
        if (s.kind === "Hold") {
            endCurrentHold = end;
        }
        const done = (async (): Promise<void> => {
            try {
                const early = fraction < 1 ? { at: fraction, run: release } : undefined;
                // Raced with the signal: a `play` that never settles cannot
                // stall.
                await Promise.race([deps.play(s, controller.signal, early), aborted]);
            }
            catch {
                // A failed animation only loses its own motion.
            }
            finally {
                window.clearTimeout(timer);
                ends.delete(end);
                if (s.kind === "Hold") {
                    endCurrentHold = noop;
                }
                controller.abort();
                release();
            }
        })();
        return { done, released };
    };

    // Plays a batch's steps; resolves once they are all over (or stopped).
    const playSteps = async (batch: Queued): Promise<void> => {
        // A hazard that landed in the same batch had no window to show.
        const landedAtOnce = batch.events.some((e) => e.type === "HazardLanded");
        const steps = stepsForBatch(batch.events, batch.view);
        const live = new Set<Promise<void>>();
        // Resolves when the next step may start.
        let gate: Promise<unknown> = Promise.resolve();
        for (const [i, s] of steps.entries()) {
            await gate;
            if (isStopped()) {
                return;
            }
            // A Hold shows a hazard window that the next batch has closed.
            const over = s.kind === "Hold" && (landedAtOnce || waiting.length > 0);
            if (over || deps.reducedMotion()) {
                continue;
            }
            const next = steps[i + 1];
            const fraction = next === undefined ? 1 : releaseAt(s, next);
            const { done, released } = runStep(s, fraction);
            live.add(done);
            void done.then(() => live.delete(done));
            // Waiting for the whole step also waits for any still running.
            gate = fraction < 1 ? released : Promise.all([...live]);
        }
        await Promise.all([...live]);
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
                    await playSteps(batch);
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
        enqueue: (events, view, onDone = noop, onStart = noop) => {
            if (stopped) {
                return noop;
            }
            const entry: Queued = { events, view, onDone, onStart };
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
            [...ends].forEach((end) => end());
            becomeIdle();
        }
    };
}
