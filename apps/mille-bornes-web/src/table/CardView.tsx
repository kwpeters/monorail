import { Option } from "@repo/depot/option";
import { distanceCardSchema, distanceMiles, type Card } from "@repo/mille-bornes-core/card";
import type { ReactElement } from "react";
import { cardFace } from "../text/cardFace.mjs";


/** What `CardView` shows. */
export interface CardViewProps {
    card: Card;
}


/**
 * One card face: an emoji and the card's name, or for a distance card the
 * miles in big digits.  The card's value is in `data-card`.
 * @param props - The card
 * @returns The card
 */
export function CardView(props: CardViewProps): ReactElement {
    const face = cardFace(props.card);
    const distance = Option.fromNullable(
        distanceCardSchema.options.find((c) => c === props.card)
    );
    return (
        <div className={`card kind-${face.kind.toLowerCase()}`} data-card={props.card}>
            {distance.isSome ?
                <>
                    <span className="card-miles" aria-hidden="true">
                        {distanceMiles(distance.value)}
                    </span>
                    <span className="card-unit" aria-hidden="true">mi</span>
                    <span className="visually-hidden">{face.label}</span>
                </> :
                <>
                    <span className="card-emoji" aria-hidden="true">{face.emoji}</span>
                    <span className="card-label">{face.label}</span>
                </>}
        </div>
    );
}
