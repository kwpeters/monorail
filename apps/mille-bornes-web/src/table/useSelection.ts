import { NoneOption, SomeOption, type Option } from "@repo/depot/option";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { useCallback, useEffect, useState } from "react";
import { reduceSelection, type Selection, type SelectionAction } from "./playController.mjs";
import type { SetOverride } from "./useOverrideMessage.js";


/** What `useSelection` returns. */
export interface SelectionState {
    /** The picked-up card; Nothing once the screen has moved on under it. */
    selection: Selection;
    dispatch:  (action: SelectionAction) => void;
}


interface Held {
    readonly selection: Selection;
    /** The view the selection was made in. */
    readonly at:        PlayerView;
}


const nothing: Selection = { kind: "Nothing" };
const staleMessageMs = 3000;


// A selection holds while the phase (whose turn, which window) and the hand
// stay the same.
function sameMoment(a: PlayerView, b: PlayerView): boolean {
    return a === b || JSON.stringify([a.phase, a.me.hand]) === JSON.stringify([b.phase, b.me.hand]);
}


// What to say when a selection is dropped because the game moved on.
function staleMessage(at: PlayerView, now: PlayerView): Option<string> {
    if (at.phase.kind === "HazardIncoming" || at.phase.kind === "ExtensionOffer") {
        return new SomeOption("That window closed.");
    }
    const stillMine = now.phase.kind === "Turn" && now.phase.player === now.me.id;
    return stillMine ? NoneOption.get() : new SomeOption("It is no longer your turn.");
}


/**
 * Holds the picked-up card.  When a new screen changes the phase, the turn
 * or the hand under a selection, the selection is dropped at once (it is
 * never shown against the new screen) and the top bar says why.
 * @param view - The viewer's current view
 * @param setOverride - Shows a transient top bar message
 * @returns The selection and the way to change it
 */
export function useSelection(view: PlayerView, setOverride: SetOverride): SelectionState {
    const [held, setHeld] = useState<Held>({ selection: nothing, at: view });
    const stale = held.selection.kind === "Card" && !sameMoment(held.at, view);

    useEffect(() => {
        if (stale) {
            const message = staleMessage(held.at, view);
            if (message.isSome) {
                setOverride(message.value, "Info", staleMessageMs);
            }
            setHeld({
                selection: reduceSelection(held.selection, { type: "ScreenChanged" }),
                at:        view,
            });
        }
    }, [stale, held, view, setOverride]);

    const dispatch = useCallback((action: SelectionAction): void => {
        setHeld((h) => ({
            selection: reduceSelection(sameMoment(h.at, view) ? h.selection : nothing, action),
            at:        view,
        }));
    }, [view]);

    return { selection: stale ? nothing : held.selection, dispatch };
}
