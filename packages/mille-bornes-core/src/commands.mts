import {
    type Card, type DistanceCard, type HazardCard, type RemedyCard, type SafetyCard
} from "./card.mjs";
import { type ShuffledDeck } from "./deck.mjs";
import { type GameEvent } from "./events.mjs";
import { type Game } from "./game.mjs";
import { type TeamIndex } from "./ids.mjs";


/** A move a player asks to make. */
export type PlayerCommand =
    | { readonly type: "Drive"; readonly card: DistanceCard }
    | { readonly type: "Attack"; readonly card: HazardCard; readonly targetTeam: TeamIndex }
    | { readonly type: "Remedy"; readonly card: RemedyCard }
    | { readonly type: "PlaySafety"; readonly card: SafetyCard }
    | { readonly type: "Discard"; readonly card: Card }
    | { readonly type: "CoupFourre"; readonly card: SafetyCard }
    | { readonly type: "CallExtension" }
    | { readonly type: "DeclineExtension" };


/**
 * A command issued by the server: a timer expiring, or the next race being
 * dealt from a deck the server shuffled.
 */
export type SystemCommand =
    | { readonly type: "CloseHazardWindow" }
    | { readonly type: "CloseExtensionOffer" }
    | { readonly type: "StartNextRace"; readonly deck: ShuffledDeck };


/** The result of an accepted command: the new game and what happened. */
export interface Applied {
    readonly game:   Game;
    readonly events: ReadonlyArray<GameEvent>;
}
