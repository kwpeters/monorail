import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import {
    distanceCardSchema, hazardCardSchema, remedyCardSchema, safetyCardSchema, type Card,
    type HazardCard
} from "./card.mjs";
import { type PlayerCommand } from "./commands.mjs";
import { type DrivingZone } from "./drivingZone.mjs";
import { type GameEvent } from "./events.mjs";
import { type Game, type RaceResult, type SeatKind } from "./game.mjs";
import { type GameId, type PlayerId, type TeamIndex } from "./ids.mjs";
import { type Miles } from "./miles.mjs";
import { type PlayerName } from "./playerName.mjs";
import { type Points } from "./points.mjs";
import { type Rejection } from "./rejection.mjs";
import { checkCommand, contextFromView } from "./rules.mjs";
import { type GameLength } from "./scoring.mjs";
import { tripDistance, type ExtensionState } from "./variant.mjs";


/**
 * A seat as every player sees it.  Whether the seat is a human or a robot is
 * hidden until the game is over (see `ViewPhase`).
 */
export interface ViewSeat {
    readonly id:       PlayerId;
    readonly name:     PlayerName;
    readonly team:     TeamIndex;
    readonly handSize: number;
    readonly isMe:     boolean;
}


/**
 * What the game is waiting for, as every player sees it.  A hazard in flight
 * is public: everyone saw it played.  `reveal` (every seat's kind, in turn
 * order) exists only once the game is over.
 */
export type ViewPhase =
    | { readonly kind: "Turn"; readonly player: PlayerId }
    | {
        readonly kind:     "HazardIncoming";
        readonly attacker: PlayerId;
        readonly hazard:   HazardCard;
        readonly target:   TeamIndex;
    }
    | { readonly kind: "ExtensionOffer"; readonly decider: PlayerId; readonly team: TeamIndex }
    | { readonly kind: "RaceOver"; readonly result: RaceResult }
    | {
        readonly kind:   "GameOver";
        readonly winner: TeamIndex;
        readonly result: RaceResult;
        readonly reveal: ReadonlyArray<{
            readonly id:   PlayerId;
            readonly name: PlayerName;
            readonly kind: SeatKind;
        }>;
    };


/**
 * Everything one player may see of a game: their own hand, and only public
 * facts about everyone else.  Other hands and the draw pile appear only as
 * counts.  After a race the zones are left as they were, so with the result's
 * scores they make up the score sheet.
 */
export interface PlayerView {
    readonly gameId:     GameId;
    readonly raceNumber: number;
    readonly length:     GameLength;
    readonly me:            {
        readonly id:   PlayerId;
        readonly name: PlayerName;
        readonly team: TeamIndex;
        readonly hand: ReadonlyArray<Card>;
    };
    /** In turn order. */
    readonly seats: ReadonlyArray<ViewSeat>;
    /** Indexed by TeamIndex. */
    readonly teams:         ReadonlyArray<{
        readonly index:  TeamIndex;
        readonly zone:   DrivingZone;
        readonly points: Points;
    }>;
    /** The trip distance in force and the Extension state that sets it. */
    readonly trip:          { readonly distance: Miles; readonly extension: ExtensionState };
    readonly drawPileCount: number;
    readonly discardTop:    Card | null;
    readonly phase:         ViewPhase;
}


// Fields are picked one by one so nothing hidden is copied by accident.
function viewPhase(g: Game): ViewPhase {
    const phase = g.phase;
    switch (phase.kind) {
        case "Turn":
            return { kind: phase.kind, player: phase.player };
        case "HazardIncoming":
            return {
                kind:     phase.kind,
                attacker: phase.attacker,
                hazard:   phase.hazard,
                target:   phase.target,
            };
        case "ExtensionOffer":
            return { kind: phase.kind, decider: phase.decider, team: phase.team };
        case "RaceOver":
            return { kind: phase.kind, result: phase.result };
        case "GameOver":
            return {
                kind:   phase.kind,
                winner: phase.winner,
                result: phase.result,
                reveal: g.players.map(({ seat }) => ({
                    id:   seat.id,
                    name: seat.name,
                    kind: seat.kind,
                })),
            };
    }
}


