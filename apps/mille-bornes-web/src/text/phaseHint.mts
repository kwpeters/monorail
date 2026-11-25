import { safetyFor } from "@repo/mille-bornes-core/card";
import { type PlayerView } from "@repo/mille-bornes-core/view";
import { z } from "zod";
import { cardFace } from "./cardFace.mjs";
import { describeRaceResult } from "./describeEvent.mjs";
import { describeTeamName, nameOf, subjectOf, teamLabel } from "./teamName.mjs";


/** How the top bar message should look. */
export const topBarToneSchema = z.enum(["MyTurn", "Waiting", "Alert", "Info"]);
export type TopBarTone = z.infer<typeof topBarToneSchema>;


/** The text and tone of the top bar. */
export interface TopBarMessage {
    readonly text: string;
    readonly tone: TopBarTone;
}


/** What the decider of an Extension offer is asked. */
export const extensionQuestion = "Stop here, or race on to 1,000?";


/** The risk of calling Extension, in one sentence. */
export const extensionRisk = "If you do not get there first, every other team scores 200.";


/** The server's hazard window length, in seconds, when the caller gives none. */
const defaultWindowSeconds = 5;


/**
 * Gets what the top bar says for the game's current phase.  A hazard window
 * is the only place the text depends on the team: the target team is told
 * which safety could answer, and everyone else hears only what was played,
 * so the text never hints at who holds a counter.
 * @param view - The viewer's view
 * @param windowSeconds - The hazard window length (default 5)
 * @returns The text and its tone
 */
export function topBarMessage(
    view: PlayerView,
    windowSeconds: number = defaultWindowSeconds
): TopBarMessage {
    const { phase } = view;
    switch (phase.kind) {
        case "Turn":
            return phase.player === view.me.id ?
                { text: "Your turn: play or discard a card", tone: "MyTurn" } :
                { text: `Waiting for ${nameOf(view, phase.player)} to play`, tone: "Waiting" };
        case "HazardIncoming": {
            const hazard = cardFace(phase.hazard).label;
            if (phase.target !== view.me.team) {
                return {
                    text: `${subjectOf(view, phase.attacker)} played ${hazard} on ` +
                        `${teamLabel(phase.target)}.`,
                    tone: "Info",
                };
            }
            const seconds = `${windowSeconds} ${windowSeconds === 1 ? "second" : "seconds"}`;
            const safety = cardFace(safetyFor(phase.hazard)).label;
            return {
                text: `${hazard}! You have ${seconds}. ` +
                    `If anyone on your team holds ${safety}, play it now.`,
                tone: "Alert",
            };
        }
        case "ExtensionOffer":
            return phase.decider === view.me.id ?
                {
                    text: `You reached 700 miles! ${extensionQuestion} ${extensionRisk}`,
                    tone: "MyTurn",
                } :
                {
                    text: `${nameOf(view, phase.decider)} is deciding whether to go for 1,000`,
                    tone: "Info",
                };
        case "RaceOver":
            return {
                text: `Race over! ${describeRaceResult(phase.result, view.me.team)}`,
                tone: "Info",
            };
        case "GameOver":
            return {
                text: `Game over! ${describeTeamName(view, phase.winner)} wins. Congratulations!`,
                tone: "Info",
            };
    }
}
