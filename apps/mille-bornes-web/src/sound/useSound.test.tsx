import { applyPlayerCommand } from "@repo/mille-bornes-core/engine";
import { eventsFor, viewFor } from "@repo/mille-bornes-core/view";
import { act, renderHook } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAnimator } from "../animation/useAnimator.js";
import type { EventBatch } from "../state/screenStore.mjs";
import { annId, bobId, midRace, play } from "../testing/engineBatches.mjs";
import { createFakeEngine, type FakeEngine } from "../testing/fakeAudio.mjs";
import { team } from "../testing/viewFixtures.mjs";
import { AudioEngineContext, staggerMs, useSound } from "./useSound.js";


// Bob drives after Ann has: Ann's screen gets Bob's play (drive), her own
// turn (yourTurn) and her own draw (draw), in that order.
const afterAnn = play(midRace, "Ann", { type: "Drive", card: "50" });
const bobs = applyPlayerCommand(afterAnn, bobId, { type: "Drive", card: "75" }).throwIfFailed();
const view = viewFor(bobs.game, annId).throwIfFailed();
const batch: EventBatch = { id: 1, events: eventsFor(annId, bobs.events) };

// Ann hits Bob's team with a Stop: Bob's screen is warned.
const hit = applyPlayerCommand(
    midRace, annId, { type: "Attack", card: "Stop", targetTeam: team(1) }
).throwIfFailed();
const bobsView = viewFor(hit.game, bobId).throwIfFailed();
const hitBatch: EventBatch = { id: 2, events: eventsFor(bobId, hit.events) };


interface Props {
    pending: ReadonlyArray<EventBatch>;
}


function setup(
    initial: ReadonlyArray<EventBatch>,
    options: { engine?: FakeEngine; strict?: boolean; view?: typeof view } = {}
) {
    const engine = options.engine ?? createFakeEngine();
    const wrapper = ({ children }: { children: ReactNode }): ReactNode => {
        const provided = (
            <AudioEngineContext.Provider value={engine}>{children}</AudioEngineContext.Provider>
        );
        return options.strict === true ? <StrictMode>{provided}</StrictMode> : provided;
    };
    const hook = renderHook(
        ({ pending }: Props) => {
            const onBatchStart = useSound();
            return useAnimator(pending, vi.fn(), options.view ?? view, {
                play:          () => Promise.resolve(),
                reducedMotion: () => false,
                onBatchStart
            });
        },
        { initialProps: { pending: initial }, wrapper }
    );
    return { ...hook, engine };
}


async function advance(ms: number): Promise<void> {
    await act(() => vi.advanceTimersByTimeAsync(ms));
}


function setVibrate(value: unknown): void {
    Object.defineProperty(navigator, "vibrate", { value, configurable: true, writable: true });
}


