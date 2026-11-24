import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { type Card, type SafetyCard } from "./card.mjs";
import { type Applied, type PlayerCommand, type SystemCommand } from "./commands.mjs";
import { ShuffledDeck } from "./deck.mjs";
import { landHazard, newZone, zoneMiles, type ZoneChange } from "./drivingZone.mjs";
import { type GameEvent } from "./events.mjs";
import {
    seatOrder, validateGameConfig, type Game, type GameConfig, type PlayerState, type TeamState
} from "./game.mjs";
import { type PlayerId, type TeamIndex } from "./ids.mjs";
import { Points } from "./points.mjs";
import { describeRejection, type Rejection } from "./rejection.mjs";
import { checkPlay, contextFromGame } from "./rules.mjs";
import { resolveRace, scoreRace, standardScoring, type RaceOutcome } from "./scoring.mjs";
import {
    initialExtension, tripDistance, variantForSeatCount, type ExtensionState
} from "./variant.mjs";


const handSize = 6;


// The player draws the top card of the draw pile, unless it is empty.
function drawCard(g: Game, index: number, events: ReadonlyArray<GameEvent>): Applied {
    const player = g.players[index]!.seat.id;
    const [drawn, ...drawPile] = g.drawPile;
    if (drawn === undefined) {
        return { game: g, events };
    }
    return {
        game: {
            ...g,
            players: g.players.map((p, i) => i === index ? { ...p, hand: [...p.hand, drawn] } : p),
            drawPile,
        },
        events: [...events, { type: "CardDrawn", player, card: drawn }],
    };
}


/**
 * Starts a player's turn: the player draws the top card of the draw pile,
 * unless it is empty.
 * @param g - The game
 * @param index - The index in `g.players` of the player whose turn starts
 * @param events - The events so far; the new ones are appended
 * @returns The game on the player's turn and the events
 */
function startTurn(g: Game, index: number, events: ReadonlyArray<GameEvent>): Applied {
    const player = g.players[index]!.seat.id;
    const started: GameEvent = { type: "TurnStarted", player };
    return drawCard({ ...g, phase: { kind: "Turn", player } }, index, [...events, started]);
}


// Removes one copy of `card` from the hand of `g.players[index]`.
function withoutCard(g: Game, index: number, card: Card): ReadonlyArray<PlayerState> {
    return g.players.map((p, i) => {
        if (i !== index) {
            return p;
        }
        const hand = [...p.hand];
        hand.splice(hand.indexOf(card), 1);
        return { ...p, hand };
    });
}


/**
 * Finds the next player in turn order who holds cards.
 * @param g - The game
 * @param from - The index in `g.players` to start looking from (inclusive);
 * the search wraps around and checks every player once
 * @returns The player's index, or undefined when nobody holds cards
 */
function nextPlayerWithCards(g: Game, from: number): number | undefined {
    const n = g.players.length;
    return Array.from({ length: n }, (_, k) => (from + k) % n)
    .find((i) => g.players[i]!.hand.length > 0);
}


function extensionCaller(e: ExtensionState): TeamIndex | null {
    return e.kind === "Called" ? e.caller : null;
}


function exhausted(g: Game): RaceOutcome {
    const miles = g.teams.map((t) => zoneMiles(t.zone));
    const best = Math.max(...miles);
    const leaders = miles.flatMap((m, t) => m === best ? [t as TeamIndex] : []);
    return {
        kind:            "Exhausted",
        winner:          leaders.length === 1 ? leaders[0]! : "Tie",
        extensionCaller: extensionCaller(g.extension),
    };
}


/**
 * Ends the race: scores it, adds each team's race total to its points, and
 * decides whether the game is over.  The zones are left as they are so the
 * score sheet can show them.
 * @param g - The game
 * @param outcome - How the race ended
 * @param events - The events so far; RaceEnded (and GameEnded) are appended
 * @returns The game in phase RaceOver or GameOver and the events
 */
