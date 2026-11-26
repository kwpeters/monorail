import { Card } from "@repo/mille-bornes-core/card";
import { z } from "zod";


/** What sort of card a card is. */
export const cardKindSchema = z.enum(["Distance", "Hazard", "Remedy", "Safety"]);
export type CardKind = z.infer<typeof cardKindSchema>;


/** How a card looks and what the long-press help says about it. */
export interface CardFace {
    readonly emoji:      string;
    /** The rulebook name, or the miles for a distance card.  Unique. */
    readonly label:      string;
    /**
     * A shorter label for the card's face, when the label will not fit the
     * card's width.  Only the visible text; the label stays the name.
     */
    readonly faceLabel?: string;
    readonly kind:       CardKind;
    /** One plain sentence for a child, ending in a period. */
    readonly blurb:      string;
}


function distance(emoji: string, miles: number): CardFace {
    return {
        emoji,
        label: `${miles} miles`,
        kind:  "Distance",
        blurb: `Drive your car ${miles} miles closer to the finish.`,
    };
}


function hazard(emoji: string, label: string, blurb: string): CardFace {
    return { emoji, label, kind: "Hazard", blurb };
}


function remedy(emoji: string, label: string, blurb: string): CardFace {
    return { emoji, label, kind: "Remedy", blurb };
}


function safety(emoji: string, label: string, blurb: string): CardFace {
    return { emoji, label, kind: "Safety", blurb };
}


// A Record over Card, so a new card is a compile error until it has a face.
const faces: Readonly<Record<Card, CardFace>> = {
    [Card.dist25]:  distance("🛴", 25),
    [Card.dist50]:  distance("🚲", 50),
    [Card.dist75]:  distance("🚗", 75),
    [Card.dist100]: distance("🏎️", 100),
    [Card.dist200]: {
        ...distance("🚀", 200),
        blurb: "Drive 200 miles at once, but you can play only two of these per trip.",
    },
    [Card.accident]: hazard(
        "💥", "Accident",
        "Accident stops the team you play it on until they play a Repairs."
    ),
    [Card.outOfGas]: hazard(
        "🪫", "Out of Gas",
        "Out of Gas stops the team you play it on until they play a Gasoline."
    ),
    [Card.flatTire]: hazard(
        "💨", "Flat Tire",
        "Flat Tire stops the team you play it on until they play a Spare Tire."
    ),
    [Card.speedLimit]: hazard(
        "🐌", "Speed Limit",
        "Speed Limit lets the team you play it on use only 25- and 50-mile cards until " +
        "they play an End of Speed Limit."
    ),
    [Card.stop]: hazard(
        "🛑", "Stop",
        "Stop makes the team you play it on wait until they play a Roll."
    ),
    [Card.repairs]: remedy(
        "🔧", "Repairs",
        "Repairs fixes an Accident, and then your team needs a Roll to move again, " +
        "unless it has Right of Way."
    ),
    [Card.gasoline]: remedy(
        "⛽", "Gasoline",
        "Gasoline fixes Out of Gas, and then your team needs a Roll to move again, " +
        "unless it has Right of Way."
    ),
    [Card.spareTire]: remedy(
        "🛞", "Spare Tire",
        "Spare Tire fixes a Flat Tire, and then your team needs a Roll to move again, " +
        "unless it has Right of Way."
    ),
    [Card.endOfSpeedLimit]: {
        ...remedy(
            "🐇", "End of Speed Limit",
            "End of Speed Limit lets you play any distance card again after a Speed Limit."
        ),
        // The full name wraps to three lines and makes this card taller than
        // the rest.
        faceLabel: "End of Limit",
    },
    [Card.roll]: remedy(
        "🟢", "Roll",
        "Roll gets your car moving at the start of a race and after any fix."
    ),
    [Card.drivingAce]: safety(
        "🥇", "Driving Ace",
        "Driving Ace protects your team from Accidents for good, and fixes one you already have."
    ),
    [Card.extraTank]: safety(
        "🛢️", "Extra Tank",
        "Extra Tank protects your team from Out of Gas for good, and fixes it if you already are."
    ),
    [Card.punctureProof]: safety(
        "🛡️", "Puncture Proof",
        "Puncture Proof protects your team from Flat Tires for good, " +
        "and fixes one you already have."
    ),
    [Card.rightOfWay]: safety(
        "🚨", "Right of Way",
        "Right of Way protects your team from Stop and Speed Limit for good, " +
        "and you never need a Roll to start."
    ),
};


/**
 * Gets how a card looks and what to tell a child about it.  This is the one
 * place that maps a card to its face, so art can replace it later.
 * @param card - The card
 * @returns The card's emoji, label, kind and one-sentence help
 */
export function cardFace(card: Card): CardFace {
    return faces[card];
}


/**
 * Gets the text to show on a card's face: the short face label when the card
 * has one, otherwise its label.  The card's name stays `label` everywhere else.
 * @param card - The card
 * @returns The visible text for the card's face
 */
export function visibleLabel(card: Card): string {
    const face = cardFace(card);
    return face.faceLabel ?? face.label;
}
