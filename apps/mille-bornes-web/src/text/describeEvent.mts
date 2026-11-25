import { type Card } from "@repo/mille-bornes-core/card";
import { type GameEvent } from "@repo/mille-bornes-core/events";
import { type RaceResult } from "@repo/mille-bornes-core/game";
import { type PlayerId, type TeamIndex } from "@repo/mille-bornes-core/ids";
import { type PlayerView } from "@repo/mille-bornes-core/view";
import { cardFace } from "./cardFace.mjs";
import { nameOf, subjectOf, teamLabel } from "./teamName.mjs";


/**
 * Describes how a race ended in one short plain sentence.  The viewer's own
 * team is "Your team"; the others are "Team N".
 * @param result - The race's result
 * @param viewerTeam - The viewer's team
 * @returns For example "Team 2 completed the trip." or, for the viewer's own
 * team, "Your team completed the trip!"
 */
export function describeRaceResult(result: RaceResult, viewerTeam: TeamIndex): string {
    const { outcome } = result;
    if (outcome.kind === "TripCompleted") {
        return outcome.team === viewerTeam ?
            "Your team completed the trip!" :
            `${teamLabel(outcome.team)} completed the trip.`;
    }
    if (outcome.winner === "Tie") {
        return "The cards ran out, and it is a tie.";
    }
    return outcome.winner === viewerTeam ?
        "The cards ran out, and your team was farthest ahead!" :
        `The cards ran out, and ${teamLabel(outcome.winner)} was farthest ahead.`;
}


/**
 * Describes an event as one plain sentence.  The viewer's own moves read
 * "You played ..."; everyone else is named from `view.seats` ("Someone" if
 * the seat is missing).  Names are plain text: React escapes them at render.
 * @param e - The event
 * @param view - The viewer's view, which holds the names
 * @returns The sentence
 */
export function describeEvent(e: GameEvent, view: PlayerView): string {
    const who = (id: PlayerId): string => subjectOf(view, id);
    const label = (card: Card): string => cardFace(card).label;
    switch (e.type) {
        case "RaceDealt":
            return `Race ${e.race} is dealt.`;
        case "TurnStarted":
            return e.player === view.me.id ?
                "It's your turn." :
                `It's ${nameOf(view, e.player)}'s turn.`;
        case "CardDrawn":
            return e.card === null ?
                `${who(e.player)} drew a card.` :
                `${who(e.player)} drew ${label(e.card)}.`;
        case "DistancePlayed":
            return `${who(e.player)} drove ${label(e.card)}.`;
        case "HazardPlayed":
            return `${who(e.player)} played ${label(e.card)} on ${teamLabel(e.targetTeam)}.`;
        case "HazardLanded":
            return `${label(e.card)} hit ${teamLabel(e.targetTeam)}.`;
        case "RemedyPlayed":
        case "SafetyPlayed":
            return `${who(e.player)} played ${label(e.card)}.`;
        case "CoupFourrePlayed":
            return `${who(e.player)} blocked ${label(e.hazard)} with a Coup Fourre, ` +
                `playing ${label(e.card)}!`;
        case "CardDiscarded":
            return `${who(e.player)} discarded ${label(e.card)}.`;
        case "ExtensionOffered":
            return `${teamLabel(e.team)} reached 700 miles. ` +
                `${who(e.player)} can stop or go for 1,000.`;
        case "ExtensionCalled":
            return `${who(e.player)} called Extension: ${teamLabel(e.team)} is racing on to 1,000!`;
        case "ExtensionDeclined":
            return `${who(e.player)} chose to stop at 700 miles.`;
        case "RaceEnded":
            return `Race over! ${describeRaceResult(e.result, view.me.team)}`;
        case "GameEnded":
            return `${teamLabel(e.winner)} wins the game!`;
    }
}
