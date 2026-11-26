import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import {
    useEffect, useId, useRef, useState, type MutableRefObject, type ReactElement
} from "react";
import { CardHelp } from "./CardHelp.js";
import { CardView } from "./CardView.js";


/** What `Hand` shows and what it reports. */
export interface HandProps {
    cards:    ReadonlyArray<Card>;
    /** The position of the picked-up card, if any. */
    selected: Option<number>;
    /** Whether a card has a play now; the others are dimmed. */
    playable: (card: Card) => boolean;
    /** Whether a card answers the hazard in flight; it glows. */
    counter:  (card: Card) => boolean;
    /** Plays the picked-up card, when its play needs no target. */
    onPlay:   Option<() => void>;
    /** A card was tapped (not long-pressed). */
    onTap:    (card: Card, index: number) => void;
}


const longPressMs = 500;
const moveTolerancePx = 10;


interface HandCardProps {
    card:        Card;
    /**
     * Set when a long press fires, so the click that follows the release is
     * not also a tap.  Shared by the hand, which clears it when the help
     * closes: a mouse release can land on the help, and that click never
     * reaches the card.
     */
    longPressed: MutableRefObject<boolean>;
    selected:    boolean;
    playable:    boolean;
    counter:     boolean;
    onTap:       () => void;
    onLongPress: (button: HTMLButtonElement) => void;
}


// One card as a toggle button.  A press held for 500 ms without moving opens
// the help instead of tapping; it works with a mouse, a pen and a finger.
function HandCard(props: HandCardProps): ReactElement {
    const { card, longPressed, selected, playable, counter, onTap, onLongPress } = props;
    const timer = useRef<number | undefined>(undefined);
    const start = useRef({ x: 0, y: 0 });

    const cancel = (): void => {
        window.clearTimeout(timer.current);
        timer.current = undefined;
    };

    useEffect(() => cancel, []);

    const classes = [
        "card-button",
        selected ? "selected" : "",
        playable ? "" : "dimmed",
        counter ? "counter" : "",
    ].filter((c) => c !== "").join(" ");

    return (
        <button
            type="button"
            className={classes}
            aria-pressed={selected}
            aria-disabled={playable ? undefined : "true"}
            onPointerDown={(e) => {
                cancel();
                longPressed.current = false;
                start.current = { x: e.clientX, y: e.clientY };
                const button = e.currentTarget;
                timer.current = window.setTimeout(() => {
                    timer.current = undefined;
                    longPressed.current = true;
                    onLongPress(button);
                }, longPressMs);
            }}
            onPointerMove={(e) => {
                const moved = Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y);
                if (moved > moveTolerancePx) {
                    cancel();
                }
            }}
            onPointerUp={cancel}
            onPointerCancel={cancel}
            onPointerLeave={cancel}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => {
                if (longPressed.current) {
                    longPressed.current = false;
                    return;
                }
                onTap();
            }}
        >
            <CardView card={card} />
            {/* The space keeps the badge a separate word in the button's name. */}
            {counter ? <>{" "}<span className="card-badge">Blocks it!</span></> : null}
        </button>
    );
}


interface Help {
    readonly card:   Card;
    /** Where the focus goes back to once the help closes. */
    readonly button: HTMLButtonElement;
}


/**
 * The viewer's cards, in hand order, as toggle buttons: tapping one reports
 * it, a long press explains it, and the picked-up card can show a Play
 * button and always shows a "What's this?" button (a question mark) that
 * explains it too (the way in for a keyboard, and for anyone who does not
 * know the long press).  The cards wrap on narrow screens, so nothing is
 * clipped; the buttons are a column beside them that is there even when
 * empty, so the cards stay put when a card is picked up.
 * @param props - The cards, their state and the handlers
 * @returns The hand
 */
export function Hand(props: HandProps): ReactElement {
    const { cards, selected, playable, counter, onPlay, onTap } = props;
    const labelId = useId();
    const [help, setHelp] = useState<Option<Help>>(NoneOption.get());
    const longPressed = useRef(false);
    const picked = selected.bind((i) => Option.fromNullable(cards[i]));

    const closeHelp = (): void => {
        longPressed.current = false;
        if (help.isSome) {
            help.value.button.focus();
        }
        setHelp(NoneOption.get());
    };

    return (
        <section className="hand" aria-labelledby={labelId} data-anim-anchor="hand">
            <h2 id={labelId} className="hand-label">Your hand</h2>
            <ul className="cards" aria-label="Cards">
                {cards.map((card, i) => (
                    // A hand can hold a card twice, so the position is in the key.
                    <li key={`${i}-${card}`}>
                        <HandCard
                            card={card}
                            longPressed={longPressed}
                            selected={selected.isSome && selected.value === i}
                            playable={playable(card)}
                            counter={counter(card)}
                            onTap={() => onTap(card, i)}
                            onLongPress={(button) => setHelp(new SomeOption({ card, button }))}
                        />
                    </li>
                ))}
            </ul>
            {/* Always there, so the cards stay put when a card is picked up. */}
            <div className="hand-actions">
                {picked.isSome ?
                    <>
                        {onPlay.isSome ?
                            <button type="button" className="button primary" onClick={onPlay.value}>
                                Play
                            </button> :
                            null}
                        <button
                            type="button"
                            className="button"
                            onClick={(e) => {
                                const button = e.currentTarget;
                                setHelp(new SomeOption({ card: picked.value, button }));
                            }}
                        >
                            <span aria-hidden="true">❓</span>
                            <span className="visually-hidden">What's this?</span>
                        </button>
                    </> :
                    null}
            </div>
            {help.isSome ? <CardHelp card={help.value.card} onClose={closeHelp} /> : null}
        </section>
    );
}
