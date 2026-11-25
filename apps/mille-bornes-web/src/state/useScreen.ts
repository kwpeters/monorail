import { useSyncExternalStore } from "react";
import type { ScreenStore, Snapshot } from "./screenStore.mjs";


/**
 * Re-renders the calling component whenever the store changes.
 * @param store - The screen store
 * @returns The store's current snapshot
 */
export function useScreen(store: ScreenStore): Snapshot {
    return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
