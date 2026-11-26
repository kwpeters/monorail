import { Card } from "@repo/mille-bornes-core/card";
import { zoneMiles } from "@repo/mille-bornes-core/drivingZone";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventBatch } from "../state/screenStore.mjs";
import { annPlays, bobDrivesToAnn, midRace, viewOf } from "../testing/engineBatches.mjs";
import { team } from "../testing/viewFixtures.mjs";
import type { AnimatorDeps } from "./animator.mjs";
import type { Step } from "./steps.mjs";
import { useAnimator } from "./useAnimator.js";


// Real engine batches: two steps each (two flights of 450 ms; the pause of
// TurnStarted is left out of a batch with motion).
const drove = annPlays({ type: "Drive", card: "50" });
const discarded = annPlays({ type: "Discard", card: "25" });
const attacked = annPlays({ type: "Attack", card: "Stop", targetTeam: team(1) });
const { view } = drove;
const batchMs = 900;


interface Props {
    pending: ReadonlyArray<EventBatch>;
}


// A fake play that takes each step's time; it ends early when aborted.
function fakeDeps(): AnimatorDeps & {
    play:         ReturnType<typeof vi.fn<AnimatorDeps["play"]>>;
    onBatchStart: ReturnType<typeof vi.fn<NonNullable<AnimatorDeps["onBatchStart"]>>>;
} {
    const play = vi.fn((step: Step, signal: AbortSignal) => new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, step.ms);
        signal.addEventListener("abort", () => {
            window.clearTimeout(timer);
            resolve();
        }, { once: true });
    }));
    return { play, reducedMotion: () => false, onBatchStart: vi.fn() };
}


function setup(
    initial: ReadonlyArray<EventBatch>,
    wrapper?: (p: { children: ReactNode }) => ReactNode
) {
    const deps = fakeDeps();
    const consume = vi.fn<(id: number) => void>();
    const hook = renderHook(
        ({ pending }: Props) => useAnimator(pending, consume, view, deps),
        { initialProps: { pending: initial }, ...(wrapper === undefined ? {} : { wrapper }) }
    );
    return { ...hook, deps, consume };
}


async function advance(ms: number): Promise<void> {
    await act(() => vi.advanceTimersByTimeAsync(ms));
}


interface TableProps {
    pending: ReadonlyArray<EventBatch>;
    view:    PlayerView;
}


// The hook on a table that shows `start`; each rerender is a new screen.
function onTable(
    start: PlayerView,
    play?: AnimatorDeps["play"],
    wrapper?: (p: { children: ReactNode }) => ReactNode
) {
    const deps = { ...fakeDeps(), ...(play === undefined ? {} : { play }) };
    let reduced = false;
    const consume = vi.fn<(id: number) => void>();
    const initialProps: TableProps = { pending: [], view: start };
    const hook = renderHook(
        (p: TableProps) => useAnimator(p.pending, consume, p.view, {
            ...deps, reducedMotion: () => reduced
        }),
        {
            initialProps,
            ...(wrapper === undefined ? {} : { wrapper })
        }
    );
    const reduce = (): void => {
        reduced = true;
    };
    return { ...hook, deps, consume, reduce };
}


function milesOf(view: PlayerView): ReadonlyArray<number> {
    return view.teams.map((t) => zoneMiles(t.zone));
}


