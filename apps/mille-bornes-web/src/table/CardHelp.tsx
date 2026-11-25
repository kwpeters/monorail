import type { Card } from "@repo/mille-bornes-core/card";
import { useEffect, useId, useRef, type ReactElement } from "react";
import { cardFace } from "../text/cardFace.mjs";


/** What `CardHelp` shows. */
export interface CardHelpProps {
    card:    Card;
    /** Called once the dialog has closed, however it was closed. */
    onClose: () => void;
}


/**
 * A modal dialog that explains a card in one sentence.  It opens when it
 * mounts and closes with its Close button, Escape, or a tap on the backdrop.
 * @param props - The card and what to do once closed
 * @returns The dialog
 */
export function CardHelp(props: CardHelpProps): ReactElement {
    const { card, onClose } = props;
    const face = cardFace(card);
    const titleId = useId();
    const dialog = useRef<HTMLDialogElement>(null);
    // A tap on the backdrop counts only if it also started there: the
    // release of the long press that opened the dialog lands on it too.
    const downOnBackdrop = useRef(false);

    useEffect(() => {
        const el = dialog.current;
        // showModal() throws on a dialog that is already open.
        if (el && !el.open) {
            el.showModal();
        }
    }, []);

    return (
        <dialog
            ref={dialog}
            className="dialog card-help"
            aria-labelledby={titleId}
            onClose={onClose}
            // The body fills the dialog, so the dialog itself is hit only
            // through its backdrop.
            onPointerDown={(e) => {
                downOnBackdrop.current = e.target === e.currentTarget;
            }}
            onClick={(e) => {
                if (e.target === e.currentTarget && downOnBackdrop.current) {
                    e.currentTarget.close();
                }
                downOnBackdrop.current = false;
            }}
        >
            <div className="card-help-body">
                <h2 id={titleId}>{face.label}</h2>
                <p>{face.blurb}</p>
                <button
                    type="button"
                    className="button primary"
                    onClick={() => dialog.current?.close()}
                >
                    Close
                </button>
            </div>
        </dialog>
    );
}
