import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import {
    forwardRef, useEffect, useId, useImperativeHandle, useRef, useState, type ReactElement
} from "react";
import type { Api } from "../api/client.mjs";
import { voidWire } from "../api/outcomes.mjs";


/** What `EndGameDialog` needs. */
export interface EndGameDialogProps {
    api: Api;
}


/** What a parent can do with an `EndGameDialog`, through its `ref`. */
export interface EndGameHandle {
    /**
     * Opens the question with Keep playing focused.  Whatever has focus now
     * is where focus goes back to when the question closes.
     */
    open(): void;
}


/**
 * The organizer's way to end the game for everyone: a native confirmation
 * dialog, which opens with Keep playing focused (not the destructive
 * button), closes on Escape without acting, and returns focus to the control
 * that had it when the dialog opened.  The control is the parent's (the
 * table's menu), which calls `open()` on this component's `ref`.  Confirming
 * closes the dialog first and then calls `game.end` once, so a refusal shows
 * in the page (a `role="alert"` message where this is rendered) and not
 * behind the dialog.  Success moves everyone to the lobby through the
 * subscription.  Render it only for the organizer.
 * @param props - The API
 * @param ref - Receives the `EndGameHandle`
 * @returns The dialog and the refusal, if any
 */
export const EndGameDialog = forwardRef<EndGameHandle, EndGameDialogProps>(
    function EndGameDialog(props, ref): ReactElement {
        const { api } = props;
        const dialog = useRef<HTMLDialogElement>(null);
        const keepButton = useRef<HTMLButtonElement>(null);
        const opener = useRef<Element | null>(null);
        const refocusOpener = useRef(false);
        const titleId = useId();
        const [message, setMessage] = useState<Option<string>>(NoneOption.get());
        const [busy, setBusy] = useState(false);

        // Set before the first await: two taps in the same tick send one request.
        const inFlight = useRef(false);

        useImperativeHandle(ref, () => ({
            open: (): void => {
                opener.current = document.activeElement;
                dialog.current?.showModal();
                // Not the destructive button, which showModal() focuses first.
                keepButton.current?.focus();
            }
        }), []);

        // Confirming drops focus to the page; a refusal puts it back.
        useEffect(() => {
            if (!busy && refocusOpener.current) {
                refocusOpener.current = false;
                if (opener.current instanceof HTMLElement && opener.current.isConnected) {
                    opener.current.focus();
                }
            }
        }, [busy]);

        const end = async (): Promise<void> => {
            if (inFlight.current) {
                return;
            }
            inFlight.current = true;
            refocusOpener.current = true;
            setBusy(true);
            setMessage(NoneOption.get());
            try {
                const result = await api.call((t) => t.game.end.mutate(), voidWire);
                if (!result.succeeded) {
                    setMessage(new SomeOption(result.error));
                }
            }
            finally {
                // eslint-disable-next-line require-atomic-updates -- only cleared here
                inFlight.current = false;
                setBusy(false);
            }
        };

        // Closed first, so a refusal shows in the page and not behind the dialog.
        const confirm = (): void => {
            dialog.current?.close();
            void end();
        };

        return (
            <>
                <dialog ref={dialog} className="dialog" aria-labelledby={titleId}>
                    <h3 id={titleId}>End the game for everyone?</h3>
                    <p>Everyone goes back to the lobby.</p>
                    <div className="button-row">
                        <button type="button" className="button danger" onClick={confirm}>
                            End game
                        </button>
                        <button
                            ref={keepButton}
                            type="button"
                            className="button"
                            onClick={() => dialog.current?.close()}
                        >
                            Keep playing
                        </button>
                    </div>
                </dialog>
                {message.isSome ? <p className="error" role="alert">{message.value}</p> : null}
            </>
        );
    }
);
