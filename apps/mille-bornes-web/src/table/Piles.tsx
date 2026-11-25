import { type Option } from "@repo/depot/option";
import type { Card } from "@repo/mille-bornes-core/card";
import type { ReactElement } from "react";
import { CardView } from "./CardView.js";


/** What `Piles` shows. */
export interface PilesProps {
    drawPileCount: number;
    discardTop:    Option<Card>;
}


/**
 * The draw pile with its card count and the discard pile showing its top
 * card, or an empty state.
 * @param props - The draw pile count and the top of the discard pile
 * @returns The two piles
 */
export function Piles(props: PilesProps): ReactElement {
    const { drawPileCount, discardTop } = props;
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
                className="pile discard"
                role="group"
                aria-label={discardTop.isSome ? "Discard pile" : "Discard pile, empty"}
                data-anim-anchor="discard-pile"
            >
                {discardTop.isSome ? <CardView card={discardTop.value} /> : <span>Discard</span>}
            </div>
        </div>
    );
}
