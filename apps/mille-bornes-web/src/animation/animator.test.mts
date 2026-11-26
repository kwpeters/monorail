import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Card } from "@repo/mille-bornes-core/card";
import { newZone } from "@repo/mille-bornes-core/drivingZone";
import {
    annPlays, annPlaysIn, setUp, stopAlreadyAnswered
} from "../testing/engineBatches.mjs";
import { team } from "../testing/viewFixtures.mjs";
import { rollingZone } from "../testing/zoneFixtures.mjs";
import { createAnimator, type AnimatorDeps } from "./animator.mjs";
import type { Release, Step } from "./steps.mjs";


// Real engine batches: a drive and a discard are [play, TurnStarted,
// CardDrawn], so two steps each (Fly, Fly: the Pause of TurnStarted is left
// out when a batch has motion); an attack is a batch of its own whose steps
// end with a Hold; a remedy is Fly, Pulse, Fly.
const drive = annPlays({ type: "Drive", card: "50" });
const discard = annPlays({ type: "Discard", card: "25" });
const attack = annPlays({ type: "Attack", card: "Stop", targetTeam: team(1) });
// A Stop whose safety is already down: [HazardPlayed, HazardLanded, TurnStarted,
// CardDrawn] in one batch, with no hazard window.
const instantAttack = annPlaysIn(
    stopAlreadyAnswered,
    { type: "Attack", card: "Stop", targetTeam: team(1) }
);
const remedy = annPlaysIn(
    setUp([Card.roll, Card.dist25], [Card.dist50], [newZone(), rollingZone()]),
    { type: "Remedy", card: "Roll" }
);
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
// With `early`, a step lets the next one start when the animator asks it to
// (the real `play` of a flight or a pulse does); without, the next step
// starts when it ends.
function harness(early = false): Harness {
    const log: string[] = [];
    const names = new Map<ReadonlyArray<GameEvent>, string>();
    let reduced = false;
    const play = vi.fn((step: Step, signal: AbortSignal, release?: Release) => {
        return new Promise<void>((resolve) => {
            log.push(`start ${step.kind}`);
            let ended = false;
            const end = (): void => {
                if (ended) {
                    return;
                }
                ended = true;
                window.clearTimeout(timer);
                window.clearTimeout(releaser);
                log.push(`end ${step.kind}`);
                resolve();
            };
            const timer = step.kind === "Hold" ? undefined : window.setTimeout(end, step.ms);
            const releaser = release === undefined || !early ?
                undefined :
                window.setTimeout(release.run, release.at * step.ms);
            signal.addEventListener("abort", end, { once: true });
        });
    });
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


const playedSteps = ["Fly", "Fly"].flatMap((k) => [`start ${k}`, `end ${k}`]);


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
            expect(play).toHaveBeenCalledTimes(4);
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
            expect(h.log.slice(-6)).toEqual(["batch discard", ...playedSteps, "done discard"]);
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


        it("rushes a batch with another one waiting: half-length flights, no pulse", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("remedy", remedy.events), view, h.done("remedy"));
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            await vi.runAllTimersAsync();
            const steps = vi.mocked(h.deps.play).mock.calls.map(([s]) => s);
            // The remedy is Fly, Pulse, Fly in full; rushed, its pulse is gone.
            expect(steps.map((s) => [s.kind, s.ms, s.kind === "Fly" && s.rushed === true]))
            .toEqual([
                ["Fly", 225, true], ["Fly", 225, true],
                ["Fly", 450, false], ["Fly", 450, false]
            ]);
        });


        it("rushes all but the newest of three waiting, and skips none", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("b0", drive.events), view, h.done("b0"));
            await vi.advanceTimersByTimeAsync(10);
            for (let i = 1; i <= 3; i++) {
                animator.enqueue(h.batch(`b${i}`, drive.events), view, h.done(`b${i}`));
            }
            await vi.runAllTimersAsync();
            const flights = vi.mocked(h.deps.play).mock.calls.map(([s]) => s.ms);
            expect(flights).toEqual([450, 450, 225, 225, 225, 225, 450, 450]);
            expect(h.log.filter((l) => l.startsWith("done"))).toEqual(
                ["done b0", "done b1", "done b2", "done b3"]
            );
        });


        it("skips the oldest of four waiting, keeping the newest two", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("b0", drive.events), view, h.done("b0"));
            await vi.advanceTimersByTimeAsync(10);
            for (let i = 1; i <= 4; i++) {
                animator.enqueue(h.batch(`b${i}`, drive.events), view, h.done(`b${i}`));
            }
            await vi.runAllTimersAsync();
            expect(h.log).toEqual([
                "batch b0", ...playedSteps, "done b0",
                "batch b1", "done b1", "batch b2", "done b2",
                "batch b3", ...playedSteps, "done b3",
                "batch b4", ...playedSteps, "done b4"
            ]);
            expect(vi.mocked(h.deps.play).mock.calls.map(([s]) => s.ms)).toEqual(
                [450, 450, 225, 225, 450, 450]
            );
        });


        it("calls a batch's own start hook as it starts, also when skipped", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            const started: string[] = [];
            animator.enqueue(h.batch("b0", drive.events), view, h.done("b0"), () => {
                started.push("b0");
            });
            await vi.advanceTimersByTimeAsync(10);
            for (let i = 1; i <= 4; i++) {
                animator.enqueue(h.batch(`b${i}`, drive.events), view, h.done(`b${i}`), () => {
                    started.push(`b${i}`);
                    h.log.push(`own b${i}`);
                });
            }
            await vi.runAllTimersAsync();
            expect(started).toEqual(["b0", "b1", "b2", "b3", "b4"]);
            expect(h.log.slice(h.log.indexOf("batch b1"), h.log.indexOf("batch b1") + 3))
            .toEqual(["batch b1", "own b1", "done b1"]);
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


        it("ends after a cap of 10 s", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("attack", attack.events), view, h.done("attack"));
            await vi.advanceTimersByTimeAsync(450 + 9999);
            expect(h.log.at(-1)).toBe("start Hold");
            await vi.advanceTimersByTimeAsync(1);
            expect(h.log.slice(-2)).toEqual(["end Hold", "done attack"]);
            expect(vi.getTimerCount()).toBe(0);
        });


        it("is skipped when the hazard landed in the same batch", async () => {
            const h = harness();
            const animator = createAnimator(h.deps);
            expect(instantAttack.events.map((e) => e.type).slice(0, 2))
            .toEqual(["HazardPlayed", "HazardLanded"]);
            animator.enqueue(h.batch("instant", instantAttack.events), view, h.done("instant"));
            // Far less than the hold cap: the batch must not wait for it.
            await vi.advanceTimersByTimeAsync(3000);
            expect(h.log).not.toContain("start Hold");
            expect(h.log.at(-1)).toBe("done instant");
            // The card still flies in, and the Bad pulse still plays.
            expect(h.log.slice(0, 5)).toEqual(
                ["batch instant", "start Fly", "end Fly", "start Pulse", "end Pulse"]
            );
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


    describe("overlapping steps", () => {

        it("starts the next flight when a flight is 70% through", async () => {
            const h = harness(true);
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            await vi.advanceTimersByTimeAsync(314);
            expect(h.log).toEqual(["batch drive", "start Fly"]);
            await vi.advanceTimersByTimeAsync(2);
            expect(h.log).toEqual(["batch drive", "start Fly", "start Fly"]);
            // The first flight lands at 450 ms, the second at 315 + 450 ms.
            await vi.advanceTimersByTimeAsync(134);
            expect(h.log.at(-1)).toBe("end Fly");
            expect(h.log).not.toContain("done drive");
            await vi.advanceTimersByTimeAsync(315);
            expect(h.log.slice(-3)).toEqual(["end Fly", "end Fly", "done drive"]);
            expect(vi.getTimerCount()).toBe(0);
        });


        it("starts a pulse when its flight lands and the next flight 60% into the pulse", async () => {
            const h = harness(true);
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("remedy", remedy.events), view, h.done("remedy"));
            await vi.advanceTimersByTimeAsync(449);
            expect(h.log).toEqual(["batch remedy", "start Fly"]);
            await vi.advanceTimersByTimeAsync(1);
            expect(h.log.slice(-2)).toEqual(["end Fly", "start Pulse"]);
            // The pulse lasts 450 ms; the draw leaves at 60% of it.
            await vi.advanceTimersByTimeAsync(269);
            expect(h.log.at(-1)).toBe("start Pulse");
            await vi.advanceTimersByTimeAsync(1);
            expect(h.log.at(-1)).toBe("start Fly");
            await vi.runAllTimersAsync();
            expect(h.log.at(-1)).toBe("done remedy");
        });


        it("waits for every step of a batch before the next batch starts", async () => {
            const h = harness(true);
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            animator.enqueue(h.batch("discard", discard.events), view, h.done("discard"));
            await vi.runAllTimersAsync();
            const flights = ["start Fly", "start Fly", "end Fly", "end Fly"];
            expect(h.log).toEqual([
                "batch drive", ...flights, "done drive",
                "batch discard", ...flights, "done discard"
            ]);
        });


        it("ends a Hold only after the flight before it, which never overlaps it", async () => {
            const h = harness(true);
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("attack", attack.events), view, h.done("attack"));
            await vi.advanceTimersByTimeAsync(449);
            expect(h.log).toEqual(["batch attack", "start Fly"]);
            await vi.advanceTimersByTimeAsync(1);
            expect(h.log.slice(-2)).toEqual(["end Fly", "start Hold"]);
        });


        it("stop() ends every step in flight at once and leaves no timer", async () => {
            const h = harness(true);
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            animator.enqueue(h.batch("discard", discard.events), view, h.done("discard"));
            // The discard waits, so the drive is rushed: 225 ms flights, the
            // second leaving at 158 ms.
            await vi.advanceTimersByTimeAsync(200);
            expect(h.log).toEqual(["batch drive", "start Fly", "start Fly"]);
            animator.stop();
            expect(vi.getTimerCount()).toBe(0);
            await vi.runAllTimersAsync();
            expect(h.log).toEqual(["batch drive", "start Fly", "start Fly", "end Fly", "end Fly"]);
            await expect(animator.whenIdle()).resolves.toBeUndefined();
        });


        it("starts the next step when a step ends without releasing it", async () => {
            // The fake ignores `release`: a step that does not call it
            // releases the next one when it ends, so nothing waits forever.
            const h = harness(false);
            const animator = createAnimator(h.deps);
            animator.enqueue(h.batch("drive", drive.events), view, h.done("drive"));
            await vi.advanceTimersByTimeAsync(449);
            expect(h.log).toEqual(["batch drive", "start Fly"]);
            await vi.advanceTimersByTimeAsync(1);
            expect(h.log.slice(-2)).toEqual(["end Fly", "start Fly"]);
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
