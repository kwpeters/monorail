import { NoneOption } from "@repo/depot/option";
import { chooseCommand } from "./bot.mjs";
import { type PlayerCommand } from "./commands.mjs";
import { type Game, type PlayerState } from "./game.mjs";
import { type PlayerId } from "./ids.mjs";
import { viewFor } from "./view.mjs";


/**
 * Gets the seats the phase lets decide.
 * @param g - The game
 * @returns The seats, in turn order: the player on turn (Turn), every seat of
 * the target team (HazardIncoming), the decider (ExtensionOffer), or none
 * (RaceOver, GameOver)
 */
export function deciders(g: Game): ReadonlyArray<PlayerState> {
    const phase = g.phase;
    switch (phase.kind) {
        case "Turn":
            return g.players.filter((p) => p.seat.id === phase.player);
        case "HazardIncoming":
            return g.players.filter((p) => p.team === phase.target);
        case "ExtensionOffer":
            return g.players.filter((p) => p.seat.id === phase.decider);
        case "RaceOver":
        case "GameOver":
            return [];
    }
}


/**
 * Asks every robot seat the phase lets decide what it would play.
 * @param g - The game
 * @param rand - Breaks ties between equally good plays (default: the robot's
 * own `getRandom`)
 * @returns One entry per robot seat that has a decision to make, in turn
 * order; seats with no decision (a robot with no Coup Fourre to play, say) are
 * omitted.  Every command is one of the seat's legal plays.
 */
export function robotMoves(
    g: Game,
    rand?: () => number
): ReadonlyArray<{ by: PlayerId; cmd: PlayerCommand }> {
    return deciders(g)
    .filter((p) => p.seat.kind === "Robot")
    .flatMap(({ seat }) => {
        const view = viewFor(g, seat.id);
        const cmd = view.succeeded ? chooseCommand(view.value, rand) : NoneOption.get();
        return cmd.isNone ? [] : [{ by: seat.id, cmd: cmd.value }];
    });
}
