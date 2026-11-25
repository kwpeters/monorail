import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import {
    cardSchema, distanceCardSchema, hazardCardSchema, remedyCardSchema, safetyCardSchema,
    safetyFor, type Card, type HazardCard, type SafetyCard
} from "./card.mjs";
import { type PlayerCommand } from "./commands.mjs";
import {
    canAttack, playCoupFourre, playDistance, playRemedy, playSafety, type DrivingZone,
    type ZoneChange
} from "./drivingZone.mjs";
import { type Game, type Phase } from "./game.mjs";
import { type PlayerId, type TeamIndex } from "./ids.mjs";
import { type Miles } from "./miles.mjs";
import { type PlayerName } from "./playerName.mjs";
import { type Rejection } from "./rejection.mjs";
import { tripDistance } from "./variant.mjs";
// A type-only import, so the cycle with view.mts never exists at run time.
import type { PlayerView } from "./view.mjs";


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


// `nameOf` gets the name of a player the phase names.
function contextPhase(
    phase: Phase | PlayerView["phase"],
    nameOf: (id: PlayerId) => PlayerName
): PlayContext["phase"] {
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
 * @returns The context, or NotInGame when `me` is not playing in the game
 */
export function contextFromGame(g: Game, me: PlayerId): Result<PlayContext, Rejection> {
    const player = g.players.find((p) => p.seat.id === me);
    if (!player) {
        return new FailedResult({ reason: "NotInGame" });
    }
    // The invariants guarantee that a phase names only players in the game.
    const nameOf = (id: PlayerId): PlayerName => g.players.find((p) => p.seat.id === id)!.seat.name;
    return new SucceededResult({
        me,
        myTeam:       player.team,
        hand:         player.hand,
        zones:        g.teams.map((t) => t.zone),
        tripDistance: tripDistance(g.extension),
        phase:        contextPhase(g.phase, nameOf),
    });
}


/**
 * Builds the viewer's play context from their view, so a client can check
 * commands exactly as the engine does.
 * @param v - The view, as built by `viewFor()`
 * @returns The context; equal to `contextFromGame()` for the same player
 */
export function contextFromView(v: PlayerView): PlayContext {
    return {
        me:           v.me.id,
        myTeam:       v.me.team,
        hand:         v.me.hand,
        zones:        v.teams.map((t) => t.zone),
        tripDistance: v.trip.distance,
        // viewFor() names only seated players in the phase.
        phase:        contextPhase(v.phase, (id) => v.seats.find((s) => s.id === id)!.name),
    };
}


function isExtensionDecision(cmd: PlayerCommand): boolean {
    return cmd.type === "CallExtension" || cmd.type === "DeclineExtension";
}


/**
 * Checks that an untrusted command has a known type, the right kind of card
 * and, for an attack, a real team.  Extra properties are ignored.  This check
 * runs first so malformed input never reaches zone code.
 * @param ctx - The play context, which says how many teams there are
 * @param cmd - The command, whatever its static type claims
 * @returns True when the command is well formed
 */
export function isWellFormed(ctx: PlayContext, cmd: unknown): boolean {
    if (typeof cmd !== "object" || cmd === null || !("type" in cmd)) {
        return false;
    }
    const card = "card" in cmd ? cmd.card : undefined;
    switch (cmd.type) {
        case "Drive":
            return distanceCardSchema.safeParse(card).success;
        case "Remedy":
            return remedyCardSchema.safeParse(card).success;
        case "PlaySafety":
        case "CoupFourre":
            return safetyCardSchema.safeParse(card).success;
        case "Attack": {
            const target = "targetTeam" in cmd ? cmd.targetTeam : undefined;
            return hazardCardSchema.safeParse(card).success && typeof target === "number" &&
                Number.isInteger(target) && target >= 0 && target < ctx.zones.length;
        }
        case "Discard":
            return cardSchema.safeParse(card).success;
        case "CallExtension":
        case "DeclineExtension":
            return true;
        default:
            return false;
    }
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
            // Any member of the target team may answer, whoever's turn it was.
            if (cmd.type !== "CoupFourre") {
                return { reason: "WindowOpen" };
            }
            return ctx.myTeam === phase.target ? null : { reason: "NotOnTargetTeam" };
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


function checkAttack(
    ctx: PlayContext,
    hazard: HazardCard,
    target: TeamIndex
): Result<null, Rejection> {
    if (target === ctx.myTeam) {
        return new FailedResult({ reason: "CannotAttackOwnTeam" });
    }
    return canAttack(ctx.zones[target]!, hazard).mapSuccess(() => null);
}


function checkCoupFourre(ctx: PlayContext, card: SafetyCard): Result<ZoneChange, Rejection> {
    if (ctx.phase.kind !== "HazardIncoming") {
        return new FailedResult({ reason: "NoWindowOpen" });
    }
    const hazard = ctx.phase.hazard;
    return safetyFor(hazard) === card ?
        new SucceededResult(playCoupFourre(ctx.zones[ctx.myTeam]!, card)) :
        new FailedResult({ reason: "WrongSafetyForHazard", hazard, card });
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
            return checkAttack(ctx, cmd.card, cmd.targetTeam);
        case "CoupFourre":
            return checkCoupFourre(ctx, cmd.card);
    }
}


/**
 * Checks a command like `checkCommand()` and also works out the change it
 * makes to the player's own zone.  Shared by the engine, which applies the
 * change.  For a Coup Fourre the change is `playCoupFourre()`'s: the hazard in
 * flight is not part of it.
 * @param ctx - The player's context
 * @param cmd - The command
 * @returns The change to the player's zone, null for a command that changes
 * no zone now (Attack, Discard, CallExtension, DeclineExtension), or the
 * rejection
 */
export function checkPlay(
    ctx: PlayContext,
    cmd: PlayerCommand
): Result<ZoneChange | null, Rejection> {
    if (!isWellFormed(ctx, cmd)) {
        return new FailedResult({ reason: "MalformedCommand" });
    }
    const refused = checkPhaseAndTurn(ctx, cmd) ?? checkHand(ctx, cmd);
    return refused ? new FailedResult(refused) : checkZone(ctx, cmd);
}


/**
 * Determines whether a player may issue a command.  Checks, in order: that
 * the command is well formed (it may come from an untrusted client), the
 * phase, the turn, that the card is in the player's hand, and the zone rules.
 * Any card in hand may be discarded.  An Attack is refused on the player's own
 * team, then by `canAttack()` on the target's zone.  While a hazard is
 * incoming only a Coup Fourre is allowed, from any member of the target team
 * (whoever's turn it was); it is checked for the team, then the hand, then
 * that the safety counters the hazard.
 * @param ctx - The player's context
 * @param cmd - The command
 * @returns A successful void result, or the reason the command is refused
 */
export function checkCommand(ctx: PlayContext, cmd: PlayerCommand): Result<void, Rejection> {
    return checkPlay(ctx, cmd).mapSuccess(() => undefined);
}
