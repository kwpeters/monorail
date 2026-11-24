import {
    type Card, type DistanceCard, type HazardCard, type RemedyCard, type SafetyCard
} from "./card.mjs";
import { type RaceResult } from "./game.mjs";
import { type PlayerId, type TeamIndex } from "./ids.mjs";


/**
 * A public fact about what just happened in a game.  `CardDrawn.card` is the
 * card drawn, or null in a copy shown to someone other than the drawer.
 */
export type GameEvent =
    | { readonly type: "RaceDealt"; readonly race: number }
    | { readonly type: "TurnStarted"; readonly player: PlayerId }
    | { readonly type: "CardDrawn"; readonly player: PlayerId; readonly card: Card | null }
    | {
        readonly type:   "DistancePlayed";
        readonly player: PlayerId;
        readonly card:   DistanceCard;
        readonly team:   TeamIndex;
    }
    | {
        readonly type:       "HazardPlayed";
        readonly player:     PlayerId;
        readonly card:       HazardCard;
        readonly targetTeam: TeamIndex;
    }
    | { readonly type: "HazardLanded"; readonly card: HazardCard; readonly targetTeam: TeamIndex }
    | {
        readonly type:   "RemedyPlayed";
        readonly player: PlayerId;
        readonly card:   RemedyCard;
        readonly team:   TeamIndex;
    }
    | {
        readonly type:   "SafetyPlayed";
        readonly player: PlayerId;
        readonly card:   SafetyCard;
        readonly team:   TeamIndex;
    }
    | {
        readonly type:   "CoupFourrePlayed";
        readonly player: PlayerId;
        readonly card:   SafetyCard;
        readonly team:   TeamIndex;
        readonly hazard: HazardCard;
    }
    | { readonly type: "CardDiscarded"; readonly player: PlayerId; readonly card: Card }
    | { readonly type: "ExtensionOffered"; readonly player: PlayerId; readonly team: TeamIndex }
    | { readonly type: "ExtensionCalled"; readonly player: PlayerId; readonly team: TeamIndex }
    | { readonly type: "ExtensionDeclined"; readonly player: PlayerId; readonly team: TeamIndex }
    | { readonly type: "RaceEnded"; readonly result: RaceResult }
    | { readonly type: "GameEnded"; readonly winner: TeamIndex };
