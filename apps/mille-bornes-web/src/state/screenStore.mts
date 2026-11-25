import { NoneOption, type Option, SomeOption } from "@repo/depot/option";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { isUnauthorized, type Api } from "../api/client.mjs";


/** How the stream from the server is doing. */
export type ConnectionStatus = "Connecting" | "Live" | "Reconnecting";


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
    readonly sequence:      number;

    /** Not yet consumed by the animator, oldest first. */
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

    /** Opens the subscription.  Calling it again does nothing. */
    start: () => void;

    /** Closes the subscription; messages that still arrive are ignored. */
    stop: () => void;

    /**
     * The animator marks a batch as played.
     * @param id - The batch to remove; other batches stay
     */
    consumeEvents: (id: number) => void;
}


/** What `createScreenStore()` needs. */
export interface ScreenStoreDeps {
    api:            Api;

    /** Called once when the server says the credential is not valid. */
    onUnauthorized: () => void;
}


const initialSnapshot: Snapshot = {
    screen:        NoneOption.get(),
    status:        "Connecting",
    sequence:      0,
    pendingEvents: []
};


/**
 * Makes the store behind the `watch` subscription.
 *
 * The server's first message after every connection is a full snapshot, so
 * the first screen ever received and the first one after each reconnect only
 * update the screen: their events were already played (or missed) and must
 * not animate or make a sound again.
 * @param deps - The API and the unauthorized hook
 * @returns The store, not yet started
 */
export function createScreenStore(deps: ScreenStoreDeps): ScreenStore {
    let snapshot = initialSnapshot;
    const listeners = new Set<() => void>();
    let started = false;
    let stopped = false;
    let unsubscribe: (() => void) | undefined;
    let nextBatchId = 1;

    // The next screen is a snapshot: true before the first message and after
    // every connection error, because the server restarts with a snapshot.
    let nextIsSnapshot = true;

    const update = (changes: Partial<Snapshot>): void => {
        snapshot = { ...snapshot, ...changes };
        // Copy: a listener may unsubscribe while we notify.
        [...listeners].forEach((listener) => listener());
    };

    const close = (): void => {
        stopped = true;
        unsubscribe?.();
        unsubscribe = undefined;
    };

    const connectionLost = (): void => {
        nextIsSnapshot = true;
        if (snapshot.status !== "Reconnecting") {
            update({ status: "Reconnecting" });
        }
    };

    const receive = (screen: Screen): void => {
        const queue = !nextIsSnapshot && screen.kind === "Playing" && screen.events.length > 0;
        nextIsSnapshot = false;
        update({
            screen:        new SomeOption(screen),
            status:        "Live",
            sequence:      snapshot.sequence + 1,
            pendingEvents: queue ?
                [...snapshot.pendingEvents, { id: nextBatchId++, events: screen.events }] :
                snapshot.pendingEvents
        });
    };

    return {
        getSnapshot: () => snapshot,

        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },

        start: () => {
            if (started || stopped) {
                return;
            }
            started = true;

            const subscription = deps.api.trpc.watch.subscribe(undefined, {
                onData: (screen) => {
                    if (!stopped) {
                        receive(screen);
                    }
                },

                // A dropped connection: the browser's EventSource retries on
                // its own and tRPC reports it as `connecting` with an error.
                // The first `connecting` has no error and is not a drop.
                onConnectionStateChange: (state) => {
                    if (!stopped && state.state === "connecting" && state.error !== null) {
                        connectionLost();
                    }
                },

                onError: (err) => {
                    if (stopped) {
                        return;
                    }
                    if (isUnauthorized(err)) {
                        close();
                        deps.onUnauthorized();
                        return;
                    }
                    connectionLost();
                }
            });
            unsubscribe = () => subscription.unsubscribe();
        },

        stop: close,

        consumeEvents: (id) => {
            if (snapshot.pendingEvents.some((batch) => batch.id === id)) {
                update({ pendingEvents: snapshot.pendingEvents.filter((b) => b.id !== id) });
            }
        }
    };
}
