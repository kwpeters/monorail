import { NoneOption, type Option, SomeOption } from "@repo/depot/option";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { z } from "zod";
import { isUnauthorized, type Api } from "../api/client.mjs";


/** How the stream from the server is doing. */
export const connectionStatusSchema = z.enum(["Connecting", "Live", "Reconnecting"]);
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;


/** The events of one Playing screen, waiting for the animator. */
export interface EventBatch {
    readonly id:     number;
    readonly events: ReadonlyArray<GameEvent>;
}


/** Everything a component needs; a new object whenever something changes. */
export interface Snapshot {
    /** None until the first message. */
    readonly screen: Option<Screen>;
    readonly status: ConnectionStatus;

    /** Increases with every received screen. */
    readonly sequence: number;

    /**
     * Not yet consumed by the animator, oldest first.  The animator is the
     * only consumer; a snapshot (the first message after every connect or
     * reconnect) drops whatever it had not played yet, so the list cannot
     * grow without bound across reconnects or in a hidden tab.
     */
    readonly pendingEvents: ReadonlyArray<EventBatch>;
}


/** The latest screen from the server, plus the events still to animate. */
export interface ScreenStore {
    /** @returns The current snapshot; the same object until something changes */
    getSnapshot: () => Snapshot;

    /**
     * Listens for changes; the shape `useSyncExternalStore` wants.
     * @param listener - Called once for each change
     * @returns A function that stops listening
     */
    subscribe: (listener: () => void) => () => void;

    /**
     * Opens the subscription.  Calling it while it is open does nothing.
     * After `stop()` (or after UNAUTHORIZED) it opens a fresh subscription:
     * the status reads `Connecting` until the first new message, which is a
     * snapshot; the last screen is kept so nothing flashes.  This makes the
     * `start`, `stop`, `start` of React StrictMode safe.
     */
    start: () => void;

    /**
     * Closes the subscription and any pending retry; messages that still
     * arrive from it are ignored.
     */
    stop: () => void;

    /**
     * The animator marks a batch as played.
     * @param id - The batch to remove; other batches stay
     */
    consumeEvents: (id: number) => void;
}


/** What `createScreenStore()` needs. */
export interface ScreenStoreDeps {
    api: Api;

    /**
     * Called once when the subscription reports UNAUTHORIZED; the store then
     * stops.  A late call from a subscription opened under an older
     * credential can arrive after a new sign-in, so the caller compares the
     * credential it started the store with against the stored one before it
     * clears anything.
     */
    onUnauthorized: () => void;
}


const initialSnapshot: Snapshot = {
    screen:        NoneOption.get(),
    status:        "Connecting",
    sequence:      0,
    pendingEvents: []
};


/** First wait before resubscribing after the subscription died. */
const firstBackoffMs = 1000;


/** The longest wait between resubscribe attempts. */
const maxBackoffMs = 10_000;


/**
 * Makes the store behind the `watch` subscription.
 *
 * The server's first message after every connection is a full snapshot, so
 * the first screen ever received and the first one after each reconnect only
 * update the screen: their events were already played (or missed) and must
 * not animate or make a sound again.
 *
 * The browser's EventSource retries a lost TCP connection by itself (tRPC
 * reports it as a `connecting` state with an error).  Some endings are
 * final, though: a non-200 answer (also from the dev proxy while the game
 * server restarts), a non-retryable tRPC error, or a clean end of the
 * stream.  Those end the tRPC subscription, so the store resubscribes itself
 * after a backoff (1 s, doubling to 10 s, reset by the next message).
 * @param deps - The API and the unauthorized hook
 * @returns The store, not yet started
 */
export function createScreenStore(deps: ScreenStoreDeps): ScreenStore {
    let snapshot = initialSnapshot;
    const listeners = new Set<() => void>();
    let running = false;
    let nextBatchId = 1;

    // Each subscription gets a number; callbacks of an older one are ignored.
    let generation = 0;
    let unsubscribe: (() => void) | undefined;
    let retryTimer: number | undefined;
    let backoffMs = firstBackoffMs;

    // The next screen is a snapshot: true before the first message and after
    // every connection loss, because the server starts with a snapshot.
    let nextIsSnapshot = true;

    const update = (changes: Partial<Snapshot>): void => {
        snapshot = { ...snapshot, ...changes };
        // Copy: a listener may unsubscribe while we notify.
        [...listeners].forEach((listener) => listener());
    };

    const setStatus = (status: ConnectionStatus): void => {
        if (snapshot.status !== status) {
            update({ status });
        }
    };

    // Ends the current subscription; its late callbacks are then ignored.
    const closeSubscription = (): void => {
        generation++;
        unsubscribe?.();
        unsubscribe = undefined;
    };

    const clearRetry = (): void => {
        if (retryTimer !== undefined) {
            window.clearTimeout(retryTimer);
            retryTimer = undefined;
        }
    };

    const receive = (screen: Screen): void => {
        const isSnapshot = nextIsSnapshot;
        nextIsSnapshot = false;
        backoffMs = firstBackoffMs;
        const queue = !isSnapshot && screen.kind === "Playing" && screen.events.length > 0;
        const kept = isSnapshot ? [] : snapshot.pendingEvents;
        update({
            screen:        new SomeOption(screen),
            status:        "Live",
            sequence:      snapshot.sequence + 1,
            pendingEvents: queue ?
                [...kept, { id: nextBatchId++, events: screen.events }] :
                kept
        });
    };

    const connectionLost = (): void => {
        nextIsSnapshot = true;
        setStatus("Reconnecting");
    };

    // The subscription is dead: show it, wait, then subscribe again.
    const restart = (): void => {
        connectionLost();
        closeSubscription();
        const wait = backoffMs;
        backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
        retryTimer = window.setTimeout(() => {
            retryTimer = undefined;
            if (running) {
                open();
            }
        }, wait);
    };

    function open(): void {
        const mine = ++generation;
        const current = (): boolean => running && mine === generation;

        const subscription = deps.api.trpc.watch.subscribe(undefined, {
            onData: (screen) => {
                if (current()) {
                    receive(screen);
                }
            },

            // A dropped connection that the EventSource retries by itself:
            // tRPC reports `connecting` with an error.  The first
            // `connecting` has no error and is not a drop.
            onConnectionStateChange: (state) => {
                if (current() && state.state === "connecting" && state.error !== null) {
                    connectionLost();
                }
            },

            onError: (err) => {
                if (!current()) {
                    return;
                }
                if (isUnauthorized(err)) {
                    // Terminal: no restart.  A later `start()` may begin again.
                    running = false;
                    closeSubscription();
                    deps.onUnauthorized();
                    return;
                }
                restart();
            },

            // The stream ended cleanly (for example a server shutdown).  Both
            // callbacks fire; the first one restarts, so the second is stale.
            onStopped: () => {
                if (current()) {
                    restart();
                }
            },

            onComplete: () => {
                if (current()) {
                    restart();
                }
            }
        });

        // A callback cannot have fired before `subscribe` returned.
        unsubscribe = () => subscription.unsubscribe();
    }

    return {
        getSnapshot: () => snapshot,

        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },

        start: () => {
            if (running) {
                return;
            }
            running = true;
            nextIsSnapshot = true;
            backoffMs = firstBackoffMs;
            setStatus("Connecting");
            open();
        },

        stop: () => {
            running = false;
            clearRetry();
            closeSubscription();
        },

        consumeEvents: (id) => {
            if (snapshot.pendingEvents.some((batch) => batch.id === id)) {
                update({ pendingEvents: snapshot.pendingEvents.filter((b) => b.id !== id) });
            }
        }
    };
}
