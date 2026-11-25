import { type Option } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import type { ReactElement } from "react";
import { CardView } from "./CardView.js";


/** What `Piles` shows. */
export interface PilesProps {
    drawPileCount: number;
    discardTop:    Option<Card>;
    /** Discards the picked-up card, when the rules allow it. */
    onDiscard:     Option<() => void>;
}


/**
 * The draw pile with its card count and the discard pile showing its top
 * card, or an empty state.  While a card that can be discarded is picked up,
 * the discard pile has a Discard button.
 * @param props - The draw pile count, the top of the discard pile and the
 * discard
 * @returns The two piles
 */
export function Piles(props: PilesProps): ReactElement {
    const { drawPileCount, discardTop, onDiscard } = props;
    return (
        <div className="piles">
            <div
                className="pile draw"
                role="img"
                aria-label={`Draw pile, ${drawPileCount} ${drawPileCount === 1 ? "card" : "cards"}`}
                data-anim-anchor="draw-pile"
            >
                <span>Draw</span>
                <span className="pile-count">{drawPileCount}</span>
            </div>
            <div
                className={onDiscard.isSome ? "pile discard targeted" : "pile discard"}
                role="group"
                aria-label={discardTop.isSome ? "Discard pile" : "Discard pile, empty"}
                data-anim-anchor="discard-pile"
            >
                {discardTop.isSome ? <CardView card={discardTop.value} /> : null}
                {discardTop.isNone && onDiscard.isNone ? <span>Discard</span> : null}
                {onDiscard.isSome ?
                    <button
                        type="button"
                        className="button primary pile-target"
                        onClick={onDiscard.value}
                    >
                        Discard
                    </button> :
                    null}
            </div>
        </div>
    );
}
