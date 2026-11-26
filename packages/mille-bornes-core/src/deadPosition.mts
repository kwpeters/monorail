import { type Game } from "./game.mjs";
import { legalPlays, viewFor } from "./view.mjs";


/**
 * Determines whether a race is dead: the draw pile is empty and no player has
 * any play other than a Discard.  With an empty draw pile only plays change
 * the game, and a discard changes nothing the rules look at, so a play that
 * is illegal for everyone now can never become legal; the rest of the race
 * would only be discards, which do not change the score.
 *
 * Every player who holds cards is asked as if it were their turn, whoever's
 * turn it is.  The check is meant for the moment a turn would start, so the
 * game's phase is not used.
 * @param g - The game
 * @returns True when the draw pile is empty and no player holds a card that
 * can be driven, played as a remedy or a safety, or used to attack
 */
export function isDeadPosition(g: Game): boolean {
    return g.drawPile.length === 0 && !g.players.some((p) => {
        const view = viewFor(g, p.seat.id);
        return view.succeeded &&
            legalPlays({ ...view.value, phase: { kind: "Turn", player: p.seat.id } })
            .some((c) => c.type !== "Discard");
    });
}
