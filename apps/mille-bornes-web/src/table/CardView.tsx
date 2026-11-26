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
 * miles in big digits.  A card with a short face label shows it, and its full
 * name is there for assistive tech.  The card's value is in `data-card`.  Only spans,
 * so the face can go inside a button.
 * @param props - The card
 * @returns The card
 */
export function CardView(props: CardViewProps): ReactElement {
    const face = cardFace(props.card);
    const distance = Option.fromNullable(
        distanceCardSchema.options.find((c) => c === props.card)
    );
    const shortLabel = Option.fromNullable(face.faceLabel);
    return (
        <span className={`card kind-${face.kind.toLowerCase()}`} data-card={props.card}>
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
                    {shortLabel.isSome ?
                        <>
                            <span className="card-label" aria-hidden="true">
                                {shortLabel.value}
                            </span>
                            <span className="visually-hidden">{face.label}</span>
                        </> :
                        <span className="card-label">{face.label}</span>}
                </>}
        </span>
    );
}
