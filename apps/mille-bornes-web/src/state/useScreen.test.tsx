import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Api } from "../api/client.mjs";
import { createScreenStore, type ScreenStore } from "./screenStore.mjs";
import { useScreen } from "./useScreen.js";


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


describe("useScreen", () => {

    it("shows the snapshot and re-renders when a message arrives", () => {
        let onData: ((s: Screen) => void) | undefined;
        const subscribe = vi.fn((_input: unknown, callbacks: { onData: (s: Screen) => void }) => {
            onData = callbacks.onData;
            return { unsubscribe: () => undefined };
        });
        const api = { trpc: { watch: { subscribe } } } as unknown as Api;
        const store = createScreenStore({ api, onUnauthorized: () => undefined });
        store.start();

        render(<Probe store={store} />);
        expect(screen.getByText("Connecting none")).toBeInTheDocument();

        act(() => {
            onData?.({ kind: "Lobby", notice: null, games: [] });
        });
        expect(screen.getByText("Live Lobby")).toBeInTheDocument();
    });

});
