import { NoneOption } from "@repo/depot/option";
import { vi, type Mock } from "vitest";
import type { ScreenStore, Snapshot } from "../state/screenStore.mjs";


// Test support: never import this from production code.


/** A `ScreenStore` a test drives by hand. */
export interface FakeStore extends ScreenStore {
    start: Mock<() => void>;
    stop:  Mock<() => void>;

    /**
     * Replaces parts of the snapshot and notifies listeners (wrap in `act`).
     * @param changes - The fields to change
     */
    set: (changes: Partial<Snapshot>) => void;
}


/**
 * Makes a store that never talks to a server.
 * @param initial - Parts of the first snapshot (default: no screen, Connecting)
 * @returns The store
 */
export function createFakeStore(initial: Partial<Snapshot> = {}): FakeStore {
    let snapshot: Snapshot = {
        screen:        NoneOption.get(),
        status:        "Connecting",
        sequence:      0,
        pendingEvents: [],
        ...initial
    };
    const listeners = new Set<() => void>();

    return {
        getSnapshot: () => snapshot,
        subscribe:   (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        start:         vi.fn<() => void>(),
        stop:          vi.fn<() => void>(),
        consumeEvents: vi.fn<(id: number) => void>(),
        set:           (changes) => {
            snapshot = { ...snapshot, ...changes };
            [...listeners].forEach((listener) => listener());
        }
    };
}
