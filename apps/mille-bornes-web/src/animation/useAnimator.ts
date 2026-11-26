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
    /** The batches that played to the end, until the store drops them. */
    readonly finished: Set<number>;
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
            play:          (...args) => latest.current.deps.play(...args),
            reducedMotion: () => latest.current.deps.reducedMotion(),
            onBatchStart:  (events, batchView, skipped) => {
                setStarted(new SomeOption({ events, view: batchView }));
                latest.current.deps.onBatchStart?.(events, batchView, skipped);
            }
        });
        live.current = new SomeOption({
            animator,
            enqueued: new Map(),
            finished: new Set<number>()
        });
        return () => {
            animator.stop();
            live.current = NoneOption.get();
        };
    }, []);

    useEffect(() => {
        if (live.current.isNone) {
            return;
        }
        const { animator, enqueued, finished } = live.current.value;
        const ids = new Set(pending.map((batch) => batch.id));
        // A finished batch may linger in `pending` for a render or two.
        for (const id of finished) {
            if (!ids.has(id)) {
                finished.delete(id);
            }
        }
        for (const [id, drop] of enqueued) {
            if (!ids.has(id)) {
                drop();
                enqueued.delete(id);
                // The store dropped a batch we did not finish (a snapshot or
                // a screen that is not Playing): the hazard window it showed
                // is over.  A batch we finished is in `finished`, not here.
                animator.endHold();
            }
        }
        for (const { id, events } of pending) {
            if (!enqueued.has(id) && !finished.has(id)) {
                enqueued.set(id, animator.enqueue(events, view, () => {
                    enqueued.delete(id);
                    finished.add(id);
                    latest.current.consume(id);
                }));
            }
        }
    }, [pending, view]);

    return started;
}