describe("useSound", () => {

    beforeEach(() => {
        vi.useFakeTimers();
    });


    afterEach(() => {
        vi.useRealTimers();
        Reflect.deleteProperty(navigator, "vibrate");
    });


    it("plays a started batch's sounds in order, a stagger apart, once", async () => {
        const { engine, rerender } = setup([]);
        rerender({ pending: [batch] });
        expect(engine.played).not.toHaveBeenCalled();
        await advance(0);
        expect(engine.played.mock.calls).toEqual([["drive"]]);
        await advance(staggerMs);
        expect(engine.played.mock.calls).toEqual([["drive"], ["yourTurn"]]);
        await advance(staggerMs);
        expect(engine.played.mock.calls).toEqual([["drive"], ["yourTurn"], ["draw"]]);
        // The store may still list a batch that has been played.
        rerender({ pending: [batch] });
        await advance(5000);
        expect(engine.played).toHaveBeenCalledTimes(3);
    });


    it("plays each batch's sounds once, as the batch starts", async () => {
        const second: EventBatch = { id: 3, events: eventsFor(annId, bobs.events) };
        const { engine, rerender } = setup([]);
        rerender({ pending: [batch, second] });
        await advance(5000);
        expect(engine.played).toHaveBeenCalledTimes(6);
    });


    it("plays nothing for a batch the animator skipped", async () => {
        const engine = createFakeEngine();
        const { result } = renderHook(() => useSound(), {
            wrapper: ({ children }: { children: ReactNode }) => (
                <AudioEngineContext.Provider value={engine}>{children}</AudioEngineContext.Provider>
            )
        });
        const vibrate = vi.fn(() => true);
        setVibrate(vibrate);
        result.current(batch.events, view, true);
        await advance(5000);
        expect(engine.played).not.toHaveBeenCalled();
        expect(vibrate).not.toHaveBeenCalled();
        result.current(batch.events, view, false);
        await advance(5000);
        expect(engine.played).toHaveBeenCalledTimes(3);
        expect(vibrate).toHaveBeenCalledOnce();
    });


    it("plays only the newest batches of a backlog, while the last move still follows", async () => {
        const batches: EventBatch[] = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => (
            { id, events: eventsFor(annId, bobs.events) }
        ));
        const { engine, result } = setup(batches);
        await advance(5000);
        // Six are skipped; the newest two play three sounds each.
        expect(engine.played).toHaveBeenCalledTimes(6);
        expect(result.current.isSome && result.current.value.events).toBe(batches[7]!.events);
    });


    it("plays nothing for a reconnect snapshot, which brings no batch", async () => {
        const { engine, rerender } = setup([]);
        rerender({ pending: [] });
        await advance(5000);
        expect(engine.played).not.toHaveBeenCalled();
    });


    it("plays nothing for a batch the store dropped before it started", async () => {
        const { engine, rerender } = setup([batch]);
        rerender({ pending: [] });
        await advance(5000);
        expect(engine.played).not.toHaveBeenCalled();
    });


    it("plays once under StrictMode's double mount", async () => {
        const { engine } = setup([batch], { strict: true });
        await advance(5000);
        expect(engine.played.mock.calls).toEqual([["drive"], ["yourTurn"], ["draw"]]);
    });


    it("leaves no timer behind on unmount, and plays nothing more", async () => {
        const { engine, unmount } = setup([batch]);
        await advance(0);
        expect(engine.played).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBeGreaterThan(0);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
        await advance(5000);
        expect(engine.played).toHaveBeenCalledTimes(1);
    });


    it("never throws when the engine does", async () => {
        const engine = createFakeEngine();
        engine.played.mockImplementation(() => {
            throw new Error("audio is broken");
        });
        const { rerender } = setup([], { engine });
        rerender({ pending: [batch] });
        await expect(advance(5000)).resolves.toBeUndefined();
        expect(engine.played).toHaveBeenCalledTimes(3);
    });


    describe("vibration", () => {

        it("buzzes briefly for the viewer's own turn", async () => {
            const vibrate = vi.fn(() => true);
            setVibrate(vibrate);
            setup([batch]);
            await advance(5000);
            expect(vibrate.mock.calls).toEqual([[[60]]]);
        });


        it("buzzes three times for a hazard against the viewer's team", async () => {
            const vibrate = vi.fn(() => true);
            setVibrate(vibrate);
            const { engine } = setup([hitBatch], { view: bobsView });
            await advance(5000);
            expect(vibrate.mock.calls).toEqual([[[120, 80, 120]]]);
            expect(engine.played.mock.calls.flat()).toContain("windowAlert");
        });


        it("does not buzz for a hazard against someone else", async () => {
            const vibrate = vi.fn(() => true);
            setVibrate(vibrate);
            const annsBatch: EventBatch = { id: 4, events: eventsFor(annId, hit.events) };
            const { engine } = setup([annsBatch], {
                view: viewFor(hit.game, annId).throwIfFailed()
            });
            await advance(5000);
            expect(vibrate).not.toHaveBeenCalled();
            expect(engine.played.mock.calls.flat()).not.toContain("windowAlert");
        });


        it("does not buzz while muted", async () => {
            const vibrate = vi.fn(() => true);
            setVibrate(vibrate);
            setup([batch], { engine: createFakeEngine(true) });
            await advance(5000);
            expect(vibrate).not.toHaveBeenCalled();
        });


        it("does nothing where the browser has no vibration, as on iOS", async () => {
            expect("vibrate" in navigator).toBe(false);
            const { engine } = setup([batch]);
            await expect(advance(5000)).resolves.toBeUndefined();
            expect(engine.played).toHaveBeenCalledTimes(3);
        });


        it("never throws when vibrate does", async () => {
            setVibrate(() => {
                throw new Error("not allowed");
            });
            const { engine } = setup([batch]);
            await expect(advance(5000)).resolves.toBeUndefined();
            expect(engine.played).toHaveBeenCalledTimes(3);
        });

    });

});