function finishRace(
    g: Game,
    outcome: RaceOutcome,
    events: ReadonlyArray<GameEvent>
): Applied {
    const zones = g.teams.map((t) => t.zone);
    const scores = scoreRace(standardScoring, zones, outcome, g.teams.map((t) => t.points));
    const totals = scores.map((s) => s.combinedTotal);
    const teams = g.teams.map((t, i) => ({ ...t, points: totals[i]! }));
    const result = { outcome, scores };
    const ended: Array<GameEvent> = [...events, { type: "RaceEnded", result }];
    const resolution = resolveRace(g.config.length, totals, outcome);
    if (resolution.kind === "GameOver") {
        return {
            game:   { ...g, teams, phase: { kind: "GameOver", winner: resolution.winner, result } },
            events: [...ended, { type: "GameEnded", winner: resolution.winner }],
        };
    }
    return { game: { ...g, teams, phase: { kind: "RaceOver", result } }, events: ended };
}


/**
 * Starts the turn of the next player who holds cards, or ends the race as
 * Exhausted when nobody does.
 * @param g - The game
 * @param from - The index in `g.players` to start looking from (inclusive)
 * @param events - The events so far; the new ones are appended
 * @returns The game and the events
 */
function nextTurn(g: Game, from: number, events: ReadonlyArray<GameEvent>): Applied {
    const next = nextPlayerWithCards(g, from);
    return next === undefined ? finishRace(g, exhausted(g), events) : startTurn(g, next, events);
}


type CardPlay = Extract<PlayerCommand, { type: "Drive" | "Remedy" | "PlaySafety" | "Discard" }>;


function playedEvent(by: PlayerId, team: TeamIndex, cmd: CardPlay): GameEvent {
    switch (cmd.type) {
        case "Drive":
            return { type: "DistancePlayed", player: by, card: cmd.card, team };
        case "Remedy":
            return { type: "RemedyPlayed", player: by, card: cmd.card, team };
        case "PlaySafety":
            return { type: "SafetyPlayed", player: by, card: cmd.card, team };
        case "Discard":
            return { type: "CardDiscarded", player: by, card: cmd.card };
    }
}


// `change` is null for a Discard, which sends the card to the discard pile.
function playCard(g: Game, index: number, cmd: CardPlay, change: ZoneChange | null): Applied {
    const { seat, team } = g.players[index]!;
    const game: Game = {
        ...g,
        players:     withoutCard(g, index, cmd.card),
        teams:       g.teams.map((t, i) => change && i === team ? { ...t, zone: change.zone } : t),
        discardPile: [...g.discardPile, ...(change ? change.discarded : [cmd.card])],
    };
    const events = [playedEvent(seat.id, team, cmd)];

    if (cmd.type === "PlaySafety") {
        return nextTurn(game, index, events);
    }
    if (cmd.type === "Drive" && zoneMiles(game.teams[team]!.zone) === tripDistance(g.extension)) {
        // While Extension is Available the trip is 700 and the team may extend.
        if (g.extension.kind === "Available") {
            return {
                game:   { ...game, phase: { kind: "ExtensionOffer", decider: seat.id, team } },
                events: [...events, { type: "ExtensionOffered", player: seat.id, team }],
            };
        }
        return completeTrip(game, team, events);
    }
    return nextTurn(game, index + 1, events);
}


// Ends the race with `team`'s trip completed.
function completeTrip(g: Game, team: TeamIndex, events: ReadonlyArray<GameEvent>): Applied {
    return finishRace(g, {
        kind:            "TripCompleted",
        team,
        delayedAction:   g.drawPile.length === 0,
        extensionCaller: extensionCaller(g.extension),
    }, events);
}


/**
 * Resolves the open Extension offer.  Calling makes the trip 1,000 miles and
 * play continues with the player after the decider; declining (or the offer
 * timing out) completes the decider's team's trip at 700.
 * @param g - The game
 * @param call - Whether Extension is called
 * @returns The game and its events, or NoExtensionOffer when no offer is open
 */
function decideExtension(g: Game, call: boolean): Result<Applied, Rejection> {
    const phase = g.phase;
    if (phase.kind !== "ExtensionOffer") {
        return new FailedResult({ reason: "NoExtensionOffer" });
    }
    const { decider: player, team } = phase;
    if (!call) {
        return new SucceededResult(completeTrip(g, team, [{ type: "ExtensionDeclined", player, team }]));
    }
    const decider = g.players.findIndex((p) => p.seat.id === player);
    const game: Game = { ...g, extension: { kind: "Called", caller: team } };
    return new SucceededResult(nextTurn(game, decider + 1, [{ type: "ExtensionCalled", player, team }]));
}


