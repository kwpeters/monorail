import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { annPlays } from "../testing/engineBatches.mjs";
import { team } from "../testing/viewFixtures.mjs";
import { createAnimator, type AnimatorDeps } from "./animator.mjs";
import type { Step } from "./steps.mjs";


// Real engine batches: a drive and a discard are [play, TurnStarted,
// CardDrawn], so three steps each (Fly, Pause, Fly); an attack is a batch of
// its own whose steps end with a Hold.
const drive = annPlays({ type: "Drive", card: "50" });
const discard = annPlays({ type: "Discard", card: "25" });
const attack = annPlays({ type: "Attack", card: "Stop", targetTeam: team(1) });
const { view } = drive;


interface Harness {
    deps:   AnimatorDeps;
    log:    string[];
    names:  Map<ReadonlyArray<GameEvent>, string>;
    batch:  (name: string, events: ReadonlyArray<GameEvent>) => ReadonlyArray<GameEvent>;
    done:   (name: string) => () => void;
    reduce: (on: boolean) => void;
}


// A fake `play` that takes `step.ms` of fake time, logging when each step
// starts and ends.  A Hold never ends by itself: only the animator ends it.
function harness(): Harness {
    const log: string[] = [];
    const names = new Map<ReadonlyArray<GameEvent>, string>();
    let reduced = false;
    const play = vi.fn((step: Step, signal: AbortSignal) => new Promise<void>((resolve) => {
        log.push(`start ${step.kind}`);
        let ended = false;
        const end = (): void => {
            if (ended) {
                return;
            }
            ended = true;
            window.clearTimeout(timer);
            log.push(`end ${step.kind}`);
            resolve();
        };
        const timer = step.kind === "Hold" ? undefined : window.setTimeout(end, step.ms);
        signal.addEventListener("abort", end, { once: true });
    }));
    return {
        deps: {
            play,
            reducedMotion: () => reduced,
            onBatchStart:  (events: ReadonlyArray<GameEvent>, v: PlayerView) => {
                expect(v).toBe(view);
                log.push(`batch ${names.get(events) ?? "?"}`);
            }
        },
        log,
        names,
        batch: (name, events) => {
            const copy = [...events];
            names.set(copy, name);
            return copy;
        },
        done:   (name) => () => log.push(`done ${name}`),
        reduce: (on) => {
            reduced = on;
        }
    };
}


const playedSteps = ["Fly", "Pause", "Fly"].flatMap((k) => [`start ${k}`, `end ${k}`]);