/**
 * Builds what one player may see of a game.
 * @param g - The game
 * @param player - The viewer
 * @returns The view, or WrongPhase when the viewer is not playing in the game
 */
export function viewFor(g: Game, player: PlayerId): Result<PlayerView, Rejection> {
    const me = g.players.find((p) => p.seat.id === player);
    if (!me) {
        return new FailedResult({ reason: "WrongPhase" });
    }
    return new SucceededResult({
        gameId:     g.config.id,
        raceNumber: g.raceNumber,
        length:     g.config.length,
        me:         { id: me.seat.id, name: me.seat.name, team: me.team, hand: me.hand },
        seats:      g.players.map((p) => ({
            id:       p.seat.id,
            name:     p.seat.name,
            team:     p.team,
            handSize: p.hand.length,
            isMe:     p === me,
        })),
        teams: g.teams.map((t, i) => ({
            index:  i as TeamIndex,
            zone:   t.zone,
            points: t.points,
        })),
        trip:          { distance: tripDistance(g.extension), extension: g.extension },
        drawPileCount: g.drawPile.length,
        discardTop:    g.discardPile.at(-1) ?? null,
        phase:         viewPhase(g),
    });
}


/**
 * Redacts events for one player: the card in a CardDrawn is shown only to
 * the player who drew it.
 * @param viewer - The player the events are for
 * @param events - The events
 * @returns The events, with CardDrawn.card null unless the viewer drew it
 */
export function eventsFor(
    viewer: PlayerId,
    events: ReadonlyArray<GameEvent>
): ReadonlyArray<GameEvent> {
    return events.map((e) => e.type === "CardDrawn" && e.player !== viewer ?
        { ...e, card: null } :
        e);
}


// Every well-formed command for one card, ending with its Discard.  Lookups,
// not safeParse(): a failed parse builds a ZodError, which made this the
// hot spot of every robot decision.
function commandsFor(card: Card, v: PlayerView): ReadonlyArray<PlayerCommand> {
    const plays: Array<PlayerCommand> = [];
    const distance = distanceCardSchema.options.find((c) => c === card);
    const remedy = remedyCardSchema.options.find((c) => c === card);
    const safety = safetyCardSchema.options.find((c) => c === card);
    const hazard = hazardCardSchema.options.find((c) => c === card);
    if (distance) {
        plays.push({ type: "Drive", card: distance });
    }
    if (remedy) {
        plays.push({ type: "Remedy", card: remedy });
    }
    if (safety) {
        plays.push(
            { type: "PlaySafety", card: safety },
            { type: "CoupFourre", card: safety }
        );
    }
    if (hazard) {
        for (const { index } of v.teams.filter((t) => t.index !== v.me.team)) {
            plays.push({ type: "Attack", card: hazard, targetTeam: index });
        }
    }
    return [...plays, { type: "Discard", card }];
}


/**
 * Lists every well-formed command the viewer could issue with their hand,
 * whether or not the rules allow it now: each card's plays (attacks on every
 * other team) and its Discard, and the Extension decision for the decider of
 * an open offer.  A card held more than once gives its commands only once.
 * @param v - The viewer's view
 * @returns The commands, in hand order, then the Extension decision
 */
export function candidateCommands(v: PlayerView): ReadonlyArray<PlayerCommand> {
    const decides = v.phase.kind === "ExtensionOffer" && v.phase.decider === v.me.id;
    return [
        ...[...new Set(v.me.hand)].flatMap((card) => commandsFor(card, v)),
        ...(decides ? [{ type: "CallExtension" }, { type: "DeclineExtension" }] as const : []),
    ];
}


/**
 * Lists the commands the rules allow the viewer now, checked exactly as the
 * engine checks them.  During a hazard window it reveals nothing about other
 * hands: a viewer sees a Coup Fourre only if they hold the counter.
 * @param v - The viewer's view
 * @returns The candidate commands that `checkCommand()` accepts
 */
export function legalPlays(v: PlayerView): ReadonlyArray<PlayerCommand> {
    const ctx = contextFromView(v);
    return candidateCommands(v).filter((cmd) => checkCommand(ctx, cmd).succeeded);
}