type AttackCommand = Extract<PlayerCommand, { type: "Attack" }>;


// The hazard stays in flight (in the phase) until the window closes.
function attack(g: Game, index: number, cmd: AttackCommand): Applied {
    const attacker = g.players[index]!.seat.id;
    return {
        game: {
            ...g,
            players: withoutCard(g, index, cmd.card),
            phase:   {
                kind:   "HazardIncoming",
                attacker,
                hazard: cmd.card,
                target: cmd.targetTeam,
            },
        },
        events: [{ type: "HazardPlayed", player: attacker, card: cmd.card, targetTeam: cmd.targetTeam }],
    };
}


// `change` is `playCoupFourre()`'s change to the zone, which never held the
// hazard in flight; both the hazard and `change.discarded` are discarded.
function coupFourre(
    g: Game,
    index: number,
    card: SafetyCard,
    change: ZoneChange
): Result<Applied, Rejection> {
    // checkPlay() has already checked this; it narrows the phase.
    if (g.phase.kind !== "HazardIncoming") {
        return new FailedResult({ reason: "NoWindowOpen" });
    }
    const { seat, team } = g.players[index]!;
    const hazard = g.phase.hazard;
    const game: Game = {
        ...g,
        players:     withoutCard(g, index, card),
        teams:       g.teams.map((t, i) => i === team ? { ...t, zone: change.zone } : t),
        discardPile: [...g.discardPile, hazard, ...change.discarded],
        phase:       { kind: "Turn", player: seat.id },
    };
    const played: GameEvent = { type: "CoupFourrePlayed", player: seat.id, card, team, hazard };
    // The replacement draw; the extra turn (with its own draw) follows, like
    // any safety, unless the player has no cards left.
    const drawn = drawCard(game, index, [played]);
    return new SucceededResult(nextTurn(drawn.game, index, drawn.events));
}


/**
 * Applies a player's command: checks it with `checkCommand()`, plays the
 * card, and moves the game on (the next turn, an Extension offer, or the end
 * of the race).  An Attack opens the hazard window (`HazardIncoming`) and
 * changes no zone; a Coup Fourre answers it and starts the player's turn.
 * CallExtension and DeclineExtension resolve an Extension offer.
 * @param g - The game
 * @param by - The player issuing the command
 * @param cmd - The command
 * @returns The new game and its events, or the reason the command is refused
 */
export function applyPlayerCommand(
    g: Game,
    by: PlayerId,
    cmd: PlayerCommand
): Result<Applied, Rejection> {
    return contextFromGame(g, by)
    .bind((ctx) => checkPlay(ctx, cmd))
    .bind((change): Result<Applied, Rejection> => {
        const index = g.players.findIndex((p) => p.seat.id === by);
        switch (cmd.type) {
            case "Drive":
            case "Remedy":
            case "PlaySafety":
            case "Discard":
                return new SucceededResult(playCard(g, index, cmd, change));
            case "Attack":
                return new SucceededResult(attack(g, index, cmd));
            case "CoupFourre":
                return coupFourre(g, index, cmd.card, change!);
            case "CallExtension":
            case "DeclineExtension":
                return decideExtension(g, cmd.type === "CallExtension");
        }
    });
}


// Lands the hazard in flight, then play passes to the player after the
// attacker.
function closeHazardWindow(g: Game): Result<Applied, Rejection> {
    const phase = g.phase;
    if (phase.kind !== "HazardIncoming") {
        return new FailedResult({ reason: "NoWindowOpen" });
    }
    const target = g.teams[phase.target]!;
    // Nothing changes a zone while the window is open, so this re-check holds.
    return landHazard(target.zone, phase.hazard).mapSuccess((change) => {
        const attacker = g.players.findIndex((p) => p.seat.id === phase.attacker);
        const game: Game = {
            ...g,
            teams: g.teams.map((t, i) => i === phase.target ? { ...t, zone: change.zone } : t),
        };
        const landed: GameEvent = { type: "HazardLanded", card: phase.hazard, targetTeam: phase.target };
        // nextTurn() replaces the phase, so the hazard is not counted twice.
        return nextTurn(game, attacker + 1, [landed]);
    });
}


