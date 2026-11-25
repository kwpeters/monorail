import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { TRPCClientError } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";
import type { Api } from "../api/client.mjs";
import { createScreenStore, type ScreenStore } from "./screenStore.mjs";


interface ConnectionState {
    type:  "state";
    state: string;
    error: unknown;
}


/** The callbacks the store hands to `watch.subscribe()`. */
interface Callbacks {
    onData:                  (screen: Screen) => void;
    onError:                 (err: unknown) => void;
    onConnectionStateChange: (state: ConnectionState) => void;
}


interface Harness {
    store:          ScreenStore;
    callbacks:      () => Callbacks;
    subscribe:      ReturnType<typeof vi.fn>;
    unsubscribe:    ReturnType<typeof vi.fn>;
    onUnauthorized: ReturnType<typeof vi.fn<() => void>>;
}


function makeStore(): Harness {
    let captured: Callbacks | undefined;
    const unsubscribe = vi.fn();
    const subscribe = vi.fn((_input: unknown, callbacks: Callbacks) => {
        captured = callbacks;
        return { unsubscribe };
    });
    const api = { trpc: { watch: { subscribe } } } as unknown as Api;
    const onUnauthorized = vi.fn<() => void>();
    const store = createScreenStore({ api, onUnauthorized });
    const callbacks = (): Callbacks => {
        if (captured === undefined) {
            throw new Error("The store has not subscribed yet.");
        }
        return captured;
    };
    return { store, callbacks, subscribe, unsubscribe, onUnauthorized };
}


function started(): Harness {
    const harness = makeStore();
    harness.store.start();
    return harness;
}


const race = (n: number): GameEvent => ({ type: "RaceDealt", race: n });


// The store only reads `kind` and `events`, so a partial Playing screen will do.
function playing(...events: GameEvent[]): Screen {
    return { kind: "Playing", events } as unknown as Screen;
}


const lobby: Screen = { kind: "Lobby", notice: null, games: [] };


const connecting: ConnectionState = { type: "state", state: "connecting", error: null };
const pending: ConnectionState = { type: "state", state: "pending", error: null };


// What tRPC reports when the EventSource loses its connection and retries.
const dropped: ConnectionState = {
    type:  "state",
    state: "connecting",
    error: new TRPCClientError("The connection was lost.")
};


const unauthorizedError = TRPCClientError.from({
    error: {
        message: "Your session is not valid.",
        code:    -32001,
        data:    { code: "UNAUTHORIZED", httpStatus: 401 }
    }
});


