import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { act, render, screen } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { describe, expect, it, vi } from "vitest";
import type { Api } from "../api/client.mjs";
import { createScreenStore, type ScreenStore } from "./screenStore.mjs";
import { useScreen } from "./useScreen.js";


interface Callbacks {
    onData: (s: Screen) => void;
}


interface Harness {
    store:       ScreenStore;
    callbacks:   () => Callbacks;
    subscribe:   ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
}


function makeStore(): Harness {
    const captured: Callbacks[] = [];
    const unsubscribe = vi.fn();
    const subscribe = vi.fn((_input: unknown, callbacks: Callbacks) => {
        captured.push(callbacks);
        return { unsubscribe };
    });
    const api = { trpc: { watch: { subscribe } } } as unknown as Api;
    const store = createScreenStore({ api, onUnauthorized: () => undefined });
    const callbacks = (): Callbacks => {
        const last = captured[captured.length - 1];
        if (last === undefined) {
            throw new Error("The store has not subscribed yet.");
        }
        return last;
    };
    return { store, callbacks, subscribe, unsubscribe };
}


const lobby: Screen = { kind: "Lobby", notice: null, games: [] };


function Probe({ store }: { store: ScreenStore }): React.JSX.Element {
    const snapshot = useScreen(store);
    return (
        <p>
            {snapshot.status}
            {" "}
            {snapshot.screen.isSome ? snapshot.screen.value.kind : "none"}
        </p>
    );
}


// The usual wiring: the component that shows the screen runs the store.
function Running({ store }: { store: ScreenStore }): React.JSX.Element {
    useEffect(() => {
        store.start();
        return () => {
            store.stop();
        };
    }, [store]);
    return <Probe store={store} />;
}


describe("useScreen", () => {

    it("shows the snapshot and re-renders when a message arrives", () => {
        const { store, callbacks } = makeStore();
        store.start();

        render(<Probe store={store} />);
        expect(screen.getByText("Connecting none")).toBeInTheDocument();

        act(() => {
            callbacks().onData(lobby);
        });
        expect(screen.getByText("Live Lobby")).toBeInTheDocument();
    });


    it("stops listening to the store when the component unmounts", () => {
        const { store } = makeStore();
        const stopListening = vi.fn();
        const spied: ScreenStore = {
            ...store,
            subscribe: (listener) => {
                const off = store.subscribe(listener);
                return () => {
                    stopListening();
                    off();
                };
            }
        };

        const { unmount } = render(<Probe store={spied} />);
        expect(stopListening).not.toHaveBeenCalled();
        unmount();
        expect(stopListening).toHaveBeenCalledTimes(1);
    });


    it("closes the subscription when the component that runs the store unmounts", () => {
        const { store, subscribe, unsubscribe } = makeStore();
        const { unmount } = render(<Running store={store} />);
        expect(subscribe).toHaveBeenCalledTimes(1);
        unmount();
        expect(unsubscribe).toHaveBeenCalledTimes(1);
    });


    it("still receives screens under StrictMode's start, stop, start", () => {
        const { store, callbacks, subscribe, unsubscribe } = makeStore();
        render(
            <StrictMode>
                <Running store={store} />
            </StrictMode>
        );
        expect(subscribe).toHaveBeenCalledTimes(2);
        expect(unsubscribe).toHaveBeenCalledTimes(1);
        expect(screen.getByText("Connecting none")).toBeInTheDocument();

        act(() => {
            callbacks().onData(lobby);
        });
        expect(screen.getByText("Live Lobby")).toBeInTheDocument();
    });

});
