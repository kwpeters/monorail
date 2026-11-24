import {
    type BlockingHazard, type Card, type HazardCard, type RemedyCard, type SafetyCard, remedyFor, safetyFor
} from "./card.mjs";
import { type Miles } from "./miles.mjs";
import { type PlayerName } from "./playerName.mjs";


/**
 * The reasons a play can be refused.  Each variant carries what is needed to
 * explain the refusal to a player (see `describeRejection()`).
 */
export type Rejection =
    | { reason: "NotRolling" }
    | { reason: "BlockedByHazard"; hazard: BlockingHazard }
    | { reason: "SpeedLimited" }
    | { reason: "WouldOvershoot"; remaining: Miles; trip: Miles }
    | { reason: "TooManyTwoHundreds" }
    | { reason: "RemedyNotNeeded"; card: RemedyCard }
    | { reason: "RollNotNeeded"; because: "AlreadyRolling" | "RightOfWay" }
    | { reason: "CannotAttackOwnTeam" }
    | { reason: "TargetNotMoving"; hazard: HazardCard }
    | { reason: "TargetProtected"; safety: SafetyCard }
    | { reason: "TargetAlreadySpeedLimited" }
    | { reason: "SafetyAlreadyPlayed"; safety: SafetyCard }
    | { reason: "NotYourTurn"; current: PlayerName }
    | { reason: "CardNotInHand"; card: Card }
    | { reason: "WrongPhase" }
    | { reason: "WindowOpen" }
    | { reason: "NoWindowOpen" }
    | { reason: "NotOnTargetTeam" }
    | { reason: "WrongSafetyForHazard"; hazard: HazardCard; card: SafetyCard }
    | { reason: "ExtensionOfferOpen"; decider: PlayerName }
    | { reason: "NoExtensionOffer" }
    | { reason: "NotTheCaller"; decider: PlayerName }
    | { reason: "MalformedCommand" }
    | { reason: "UnsupportedPlayerCount"; count: number }
    | { reason: "WrongDeck" };


function formatMiles(miles: Miles): string {
    return miles.toLocaleString("en-US");
}


function playerCountAdvice(count: number): string {
    if (count <= 0) {
        return "add players";
    }
    return count < 7 ? "add a robot" : "remove someone";
}


/**
 * Explains a rejection in plain English for brand-new players.
 * @param r - The rejection to explain
 * @returns A sentence describing why the play was refused
 */
export function describeRejection(r: Rejection): string {
    switch (r.reason) {
        case "NotRolling":
            return "You can't drive yet. Play a Roll card first.";
        case "BlockedByHazard":
            return `Your car is blocked by ${r.hazard}. Play ${remedyFor(r.hazard)} to fix it first.`;
        case "SpeedLimited":
            return "A speed limit is active: you can only play 25- or 50-mile cards until you play End of Speed Limit.";
        case "WouldOvershoot":
            return `That would take you past ${formatMiles(r.trip)} miles. ` +
                `You have ${formatMiles(r.remaining)} miles to go and must land on ${formatMiles(r.trip)} exactly.`;
        case "TooManyTwoHundreds":
            return "Each team can only play two 200-mile cards per race.";
        case "RemedyNotNeeded":
            return `You don't need ${r.card} right now: there is nothing for it to fix.`;
        case "RollNotNeeded":
            return r.because === "AlreadyRolling" ?
                "You are already rolling, so you don't need a Roll card." :
                "You have Right of Way, so you never need a Roll card.";
        case "CannotAttackOwnTeam":
            return "Hazards can only be played on opponents, not on your own team.";
        case "TargetNotMoving":
            return `${r.hazard} only works on a car that is moving, and that team is not moving right now.`;
        case "TargetProtected":
            return `That team has ${r.safety}, which protects them from this card.`;
        case "TargetAlreadySpeedLimited":
            return "That team already has a Speed Limit, so another one would do nothing.";
        case "SafetyAlreadyPlayed":
            return `You have already played ${r.safety}.`;
        case "NotYourTurn":
            return `It's ${r.current}'s turn. Please wait until it's yours.`;
        case "CardNotInHand":
            return `You don't have that card (${r.card}) in your hand.`;
        case "WrongPhase":
            return "You can't do that right now.";
        // Shown to every player, so it must not hint at whether anyone can
        // answer the hazard.
        case "WindowOpen":
            return "Please wait for the hazard card to finish being played.";
        case "NoWindowOpen":
            return "There is no hazard to answer with a Coup Fourré right now.";
        case "NotOnTargetTeam":
            return "Only the team that was hit by the hazard can answer it with a Coup Fourré.";
        case "WrongSafetyForHazard":
            return `${r.card} doesn't protect against ${r.hazard}. Only ${safetyFor(r.hazard)} can answer it.`;
        case "ExtensionOfferOpen":
            return `Please wait: ${r.decider} is deciding whether to call Extension.`;
        case "NoExtensionOffer":
            return "There is no Extension to decide on right now.";
        case "NotTheCaller":
            return `Only ${r.decider} can decide whether to call Extension.`;
        case "MalformedCommand":
            return "That isn't a move the game understands.";
        case "UnsupportedPlayerCount":
            return `Mille Bornes needs 2, 3, 4, or 6 players. You have ${r.count}, so ${playerCountAdvice(r.count)}.`;
        case "WrongDeck":
            return "That deck doesn't match the number of players in this game.";
    }
}