describe("screenStore", () => {

    describe("createScreenStore()", () => {

        describe("before the first message", () => {

            it("is Connecting with no screen and no events", () => {
                const { store } = started();
                const snapshot = store.getSnapshot();
                expect(snapshot.status).toBe("Connecting");
                expect(snapshot.screen.isNone).toBe(true);
                expect(snapshot.sequence).toBe(0);
                expect(snapshot.pendingEvents).toEqual([]);
            });


            it("subscribes to watch without input", () => {
                const { subscribe } = started();
                expect(subscribe).toHaveBeenCalledTimes(1);
                expect(subscribe.mock.calls[0]?.[0]).toBeUndefined();
            });


            it("ignores the first connecting state, which has no error", () => {
                const { store, callbacks } = started();
                callbacks().onConnectionStateChange(connecting);
                callbacks().onConnectionStateChange(pending);
                expect(store.getSnapshot().status).toBe("Connecting");
            });


            it("becomes Reconnecting when the first connection fails", () => {
                const { store, callbacks } = started();
                callbacks().onConnectionStateChange(dropped);
                expect(store.getSnapshot().status).toBe("Reconnecting");
                expect(store.getSnapshot().screen.isNone).toBe(true);
            });

        });


        describe("the first message", () => {

            it("makes the store Live with the screen and queues no events", () => {
                const { store, callbacks } = started();
                const screen = playing(race(1));
                callbacks().onData(screen);
                const snapshot = store.getSnapshot();
                expect(snapshot.status).toBe("Live");
                expect(snapshot.screen.isSome && snapshot.screen.value).toBe(screen);
                expect(snapshot.sequence).toBe(1);
                expect(snapshot.pendingEvents).toEqual([]);
            });

        });


        describe("later messages", () => {

            it("queues one batch for a Playing screen with events", () => {
                const { store, callbacks } = started();
                callbacks().onData(playing());
                callbacks().onData(playing(race(2), race(3)));
                expect(store.getSnapshot().pendingEvents.map((b) => b.events)).toEqual([
                    [race(2), race(3)]
                ]);
                expect(store.getSnapshot().sequence).toBe(2);
            });


            it("queues nothing for a message without events", () => {
                const { store, callbacks } = started();
                callbacks().onData(playing());
                callbacks().onData(playing());
                expect(store.getSnapshot().pendingEvents).toEqual([]);
                expect(store.getSnapshot().sequence).toBe(2);
            });


            it("queues nothing for a screen that is not Playing", () => {
                const { store, callbacks } = started();
                callbacks().onData(lobby);
                callbacks().onData(lobby);
                expect(store.getSnapshot().pendingEvents).toEqual([]);
            });


            it("keeps batches in order, each with a unique increasing id", () => {
                const { store, callbacks } = started();
                callbacks().onData(playing());
                callbacks().onData(playing(race(1)));
                callbacks().onData(playing());
                callbacks().onData(playing(race(2)));
                callbacks().onData(playing(race(3)));
                const batches = store.getSnapshot().pendingEvents;
                expect(batches.map((b) => b.events)).toEqual([[race(1)], [race(2)], [race(3)]]);
                const ids = batches.map((b) => b.id);
                expect(new Set(ids).size).toBe(3);
                expect([...ids].sort((a, b) => a - b)).toEqual(ids);
            });

        });


        describe("consumeEvents()", () => {

            it("removes only the named batch", () => {
                const { store, callbacks } = started();
                callbacks().onData(playing());
                callbacks().onData(playing(race(1)));
                callbacks().onData(playing(race(2)));
                callbacks().onData(playing(race(3)));
                const ids = store.getSnapshot().pendingEvents.map((b) => b.id);
                store.consumeEvents(ids[1]!);
                expect(store.getSnapshot().pendingEvents.map((b) => b.id)).toEqual([
                    ids[0],
                    ids[2]
                ]);
            });


            it("does not reuse the id of a consumed batch", () => {
                const { store, callbacks } = started();
                callbacks().onData(playing());
                callbacks().onData(playing(race(1)));
                const first = store.getSnapshot().pendingEvents[0]!.id;
                store.consumeEvents(first);
                callbacks().onData(playing(race(2)));
                expect(store.getSnapshot().pendingEvents[0]?.id).toBeGreaterThan(first);
            });


            it("changes nothing and notifies nobody for an unknown id", () => {
                const { store, callbacks } = started();
                callbacks().onData(playing());
                const before = store.getSnapshot();
                const listener = vi.fn();
                store.subscribe(listener);
                store.consumeEvents(999);
                expect(store.getSnapshot()).toBe(before);
                expect(listener).not.toHaveBeenCalled();
            });

        });


        describe("reconnecting", () => {

            it("is Reconnecting after a dropped connection and Live at the next message", () => {
                const { store, callbacks } = started();
                callbacks().onData(playing());
                callbacks().onConnectionStateChange(dropped);
                expect(store.getSnapshot().status).toBe("Reconnecting");
                callbacks().onData(playing());
                expect(store.getSnapshot().status).toBe("Live");
            });


            it("keeps the last screen while Reconnecting", () => {
                const { store, callbacks } = started();
                const screen = playing();
                callbacks().onData(screen);
                callbacks().onConnectionStateChange(dropped);
                const current = store.getSnapshot().screen;
                expect(current.isSome && current.value).toBe(screen);
            });


            it("treats the first message after a drop as a snapshot", () => {
                const { store, callbacks } = started();
                callbacks().onData(playing());
                callbacks().onData(playing(race(1)));
                callbacks().onConnectionStateChange(dropped);
                callbacks().onData(playing(race(2), race(3)));
                const snapshot = store.getSnapshot();
                expect(snapshot.pendingEvents.map((b) => b.events)).toEqual([[race(1)]]);
                expect(snapshot.sequence).toBe(3);
                expect(snapshot.status).toBe("Live");
            });


            it("queues events again from the second message after a drop", () => {
                const { store, callbacks } = started();
                callbacks().onData(playing());
                callbacks().onConnectionStateChange(dropped);
                callbacks().onData(playing(race(1)));
                callbacks().onData(playing(race(2)));
                expect(store.getSnapshot().pendingEvents.map((b) => b.events)).toEqual([[race(2)]]);
            });


            it("treats the message after a repeated drop as a snapshot once", () => {
                const { store, callbacks } = started();
                callbacks().onData(playing());
                callbacks().onConnectionStateChange(dropped);
                callbacks().onConnectionStateChange(dropped);
                callbacks().onData(playing(race(1)));
                callbacks().onData(playing(race(2)));
                expect(store.getSnapshot().pendingEvents.map((b) => b.events)).toEqual([[race(2)]]);
            });


            it("treats a transport error as a drop too", () => {
                const { store, callbacks } = started();
                callbacks().onData(playing());
                callbacks().onError(new TRPCClientError("The stream failed."));
                expect(store.getSnapshot().status).toBe("Reconnecting");
                callbacks().onData(playing(race(1)));
                expect(store.getSnapshot().pendingEvents).toEqual([]);
            });

        });


        describe("UNAUTHORIZED", () => {

            it("calls onUnauthorized once, unsubscribes and stops updating", () => {
                const { store, callbacks, onUnauthorized, unsubscribe } = started();
                callbacks().onData(playing());
                callbacks().onError(unauthorizedError);
                callbacks().onError(unauthorizedError);
                expect(onUnauthorized).toHaveBeenCalledTimes(1);
                expect(unsubscribe).toHaveBeenCalledTimes(1);

                const before = store.getSnapshot();
                callbacks().onData(playing());
                callbacks().onData(playing(race(1)));
                expect(store.getSnapshot()).toBe(before);
            });

        });


        describe("start()", () => {

            it("opens only one subscription when called twice", () => {
                const { store, subscribe } = makeStore();
                store.start();
                store.start();
                expect(subscribe).toHaveBeenCalledTimes(1);
            });


            it("does nothing after stop()", () => {
                const { store, subscribe } = makeStore();
                store.stop();
                store.start();
                expect(subscribe).not.toHaveBeenCalled();
            });

        });


        describe("stop()", () => {

            it("unsubscribes and ignores later messages and state changes", () => {
                const { store, callbacks, unsubscribe } = started();
                callbacks().onData(playing());
                store.stop();
                expect(unsubscribe).toHaveBeenCalledTimes(1);

                const before = store.getSnapshot();
                callbacks().onData(playing(race(1)));
                callbacks().onConnectionStateChange(dropped);
                callbacks().onError(new TRPCClientError("late"));
                expect(store.getSnapshot()).toBe(before);
            });


            it("unsubscribes only once when called twice", () => {
                const { store, unsubscribe } = started();
                store.stop();
                store.stop();
                expect(unsubscribe).toHaveBeenCalledTimes(1);
            });


            it("is harmless before start()", () => {
                const { store } = makeStore();
                expect(() => store.stop()).not.toThrow();
            });

        });


        describe("subscribe()", () => {

            it("notifies a listener once per change", () => {
                const { store, callbacks } = started();
                const listener = vi.fn();
                store.subscribe(listener);

                callbacks().onData(playing());
                expect(listener).toHaveBeenCalledTimes(1);

                callbacks().onData(playing(race(1)));
                expect(listener).toHaveBeenCalledTimes(2);

                callbacks().onConnectionStateChange(dropped);
                expect(listener).toHaveBeenCalledTimes(3);

                // Already Reconnecting: nothing changed.
                callbacks().onConnectionStateChange(dropped);
                expect(listener).toHaveBeenCalledTimes(3);

                store.consumeEvents(store.getSnapshot().pendingEvents[0]?.id ?? -1);
                expect(listener).toHaveBeenCalledTimes(4);
            });


            it("stops notifying after the returned function is called", () => {
                const { store, callbacks } = started();
                const listener = vi.fn();
                const unsubscribe = store.subscribe(listener);
                unsubscribe();
                callbacks().onData(playing());
                expect(listener).not.toHaveBeenCalled();
            });

        });


        describe("getSnapshot()", () => {

            it("returns the same object until something changes", () => {
                const { store, callbacks } = started();
                const first = store.getSnapshot();
                expect(store.getSnapshot()).toBe(first);

                callbacks().onData(playing());
                const second = store.getSnapshot();
                expect(second).not.toBe(first);
                expect(store.getSnapshot()).toBe(second);

                // Unchanged status: no new snapshot.
                callbacks().onConnectionStateChange(pending);
                expect(store.getSnapshot()).toBe(second);
            });

        });

    });

});
