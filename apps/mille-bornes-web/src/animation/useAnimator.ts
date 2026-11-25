import { NoneOption, SomeOption, type Option } from "@repo/depot/option";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { useEffect, useRef, useState } from "react";
import type { EventBatch } from "../state/screenStore.mjs";
import { createAnimator, type Animator, type AnimatorDeps } from "./animator.mjs";


/** A batch the animator has started, with the view it arrived with. */
export interface StartedBatch {
    readonly events: ReadonlyArray<GameEvent>;
    readonly view:   PlayerView;
}


interface Live {
    readonly animator: Animator;
    /** The batches given to this animator, by id, with what drops them. */
    readonly enqueued: Map<number, () => void>;
}


/**
 * Feeds the store's pending batches to an animator, each one once, with the
 * view of the render it first appears in (the screen it arrived with), and
 * marks it consumed when its steps are over.  A batch that disappears from
 * `pending` before it starts (a reconnect snapshot drops them) is dropped
 * too, so nothing stale plays after a phone wakes up; the batch in flight
 * plays on.  The animator lives from mount to unmount; StrictMode's extra
 * mount gets a fresh one, and the first one is stopped before it plays.
 * @param pending - The store's batches not yet consumed, oldest first
 * @param consume - Marks a batch as played
 * @param view - The current view
 * @param deps - How to play a step, the motion preference and an optional
 * batch start hook (read on each call, so they may change between renders)
 * @returns The batch that started most recently, if any
 */
export function useAnimator(
    pending: ReadonlyArray<EventBatch>,
    consume: (id: number) => void,
    view: PlayerView,
    deps: AnimatorDeps
): Option<StartedBatch> {
    const [started, setStarted] = useState<Option<StartedBatch>>(NoneOption.get());
    const latest = useRef({ consume, deps });
    const live = useRef<Option<Live>>(NoneOption.get());

    useEffect(() => {
        latest.current = { consume, deps };
    });

    useEffect(() => {
        const animator = createAnimator({
            play:          (step, signal) => latest.current.deps.play(step, signal),
            reducedMotion: () => latest.current.deps.reducedMotion(),
            onBatchStart:  (events, batchView) => {
                setStarted(new SomeOption({ events, view: batchView }));
                latest.current.deps.onBatchStart?.(events, batchView);
            }
        });
        live.current = new SomeOption({ animator, enqueued: new Map() });
        return () => {
            animator.stop();
            live.current = NoneOption.get();
        };
    }, []);

    useEffect(() => {
        if (live.current.isNone) {
            return;
        }
        const { animator, enqueued } = live.current.value;
        const ids = new Set(pending.map((batch) => batch.id));
        for (const [id, drop] of enqueued) {
            if (!ids.has(id)) {
                drop();
                enqueued.delete(id);
            }
        }
        for (const { id, events } of pending) {
            if (!enqueued.has(id)) {
                enqueued.set(id, animator.enqueue(events, view, () => latest.current.consume(id)));
            }
        }
    }, [pending, view]);

    return started;
}
