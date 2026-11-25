import { NoneOption, SomeOption, type Option } from "@repo/depot/option";
import type { PlayerId } from "@repo/mille-bornes-core/ids";
import type { PlayerView } from "@repo/mille-bornes-core/view";


/**
 * Gets the player the table should mark as being on turn.
 * @param view - The viewer's view
 * @returns The player to move, or the decider of an Extension offer; nobody
 * during a hazard window or after a race
 */
export function playerOnTurn(view: PlayerView): Option<PlayerId> {
    const { phase } = view;
    switch (phase.kind) {
        case "Turn":
            return new SomeOption(phase.player);
        case "ExtensionOffer":
            return new SomeOption(phase.decider);
        case "HazardIncoming":
        case "RaceOver":
        case "GameOver":
            return NoneOption.get();
    }
}
