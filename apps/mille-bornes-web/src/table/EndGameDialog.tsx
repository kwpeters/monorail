import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import type { Api } from "../api/client.mjs";
import { voidWire } from "../api/outcomes.mjs";
import { ShellControls } from "../screens/Shell.js";


/** What `EndGameDialog` needs. */
export interface EndGameDialogProps {
    api: Api;
}


/**
 * The organizer's way to end the game for everyone: an End game control in
 * the shell's header and a native confirmation dialog, which opens with
 * Keep playing focused (not the destructive button), closes on Escape
 * without acting, and returns focus to the control.  Confirming closes the
 * dialog first and then calls `game.end` once, so a refusal shows in the
 * page (a `role="alert"` message where this is rendered) and not behind the
 * dialog.  Success moves everyone to the lobby through the subscription.
 * Render it only for the organizer.
 * @param props - The API
 * @returns The control, the dialog and the refusal, if any
 */
export function EndGameDialog(props: EndGameDialogProps): ReactElement {
    const { api } = props;
    const dialog = useRef<HTMLDialogElement>(null);
    const trigger = useRef<HTMLButtonElement>(null);
    const keepButton = useRef<HTMLButtonElement>(null);
    const refocusTrigger = useRef(false);
    const titleId = useId();
    const [message, setMessage] = useState<Option<string>>(NoneOption.get());
    const [busy, setBusy] = useState(false);

    // Set before the first await: two taps in the same tick send one request.
    const inFlight = useRef(false);

    // The control is disabled while the request is in flight, which drops
    // focus to the page; a refusal puts it back.
    useEffect(() => {
        if (!busy && refocusTrigger.current) {
            refocusTrigger.current = false;
            trigger.current?.focus();
        }
    }, [busy]);

    const end = async (): Promise<void> => {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        refocusTrigger.current = true;
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
            <ShellControls>
                <button
                    ref={trigger}
                    type="button"
                    className="button danger shell-button"
                    disabled={busy}
                    onClick={() => {
                        dialog.current?.showModal();
                        // Not the destructive button, which showModal() focuses
                        // first.
                        keepButton.current?.focus();
                    }}
                >
                    End game
                </button>
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
            </ShellControls>
            {message.isSome ? <p className="error" role="alert">{message.value}</p> : null}
        </>
    );
}