describe("createAnimator", () => {

    beforeEach(() => {
        vi.useFakeTimers();
    });


    afterEach(() => {
        vi.useRealTimers();
    });


    describe("enqueue", () => {

        it("plays batches strictly in order, one step at a time", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            animator.enqueue(h.batch("discard", discard.events), view, h.done("discard"));
            await vi.runAllTimersAsync();
            expect(h.log).toEqual([
                "batch drive", ...playedSteps, "done drive",
                "batch discard", ...playedSteps, "done discard"
            ]);
        });


        it("plays nothing until a microtask later, so an instant stop plays nothing", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            expect(h.log).toEqual([]);
            animator.stop();
            await vi.runAllTimersAsync();
            expect(h.log).toEqual([]);
            expect(h.deps.play).not.toHaveBeenCalled();
        });


        it("under reduced motion plays no step but starts and finishes each batch", async () => {
            const h = harness();
            h.reduce(true);
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("attack", attack.events), view, h.done("attack"));
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            await vi.runAllTimersAsync();
            expect(h.deps.play).not.toHaveBeenCalled();
            expect(h.log).toEqual(["batch attack", "done attack", "batch drive", "done drive"]);
        });


        it("does not stall when play rejects or throws", async () => {
            const h = harness();
            let calls = 0;
            const play = vi.fn((): Promise<void> => {
                calls++;
                if (calls === 1) {
                    throw new Error("sync");
                }
                return Promise.reject(new Error("async"));
            });
            const animator = createAnimator({ ...h.deps, play });
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            animator.enqueue(h.batch("discard", discard.events), view, h.done("discard"));
            await animator.whenIdle();
            expect(play).toHaveBeenCalledTimes(6);
            expect(h.log).toEqual(["batch drive", "done drive", "batch discard", "done discard"]);
        });


        it("skips a batch whose steps cannot be worked out and plays the next", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            const broken = {
                get type(): never {
                    throw new Error("an event this page cannot read");
                }
            } as unknown as GameEvent;
            animator.enqueue(h.batch("broken", [broken]), view, h.done("broken"));
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            await vi.runAllTimersAsync();
            expect(h.log).toEqual([
                "batch broken", "done broken",
                "batch drive", ...playedSteps, "done drive"
            ]);
            await expect(animator.whenIdle()).resolves.toBeUndefined();

            // Idle again, so a later batch starts the queue once more.
            animator.enqueue(h.batch("discard", discard.events), view, h.done("discard"));
            await vi.runAllTimersAsync();
            expect(h.log.slice(-8)).toEqual(["batch discard", ...playedSteps, "done discard"]);
        });


        it("keeps playing when a batch's onDone throws", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("drive", drive.events), view, () => {
                throw new Error("consume failed");
            });
            animator.enqueue(h.batch("discard", discard.events), view, h.done("discard"));
            await vi.runAllTimersAsync();
            expect(h.log).toEqual([
                "batch drive", ...playedSteps,
                "batch discard", ...playedSteps, "done discard"
            ]);
            await expect(animator.whenIdle()).resolves.toBeUndefined();
        });


        it("keeps playing when the onDone of a skipped batch throws", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("b0", drive.events), view, h.done("b0"));
            await vi.advanceTimersByTimeAsync(10);
            animator.enqueue(h.batch("b1", drive.events), view, () => {
                throw new Error("consume failed");
            });
            for (let i = 2; i <= 7; i++) {
                animator.enqueue(h.batch(`b${i}`, drive.events), view, h.done(`b${i}`));
            }
            await vi.runAllTimersAsync();
            expect(h.log.at(-1)).toBe("done b7");
        });


        it("skips the steps of the oldest batches of a backlog but still starts them", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("b0", drive.events), view, h.done("b0"));
            await vi.advanceTimersByTimeAsync(10);
            for (let i = 1; i <= 7; i++) {
                animator.enqueue(h.batch(`b${i}`, drive.events), view, h.done(`b${i}`));
            }
            await vi.runAllTimersAsync();
            const skipped = [1, 2, 3, 4, 5].flatMap((i) => [`batch b${i}`, `done b${i}`]);
            expect(h.log).toEqual([
                "batch b0", ...playedSteps, "done b0",
                ...skipped,
                "batch b6", ...playedSteps, "done b6",
                "batch b7", ...playedSteps, "done b7"
            ]);
        });


        it("tells onBatchStart which batches of a backlog were skipped, in order", async () => {
            const h = harness();
            const started: Array<readonly [string, boolean]> = [];
            const animator = createAnimator({
                ...h.deps,
                onBatchStart: (events, _view, skipped) => {
                    started.push([h.names.get(events) ?? "?", skipped]);
                }
            });
            animator.enqueue(h.batch("b0", drive.events), view, h.done("b0"));
            await vi.advanceTimersByTimeAsync(10);
            for (let i = 1; i <= 7; i++) {
                animator.enqueue(h.batch(`b${i}`, drive.events), view, h.done(`b${i}`));
            }
            await vi.runAllTimersAsync();
            expect(started).toEqual([
                ["b0", false],
                ["b1", true], ["b2", true], ["b3", true], ["b4", true], ["b5", true],
                ["b6", false],
                ["b7", false]
            ]);
        });


        it("does not call a batch skipped when only reduced motion skips its steps", async () => {
            const h = harness();
            h.reduce(true);
            const skippedFlags: boolean[] = [];
            const animator = createAnimator({
                ...h.deps,
                onBatchStart: (_events, _view, skipped) => void skippedFlags.push(skipped)
            });
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            await vi.runAllTimersAsync();
            expect(skippedFlags).toEqual([false]);
        });


        it("returns a function that drops a batch that has not started", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            const later = h.batch("discard", discard.events);
            const drop = animator.enqueue(later, view, h.done("discard"));
            await vi.advanceTimersByTimeAsync(10);
            drop();
            await vi.runAllTimersAsync();
            expect(h.log).toEqual(["batch drive", ...playedSteps, "done drive"]);
        });

    });


    describe("a Hold", () => {

        it("ends when the next batch is enqueued", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("attack", attack.events), view, h.done("attack"));
            await vi.advanceTimersByTimeAsync(1000);
            expect(h.log.at(-1)).toBe("start Hold");
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            await vi.advanceTimersByTimeAsync(0);
            expect(h.log.slice(-4))
            .toEqual(["end Hold", "done attack", "batch drive", "start Fly"]);
        });


        it("ends when endHold() is called, and endHold() with none is harmless", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.endHold();
            animator.enqueue(h.batch("attack", attack.events), view, h.done("attack"));
            await vi.advanceTimersByTimeAsync(1000);
            expect(h.log.at(-1)).toBe("start Hold");
            animator.endHold();
            await vi.advanceTimersByTimeAsync(0);
            expect(h.log.slice(-2)).toEqual(["end Hold", "done attack"]);
            expect(vi.getTimerCount()).toBe(0);
            animator.endHold();
        });


        it("ends after a cap of 6 s", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("attack", attack.events), view, h.done("attack"));
            await vi.advanceTimersByTimeAsync(350 + 5999);
            expect(h.log.at(-1)).toBe("start Hold");
            await vi.advanceTimersByTimeAsync(1);
            expect(h.log.slice(-2)).toEqual(["end Hold", "done attack"]);
            expect(vi.getTimerCount()).toBe(0);
        });


        it("is skipped when the next batch is already waiting", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("attack", attack.events), view, h.done("attack"));
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            await vi.advanceTimersByTimeAsync(800);
            expect(h.log).not.toContain("start Hold");
            expect(h.log).toContain("batch drive");
        });

    });


    describe("whenIdle", () => {

        it("resolves at once when nothing is queued", async () => {
            const animator = createAnimator(harness().deps);
            await expect(animator.whenIdle()).resolves.toBeUndefined();
        });


        it("resolves after the last step of the last batch", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            let idle = false;
            void animator.whenIdle().then(() => {
                idle = true;
            });
            await vi.advanceTimersByTimeAsync(800);
            expect(idle).toBe(false);
            await vi.advanceTimersByTimeAsync(100);
            expect(idle).toBe(true);
            expect(h.log.at(-1)).toBe("done drive");
        });

    });


    describe("stop", () => {

        it("ends the step in flight, drops the queue and leaves no timer", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("attack", attack.events), view, h.done("attack"));
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            await vi.advanceTimersByTimeAsync(100);
            animator.stop();
            expect(vi.getTimerCount()).toBe(0);
            await vi.runAllTimersAsync();
            expect(h.log).toEqual(["batch attack", "start Fly", "end Fly"]);
            await expect(animator.whenIdle()).resolves.toBeUndefined();
            animator.enqueue(h.batch("late", drive.events), view, h.done("late"));
            await vi.runAllTimersAsync();
            expect(h.log).not.toContain("batch late");
        });


        it("stops a Hold's cap timer", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("attack", attack.events), view, h.done("attack"));
            await vi.advanceTimersByTimeAsync(1000);
            expect(vi.getTimerCount()).toBe(1);
            animator.stop();
            expect(vi.getTimerCount()).toBe(0);
        });

    });

});
