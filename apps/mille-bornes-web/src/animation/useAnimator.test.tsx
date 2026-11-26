import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventBatch } from "../state/screenStore.mjs";
import { annPlays } from "../testing/engineBatches.mjs";
import { team } from "../testing/viewFixtures.mjs";
import type { AnimatorDeps } from "./animator.mjs";
import type { Step } from "./steps.mjs";
import { useAnimator } from "./useAnimator.js";


// Real engine batches: three steps each (Fly 350, Pause 150, Fly 350 ms).
const drove = annPlays({ type: "Drive", card: "50" });
const discarded = annPlays({ type: "Discard", card: "25" });
const attacked = annPlays({ type: "Attack", card: "Stop", targetTeam: team(1) });
const { view } = drove;
const batchMs = 850;


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
        expect(deps.play).toHaveBeenCalledTimes(3);
    });


    it("returns the batch that started most recently, with its view", async () => {
        const { result, rerender } = setup([]);
        expect(result.current.isNone).toBe(true);
        rerender({ pending: [first] });
        await advance(0);
        expect(result.current.isSome && result.current.value)
        .toEqual({ events: drove.events, view });
        rerender({ pending: [first, second] });
        await advance(batchMs);
        expect(result.current.isSome && result.current.value.events).toBe(discarded.events);
    });


    it("enqueues nothing new for a reconnect snapshot that lands mid batch", async () => {
        const { deps, consume, result, rerender } = setup([first]);
        await advance(100);
        expect(deps.play).toHaveBeenCalledTimes(1);
        // The snapshot replaces the queue with an empty list.
        rerender({ pending: [] });
        await advance(5000);
        expect(consume).toHaveBeenCalledExactlyOnceWith(1);
        // The batch in flight finished its three steps; nothing came after.
        expect(deps.play).toHaveBeenCalledTimes(3);
        expect(deps.onBatchStart).toHaveBeenCalledOnce();
        expect(result.current.isSome && result.current.value.events).toBe(drove.events);
    });


    it("ends a Hold when the snapshot drops the batch that holds", async () => {
        const hazard: EventBatch = { id: 7, events: attacked.events };
        const { deps, consume, rerender } = setup([hazard]);
        // The hazard's flight, then its Hold, which would last 10 s.
        await advance(400);
        expect(deps.play).toHaveBeenLastCalledWith(
            expect.objectContaining({ kind: "Hold" }), expect.any(AbortSignal)
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
        expect(deps.play).toHaveBeenCalledTimes(3);
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
        await advance(batchMs + 400);
        expect(consume).toHaveBeenCalledExactlyOnceWith(1);
        expect(deps.play).toHaveBeenLastCalledWith(
            expect.objectContaining({ kind: "Hold" }), expect.any(AbortSignal)
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
        expect(deps.play).toHaveBeenCalledTimes(3);
    });


    it("enqueues once under StrictMode's double mount", async () => {
        const { deps, consume } = setup([first], StrictMode);
        await advance(5000);
        expect(deps.play).toHaveBeenCalledTimes(3);
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

});
