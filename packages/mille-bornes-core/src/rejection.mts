import { type BlockingHazard, type HazardCard, type RemedyCard, type SafetyCard, remedyFor } from "./card.mjs";
import { type Miles } from "./miles.mjs";


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
    | { reason: "SafetyAlreadyPlayed"; safety: SafetyCard };


function formatMiles(miles: Miles): string {
    return miles.toLocaleString("en-US");
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
            return `Your car is blocked by a ${r.hazard} card. Play ${remedyFor(r.hazard)} to fix it first.`;
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
    }
}