// The static type is not trusted, so a bad command is refused, never thrown on.
function isSystemCommand(cmd: unknown): boolean {
    const types: ReadonlyArray<unknown> = ["CloseHazardWindow", "CloseExtensionOffer", "StartNextRace"];
    return typeof cmd === "object" && cmd !== null && "type" in cmd && types.includes(cmd.type);
}


/**
 * Applies a command issued by the server.  CloseExtensionOffer (the timeout)
 * declines Extension.
 * @param g - The game
 * @param cmd - The command
 * @returns The new game and its events, or the reason the command is refused:
 * MalformedCommand for anything that is not a system command, NoWindowOpen for
 * a CloseHazardWindow with no hazard in flight, NoExtensionOffer for a
 * CloseExtensionOffer with no offer open
 */
export function applySystemCommand(g: Game, cmd: SystemCommand): Result<Applied, Rejection> {
    if (!isSystemCommand(cmd)) {
        return new FailedResult({ reason: "MalformedCommand" });
    }
    switch (cmd.type) {
        case "CloseHazardWindow":
            return closeHazardWindow(g);
        case "CloseExtensionOffer":
            return decideExtension(g, false);
        case "StartNextRace":
            // shortcut: Task 9 implements the next race; refused until then.
            return new FailedResult({ reason: "WrongPhase" });
    }
}


/**
 * Deals a race: resets every zone, the discard pile and Extension, deals 6
 * cards to each player (`players[i]` gets `deck[6i]` to `deck[6i + 5]`), and
 * starts the first player's turn with a draw.  Race n's first player is
 * `players[(n - 1) % players.length]`.  Team points are kept.
 * @param config - The game's config (assumed valid)
 * @param players - The players in turn order; their hands are replaced
 * @param teams - The teams; their zones are reset and points kept
 * @param deck - The deck to deal from
 * @param raceNumber - The number of the race being dealt (1 for the first)
 * @returns The dealt game and its events, or WrongDeck if the deck's kind is
 * not the variant's (or UnsupportedPlayerCount)
 */
export function dealRace(
    config: GameConfig,
    players: ReadonlyArray<PlayerState>,
    teams: ReadonlyArray<TeamState>,
    deck: ShuffledDeck,
    raceNumber: number
): Result<Applied, Rejection> {
    const variant = variantForSeatCount(players.length);
    if (variant.failed) {
        return variant;
    }
    if (ShuffledDeck.kind(deck) !== variant.value.deck) {
        return new FailedResult({ reason: "WrongDeck" });
    }
    const first = (raceNumber - 1) % players.length;
    const dealtCount = players.length * handSize;
    const dealt: Game = {
        config,
        players: players.map((p, i) => ({
            ...p,
            hand: deck.slice(i * handSize, (i + 1) * handSize),
        })),
        teams:       teams.map((t) => ({ zone: newZone(), points: t.points })),
        drawPile:    deck.slice(dealtCount),
        discardPile: [],
        raceNumber,
        extension:   initialExtension(variant.value),
        phase:       { kind: "Turn", player: players[first]!.seat.id },
    };
    // A full deck always outlasts the deal (at most 37 of 101 cards).
    return new SucceededResult(startTurn(dealt, first, [{ type: "RaceDealt", race: raceNumber }]));
}


/**
 * Creates a game and deals race 1, with seat 0 to play first.
 * @param config - The game's config
 * @param deck - The deck for race 1; its kind must be the variant's
 * @returns The new game and its events, or a plain-English reason the game
 * cannot start
 */
export function createGame(config: GameConfig, deck: ShuffledDeck): Result<Applied, string> {
    return validateGameConfig(config).bind((c) => {
        const players = seatOrder(c.teams).map(({ seat, team }) => ({ seat, team, hand: [] }));
        const teams = c.teams.map(() => ({ zone: newZone(), points: Points.zero }));
        return dealRace(c, players, teams, deck, 1).mapError(describeRejection);
    });
}
