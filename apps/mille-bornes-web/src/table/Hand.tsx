import type { Card } from "@repo/mille-bornes-core/card";
import { useId, type ReactElement } from "react";
import { CardView } from "./CardView.js";


/** What `Hand` shows. */
export interface HandProps {
    cards: ReadonlyArray<Card>;
}


/**
 * The viewer's cards, in hand order.  The row wraps on narrow screens, so
 * nothing is clipped.
 * @param props - The cards
 * @returns The hand
 */
export function Hand(props: HandProps): ReactElement {
    const labelId = useId();
    return (
        <section className="hand" aria-labelledby={labelId} data-anim-anchor="hand">
            <h2 id={labelId} className="hand-label">Your hand</h2>
            <ul className="cards">
                {props.cards.map((card, i) => (
                    // A hand can hold the same card twice, so the position is part of the key.
                    <li key={`${i}-${card}`}>
                        <CardView card={card} />
                    </li>
                ))}
            </ul>
        </section>
    );
}