describe("useAnimator", () => {

    const first: EventBatch = { id: 1, events: drove.events };
    const second: EventBatch = { id: 2, events: discarded.events };


    beforeEach(() => {
        vi.useFakeTimers();
    });


    afterEach(() => {
        vi.useRealTimers();
    });


    it("animates a pending batch once and consumes it when its steps are over", async () => {
        const { deps, consume, rerender } = setup([first]);
        await advance(batchMs - 1);
        expect(consume).not.toHaveBeenCalled();
        rerender({ pending: [first] });
        rerender({ pending: [...[first]] });
        await advance(1);
        expect(consume).toHaveBeenCalledExactlyOnceWith(1);
        await advance(5000);
        expect(deps.play).toHaveBeenCalledTimes(2);
    });


    it("returns the batch that started most recently, with its view", async () => {
        const { result, rerender } = setup([]);
        expect(result.current.started.isNone).toBe(true);
        rerender({ pending: [first] });
        await advance(0);
        expect(result.current.started.isSome && result.current.started.value)
        .toEqual({ events: drove.events, view });
        rerender({ pending: [first, second] });
        await advance(batchMs);
        const { started } = result.current;
        expect(started.isSome && started.value.events).toBe(discarded.events);
    });


    it("enqueues nothing new for a reconnect snapshot that lands mid batch", async () => {
        const { deps, consume, result, rerender } = setup([first]);
        await advance(100);
        expect(deps.play).toHaveBeenCalledTimes(1);
        // The snapshot replaces the queue with an empty list.
        rerender({ pending: [] });
        await advance(5000);
        expect(consume).toHaveBeenCalledExactlyOnceWith(1);
        // The batch in flight finished its two steps; nothing came after.
        expect(deps.play).toHaveBeenCalledTimes(2);
        expect(deps.onBatchStart).toHaveBeenCalledOnce();
        const { started } = result.current;
        expect(started.isSome && started.value.events).toBe(drove.events);
    });


    it("ends a Hold when the snapshot drops the batch that holds", async () => {
        const hazard: EventBatch = { id: 7, events: attacked.events };
        const { deps, consume, rerender } = setup([hazard]);
        // The hazard's flight, then its Hold, which would last 10 s.
        await advance(500);
        expect(deps.play).toHaveBeenLastCalledWith(
            expect.objectContaining({ kind: "Hold" }), expect.any(AbortSignal), undefined
        );
        expect(consume).not.toHaveBeenCalled();
        rerender({ pending: [] });
        await advance(0);
        expect(consume).toHaveBeenCalledExactlyOnceWith(7);
        expect(vi.getTimerCount()).toBe(0);
    });


    it("does not play a finished batch again while it is still in pending", async () => {
        const { deps, consume, rerender } = setup([first]);
        await advance(batchMs);
        expect(consume).toHaveBeenCalledExactlyOnceWith(1);
        // The store has not dropped it yet (or an effect ran on a stale render).
        rerender({ pending: [first] });
        rerender({ pending: [{ ...first }] });
        await advance(5000);
        expect(deps.play).toHaveBeenCalledTimes(2);
        expect(deps.onBatchStart).toHaveBeenCalledOnce();
        expect(consume).toHaveBeenCalledOnce();
        // Once the store drops it, the id may be forgotten.
        rerender({ pending: [] });
        rerender({ pending: [second] });
        await advance(batchMs);
        expect(consume).toHaveBeenCalledTimes(2);
    });


    it("does not end a Hold when a played batch is consumed", async () => {
        const hazard: EventBatch = { id: 7, events: attacked.events };
        const { deps, consume, rerender } = setup([first, hazard]);
        // The first batch plays and is consumed; the store then drops it.
        await advance(batchMs + 500);
        expect(consume).toHaveBeenCalledExactlyOnceWith(1);
        expect(deps.play).toHaveBeenLastCalledWith(
            expect.objectContaining({ kind: "Hold" }), expect.any(AbortSignal), undefined
        );
        rerender({ pending: [hazard] });
        await advance(1000);
        expect(consume).toHaveBeenCalledOnce();
        await advance(10000);
        expect(consume).toHaveBeenCalledTimes(2);
    });


    it("lets the batch in flight finish across a reconnect, dropping those waiting", async () => {
        const { deps, consume, rerender } = setup([first, second]);
        await advance(100);
        // The snapshot after a reconnect empties the queue.
        rerender({ pending: [] });
        await advance(5000);
        expect(consume).toHaveBeenCalledExactlyOnceWith(1);
        expect(deps.play).toHaveBeenCalledTimes(2);
    });


    it("enqueues once under StrictMode's double mount", async () => {
        const { deps, consume } = setup([first], StrictMode);
        await advance(5000);
        expect(deps.play).toHaveBeenCalledTimes(2);
        expect(consume).toHaveBeenCalledExactlyOnceWith(1);
    });


    it("stops cleanly on unmount: no timers and no consume", async () => {
        const { consume, unmount } = setup([first]);
        await advance(100);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
        await advance(5000);
        expect(consume).not.toHaveBeenCalled();
    });


    describe("the shown view", () => {

        // Bob drives 75 (a flight to his lane), then Ann's turn and her draw
        // of a Spare Tire (a flight to her hand): 450 ms each, one after the
        // other with this fake play.
        const bob = bobDrivesToAnn;
        const bobs: EventBatch = { id: 2, events: bob.events };


        it("shows the table from before a batch until each of its cards lands", async () => {
            const { result, rerender } = onTable(bob.before);
            rerender({ pending: [bobs], view: bob.view });
            // The render the batch arrives in already holds the table back.
            expect(result.current.shown).toBe(bob.before);
            expect(result.current.drawing).toEqual([Card.spareTire]);
            await advance(449);
            expect(result.current.shown).toBe(bob.before);
            await advance(1);
            // Bob's card is on his lane; the pile and the turn wait.
            expect(milesOf(result.current.shown)).toEqual(milesOf(bob.view));
            expect(result.current.shown.drawPileCount).toBe(bob.before.drawPileCount);
            expect(result.current.shown.phase).toEqual(bob.before.phase);
            expect(result.current.drawing).toEqual([Card.spareTire]);
            await advance(450);
            expect(result.current.shown).toBe(bob.view);
            expect(result.current.drawing).toEqual([]);
        });


        it("advances batch by batch", async () => {
            const start = viewOf(midRace, "Ann");
            const annDrove: EventBatch = { id: 1, events: drove.events };
            const { result, rerender } = onTable(start);
            rerender({ pending: [annDrove], view: bob.before });
            await advance(0);
            rerender({ pending: [annDrove, bobs], view: bob.view });
            expect(result.current.shown).toBe(start);
            await advance(batchMs);
            expect(result.current.shown).toBe(bob.before);
            await advance(batchMs);
            expect(result.current.shown).toBe(bob.view);
        });


        it("shows the live table at once when a snapshot drops the batch", async () => {
            const { result, rerender } = onTable(bob.before);
            rerender({ pending: [bobs], view: bob.view });
            await advance(100);
            rerender({ pending: [], view: bob.view });
            expect(result.current.shown).toBe(bob.view);
            expect(result.current.drawing).toEqual([]);
        });


        it("shows the live table at once under reduced motion", () => {
            const { result, rerender, reduce } = onTable(bob.before);
            reduce();
            rerender({ pending: [bobs], view: bob.view });
            expect(result.current.shown).toBe(bob.view);
            expect(result.current.drawing).toEqual([]);
        });


        it("shows a hazard batch once its window starts, while the card is held", async () => {
            const { result, rerender, consume } = onTable(viewOf(midRace, "Ann"));
            rerender({ pending: [{ id: 7, events: attacked.events }], view: attacked.view });
            await advance(449);
            expect(result.current.shown).not.toBe(attacked.view);
            await advance(1);
            expect(result.current.shown).toBe(attacked.view);
            expect(consume).not.toHaveBeenCalled();
        });


        it("does not hold the table back for the batches a backlog skips", async () => {
            const views = [1, 2, 3, 4, 5].map(() => ({ ...bob.view }));
            const batches = views.map((_, i) => ({ id: 10 + i, events: drove.events }));
            const { result, rerender } = onTable(bob.before);
            rerender({ pending: batches.slice(0, 1), view: views[0]! });
            await advance(0);
            for (let n = 2; n <= 5; n++) {
                rerender({ pending: batches.slice(0, n), view: views[n - 1]! });
            }
            expect(result.current.shown).toBe(bob.before);
            // The first lands; the next two are skipped; the fourth is
            // rushed (two 225 ms flights), the last plays in full.
            await advance(batchMs);
            expect(result.current.shown).toBe(views[2]);
            await advance(450);
            expect(result.current.shown).toBe(views[3]);
            await advance(batchMs);
            expect(result.current.shown).toBe(views[4]);
        });


        it("shows the live table 3 s after a batch stalls", async () => {
            const stalls = vi.fn(() => new Promise<void>(() => {
                // Never settles.
            }));
            const { result, rerender } = onTable(bob.before, stalls);
            rerender({ pending: [bobs], view: bob.view });
            await advance(2999);
            expect(result.current.shown).toBe(bob.before);
            await advance(1);
            expect(result.current.shown).toBe(bob.view);
            expect(result.current.drawing).toEqual([]);
        });


        it("lags and catches up under StrictMode's double mount", async () => {
            const { result, rerender } = onTable(bob.before, undefined, StrictMode);
            rerender({ pending: [bobs], view: bob.view });
            expect(result.current.shown).toBe(bob.before);
            await advance(batchMs);
            expect(result.current.shown).toBe(bob.view);
        });


        it("leaves no timer behind once everything has landed, or on unmount", async () => {
            const { rerender, unmount } = onTable(bob.before);
            rerender({ pending: [bobs], view: bob.view });
            await advance(batchMs);
            expect(vi.getTimerCount()).toBe(0);
            rerender({ pending: [bobs, { id: 3, events: drove.events }], view: bob.view });
            await advance(100);
            unmount();
            expect(vi.getTimerCount()).toBe(0);
        });

    });

});
