import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import type { PlayerId } from "@repo/mille-bornes-core/ids";
import type { PendingSeatView, PendingView } from "@repo/mille-bornes-core/pendingView";
import type { Screen } from "@repo/mille-bornes-game-server/screens";
import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { type Api } from "../api/client.mjs";
import { voidWire } from "../api/outcomes.mjs";
import { TeamList } from "./TeamList.js";


/** The server's `Waiting` screen. */
export type WaitingData = Extract<Screen, { kind: "Waiting" }>;


/** What `WaitingScreen` needs. */
export interface WaitingScreenProps {
    screen: WaitingData;
    api:    Api;
}


type Length = PendingView["length"];


// Quick's trip distance depends on how many players there are, so the line
// gives no number of miles.
function formatLine(length: Length): string {
    switch (length) {
        case "Quick":
            return "Quick: one race, the first team to finish the trip wins";
        case "Short":
            return "Short: play races until a team reaches 2,000 points";
        case "Full":
            return "Full: play races until a team reaches 5,000 points";
    }
}


const lengths: ReadonlyArray<Length> = ["Quick", "Short", "Full"];


type Run = (fn: (t: Api["trpc"]) => Promise<unknown>) => Promise<void>;


/**
 * The waiting room: the organizer's variant, with the controls to shape and
 * start the game, or the joiner's, which only waits and may leave.  Names and
 * messages from the server are always rendered as text.  Starting, leaving or
 * cancelling moves players to another screen through the subscription, so
 * success needs no handling here; a refusal shows the server's message.
 * @param props - The Waiting screen and the API
 * @returns The screen
 */
