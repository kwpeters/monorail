import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { type Card, type HazardCard } from "./card.mjs";
import { type PlayerCommand } from "./commands.mjs";
import {
    playDistance, playRemedy, playSafety, type DrivingZone, type ZoneChange
} from "./drivingZone.mjs";
import { type Game } from "./game.mjs";
import { type PlayerId, type TeamIndex } from "./ids.mjs";
import { type Miles } from "./miles.mjs";
import { type PlayerName } from "./playerName.mjs";
import { type Rejection } from "./rejection.mjs";
import { tripDistance } from "./variant.mjs";


/**
 * Everything that decides whether a player's command is allowed: the
 * player's hand, every zone, the trip distance and what the game is waiting
 * for.  Built from a full game (`contextFromGame()`) or from what one player
 * can see.
 */
export interface PlayContext {
    readonly me:           PlayerId;
    readonly myTeam:       TeamIndex;
    readonly hand:         ReadonlyArray<Card>;
    /** Indexed by TeamIndex. */
    readonly zones:        ReadonlyArray<DrivingZone>;
    /** The trip distance currently in force. */
    readonly tripDistance: Miles;
    readonly phase:
        | { readonly kind: "Turn"; readonly player: PlayerId; readonly playerName: PlayerName }
        | {
            readonly kind:     "HazardIncoming";
            readonly attacker: PlayerId;
            readonly hazard:   HazardCard;
            readonly target:   TeamIndex;
        }
        | {
            readonly kind:        "ExtensionOffer";
            readonly decider:     PlayerId;
            readonly deciderName: PlayerName;
        }
        | { readonly kind: "Over" };
}


function contextPhase(g: Game): PlayContext["phase"] {
    // The invariants guarantee that a phase names only players in the game.
    const nameOf = (id: PlayerId): PlayerName => g.players.find((p) => p.seat.id === id)!.seat.name;
    const phase = g.phase;
    switch (phase.kind) {
        case "Turn":
            return { ...phase, playerName: nameOf(phase.player) };
        case "HazardIncoming":
            return phase;
        case "ExtensionOffer":
            return { kind: phase.kind, decider: phase.decider, deciderName: nameOf(phase.decider) };
        case "RaceOver":
        case "GameOver":
            return { kind: "Over" };
    }
}


/**
 * Builds a player's play context from a full game.
 * @param g - The game
 * @param me - The player issuing commands
 * @returns The context, or WrongPhase when `me` is not playing in the game
 */
export function contextFromGame(g: Game, me: PlayerId): Result<PlayContext, Rejection> {
    const player = g.players.find((p) => p.seat.id === me);
    if (!player) {
        return new FailedResult({ reason: "WrongPhase" });
    }
    return new SucceededResult({
        me,
        myTeam:       player.team,
        hand:         player.hand,
        zones:        g.teams.map((t) => t.zone),
        tripDistance: tripDistance(g.extension),
        phase:        contextPhase(g),
    });
}


function isExtensionDecision(cmd: PlayerCommand): boolean {
    return cmd.type === "CallExtension" || cmd.type === "DeclineExtension";
}


function checkPhaseAndTurn(ctx: PlayContext, cmd: PlayerCommand): Rejection | null {
    const phase = ctx.phase;
    switch (phase.kind) {
        case "Turn":
            if (isExtensionDecision(cmd)) {
                return { reason: "NoExtensionOffer" };
            }
            if (cmd.type === "CoupFourre") {
                return { reason: "NoWindowOpen" };
            }
            return phase.player === ctx.me ?
                null :
                { reason: "NotYourTurn", current: phase.playerName };
        case "HazardIncoming":
            // shortcut: Task 7 replaces this WrongPhase with the Coup Fourre checks.
            return cmd.type === "CoupFourre" ? { reason: "WrongPhase" } : { reason: "WindowOpen" };
        case "ExtensionOffer":
            if (!isExtensionDecision(cmd)) {
                return { reason: "ExtensionOfferOpen", decider: phase.deciderName };
            }
            return phase.decider === ctx.me ?
                null :
                { reason: "NotTheCaller", decider: phase.deciderName };
        case "Over":
            return { reason: "WrongPhase" };
    }
}


function checkHand(ctx: PlayContext, cmd: PlayerCommand): Rejection | null {
    return "card" in cmd && !ctx.hand.includes(cmd.card) ?
        { reason: "CardNotInHand", card: cmd.card } :
        null;
}


function checkZone(ctx: PlayContext, cmd: PlayerCommand): Result<ZoneChange | null, Rejection> {
    const zone = ctx.zones[ctx.myTeam]!;
    switch (cmd.type) {
        case "Drive":
            return playDistance(zone, cmd.card, ctx.tripDistance);
        case "Remedy":
            return playRemedy(zone, cmd.card);
        case "PlaySafety":
            return playSafety(zone, cmd.card);
        case "Discard":
        case "CallExtension":
        case "DeclineExtension":
            return new SucceededResult(null);
        case "Attack":
        case "CoupFourre":
            // shortcut: Task 7 replaces this WrongPhase with the attack checks.
            return new FailedResult({ reason: "WrongPhase" });
    }
}


/**
 * Checks a command like `checkCommand()` and also works out the change it
 * makes to the player's own zone.
 * @param ctx - The player's context
 * @param cmd - The command
 * @returns The change to the player's zone, null for a command that changes
 * no zone (Discard, CallExtension, DeclineExtension), or the rejection
 */
export function checkPlay(
    ctx: PlayContext,
    cmd: PlayerCommand
): Result<ZoneChange | null, Rejection> {
    const refused = checkPhaseAndTurn(ctx, cmd) ?? checkHand(ctx, cmd);
    return refused ? new FailedResult(refused) : checkZone(ctx, cmd);
}


/**
 * Determines whether a player may issue a command.  Checks, in order: the
 * phase, the turn, that the card is in the player's hand, and the zone rules.
 * Any card in hand may be discarded.
 * @param ctx - The player's context
 * @param cmd - The command
 * @returns A successful void result, or the reason the command is refused
 */
export function checkCommand(ctx: PlayContext, cmd: PlayerCommand): Result<void, Rejection> {
    return checkPlay(ctx, cmd).mapSuccess(() => undefined);
}