export function WaitingScreen(props: WaitingScreenProps): ReactElement {
    const { screen, api } = props;
    const { pending } = screen;
    const [message, setMessage] = useState<Option<string>>(NoneOption.get());
    const [busy, setBusy] = useState(false);

    // Set before the first await: two taps in the same tick send one request.
    const inFlight = useRef(false);

    const run: Run = async (fn) => {
        if (inFlight.current) {
            return;
        }
        inFlight.current = true;
        setBusy(true);
        setMessage(NoneOption.get());
        try {
            const result = await api.call(fn, voidWire);
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

    return (
        <section className="screen">
            {pending.isOrganizer ?
                <OrganizerRoom pending={pending} busy={busy} run={run} /> :
                <JoinerRoom pending={pending} busy={busy} run={run} />}
            {message.isSome ? <p className="error" role="alert">{message.value}</p> : null}
        </section>
    );
}


interface RoomProps {
    pending: PendingView;
    busy:    boolean;
    run:     Run;
}


function JoinerRoom(props: RoomProps): ReactElement {
    const { pending, busy, run } = props;
    const organizer = Option.fromNullable(pending.seats.find((s) => s.isOrganizer));
    return (
        <>
            <h2>Waiting room</h2>
            <p role="status" className="waiting-line">
                Waiting for{" "}
                {organizer.isSome ?
                    <span className="truncate waiting-name">{organizer.value.name}</span> :
                    "the organizer"}
                {" "}to start the game...
            </p>
            <p className="format">{formatLine(pending.length)}</p>
            <TeamList
                seats={pending.seats}
                showKinds={false}
                hint={pending.start.ok ? NoneOption.get() : new SomeOption(pending.start.reason)}
            />
            <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => void run((t) => t.pending.leave.mutate())}
            >
                Leave game
            </button>
        </>
    );
}


function OrganizerRoom(props: RoomProps): ReactElement {
    const { pending, busy, run } = props;
    const dialog = useRef<HTMLDialogElement>(null);
    const cancelTrigger = useRef<HTMLButtonElement>(null);
    const keepButton = useRef<HTMLButtonElement>(null);
    const refocusTrigger = useRef(false);
    const dialogTitle = useId();
    const [swapping, setSwapping] = useState(false);
    const [picked, setPicked] = useState<Option<PlayerId>>(NoneOption.get());

    // A seat that has left since it was tapped is no longer picked.
    const first = picked.isSome && pending.seats.some((s) => s.id === picked.value) ?
        picked :
        NoneOption.get();

    const stopSwapping = (): void => {
        setSwapping(false);
        setPicked(NoneOption.get());
    };

    // The trigger is disabled while the cancel request is in flight, which
    // drops focus to the page; a refusal puts it back.
    useEffect(() => {
        if (!busy && refocusTrigger.current) {
            refocusTrigger.current = false;
            cancelTrigger.current?.focus();
        }
    }, [busy]);

    useEffect(() => {
        if (!swapping) {
            return undefined;
        }
        const onKeyDown = (e: KeyboardEvent): void => {
            // Escape closes the dialog first, not swap mode behind it.
            if (e.key === "Escape" && !dialog.current?.open) {
                setSwapping(false);
                setPicked(NoneOption.get());
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [swapping]);

    const tapSeat = (id: PlayerId): void => {
        if (first.isNone) {
            setPicked(new SomeOption(id));
        }
        else if (first.value === id) {
            setPicked(NoneOption.get());
        }
        else {
            const a = first.value;
            stopSwapping();
            void run((t) => t.pending.swapSeats.mutate({ a, b: id }));
        }
    };

    const seatActions = (seat: PendingSeatView): ReactElement | null => {
        if (swapping) {
            const isFirst = first.isSome && first.value === seat.id;
            return (
                <button
                    type="button"
                    className={isFirst ? "button selected" : "button"}
                    aria-pressed={isFirst}
                    aria-label={`Swap ${seat.name}`}
                    disabled={busy}
                    onClick={() => tapSeat(seat.id)}
                >
                    Swap
                </button>
            );
        }
        // The organizer cannot remove their own seat; cancelling ends the game.
        if (seat.isMe) {
            return null;
        }
        return (
            <button
                type="button"
                className="button"
                aria-label={`Remove ${seat.name}`}
                disabled={busy}
                onClick={() => void run((t) => t.pending.removeSeat.mutate({ seat: seat.id }))}
            >
                Remove
            </button>
        );
    };

    // Closed first, so a refusal shows in the page and not behind the dialog.
    const confirmCancel = (): void => {
        dialog.current?.close();
        refocusTrigger.current = true;
        void run((t) => t.pending.cancel.mutate());
    };

    return (
        <>
            <h2>Your game</h2>
            <div role="group" aria-label="Game length" className="length-picker">
                {lengths.map((length) => (
                    <button
                        key={length}
                        type="button"
                        className={length === pending.length ? "button selected" : "button"}
                        aria-pressed={length === pending.length}
                        disabled={busy}
                        onClick={() => {
                            if (length !== pending.length) {
                                void run((t) => t.pending.setLength.mutate({ length }));
                            }
                        }}
                    >
                        {length === pending.length ?
                            <span aria-hidden="true">{"✓ "}</span> :
                            null}
                        {length}
                    </button>
                ))}
            </div>
            <p className="format">{formatLine(pending.length)}</p>
            <TeamList
                seats={pending.seats}
                showKinds={true}
                hint={NoneOption.get()}
                actions={seatActions}
            />
            {swapping ?
                <div className="button-row">
                    <p className="hint grow">
                        {first.isSome ? "Now tap the seat to swap with." : "Tap a seat to swap."}
                    </p>
                    <button type="button" className="button" onClick={stopSwapping}>
                        Cancel swap
                    </button>
                </div> :
                <div className="button-row">
                    <button
                        type="button"
                        className="button"
                        disabled={busy}
                        onClick={() => void run((t) => t.pending.addRobot.mutate())}
                    >
                        Add a robot
                    </button>
                    <button
                        type="button"
                        className="button"
                        disabled={busy || pending.seats.length < 2}
                        onClick={() => setSwapping(true)}
                    >
                        Swap seats
                    </button>
                </div>}
            <p className="hint" role="status">{pending.start.ok ? null : pending.start.reason}</p>
            <button
                type="button"
                className="button primary big"
                disabled={busy || !pending.start.ok}
                onClick={() => void run((t) => t.pending.start.mutate())}
            >
                Start game
            </button>
            <button
                ref={cancelTrigger}
                type="button"
                className="button danger"
                disabled={busy}
                onClick={() => {
                    dialog.current?.showModal();
                    // Not the destructive button, which showModal() focuses first.
                    keepButton.current?.focus();
                }}
            >
                Cancel game
            </button>
            <dialog ref={dialog} className="dialog" aria-labelledby={dialogTitle}>
                <h3 id={dialogTitle}>Cancel this game?</h3>
                <p>Everyone goes back to the lobby.</p>
                <div className="button-row">
                    <button type="button" className="button danger" onClick={confirmCancel}>
                        Cancel the game
                    </button>
                    <button
                        ref={keepButton}
                        type="button"
                        className="button"
                        onClick={() => dialog.current?.close()}
                    >
                        Keep the game
                    </button>
                </div>
            </dialog>
        </>
    );
}
