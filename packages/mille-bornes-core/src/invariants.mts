import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { Card, cardSchema } from "./card.mjs";
import { cardCounts } from "./deck.mjs";
import { hasSafety, zoneMiles } from "./drivingZone.mjs";
import { seatOrder, validateGameConfig, type Game, type PlayerState } from "./game.mjs";
import { tripDistance, variantForSeatCount, type RaceVariant } from "./variant.mjs";


/**
 * Lists every physical card in a game: hands, draw pile, discard pile, each
 * zone's distance cards, safeties, blocking hazard and speed limit, and a
 * hazard in flight.
 * @param g - The game
 * @returns The cards, in no particular order
 */
export function physicalCards(g: Game): ReadonlyArray<Card> {
    return [
        ...g.players.flatMap((p) => p.hand),
        ...g.drawPile,
        ...g.discardPile,
        ...g.teams.flatMap(({ zone }) => [
            ...zone.distance,
            ...zone.safeties.map((s) => s.card),
            ...(zone.status.kind === "Hazard" ? [zone.status.hazard] : []),
            ...(zone.speedLimit ? [Card.speedLimit] : []),
        ]),
        ...(g.phase.kind === "HazardIncoming" ? [g.phase.hazard] : []),
    ];
}


type Check = (g: Game, v: RaceVariant) => string | null;


function isTeam(g: Game, team: number): boolean {
    return Number.isInteger(team) && team >= 0 && team < g.teams.length;
}


const checkPlayers: Check = (g) => {
    const order = seatOrder(g.config.teams);
    if (g.players.length !== order.length) {
        return `The game has ${g.players.length} players, but its config has ${order.length} seats.`;
    }
    const mismatch = g.players.findIndex(({ seat, team }, i) => {
        const expected = order[i]!;
        return seat.id !== expected.seat.id || seat.name !== expected.seat.name ||
            seat.kind !== expected.seat.kind || team !== expected.team;
    });
    return mismatch === -1 ?
        null :
        `Player ${mismatch} (${g.players[mismatch]!.seat.name}) does not match seat ${mismatch} of the config.`;
};


const checkTeams: Check = (g) => g.teams.length === g.config.teams.length ?
    null :
    `The game has ${g.teams.length} teams, but its config has ${g.config.teams.length}.`;


const checkRaceNumber: Check = (g) => Number.isInteger(g.raceNumber) && g.raceNumber >= 1 ?
    null :
    `The race number must be a whole number of at least 1, but is ${g.raceNumber}.`;


const checkExtension: Check = (g, v) => {
    const e = g.extension;
    if (!v.extension && e.kind !== "NotApplicable") {
        return `Extension is ${e.kind} in a game without Extension.`;
    }
    if (v.extension && e.kind === "NotApplicable") {
        return `Extension must apply in a ${g.players.length}-player game.`;
    }
    if (e.kind === "Called" && !isTeam(g, e.caller)) {
        return `Extension was called by team ${e.caller}, which does not exist.`;
    }
    return null;
};


const checkPhase: Check = (g) => {
    const phase = g.phase;
    const player = (id: string): PlayerState | undefined => g.players.find((p) => p.seat.id === id);
    const unknown = (id: string): string => `The phase names unknown player ${id}.`;
    const checkScores = (count: number): string | null => count === g.teams.length ?
        null :
        `The race result has ${count} scores, but the game has ${g.teams.length} teams.`;
    switch (phase.kind) {
        case "Turn":
            return player(phase.player) ? null : unknown(phase.player);
        case "HazardIncoming": {
            const attacker = player(phase.attacker);
            if (!attacker) {
                return unknown(phase.attacker);
            }
            return isTeam(g, phase.target) && phase.target !== attacker.team ?
                null :
                `A hazard cannot be in flight against team ${phase.target}.`;
        }
        case "ExtensionOffer": {
            if (g.extension.kind !== "Available") {
                return `An Extension offer is open, but Extension is ${g.extension.kind}.`;
            }
            const decider = player(phase.decider);
            if (!decider) {
                return unknown(phase.decider);
            }
            return decider.team === phase.team ?
                null :
                `The Extension offer is for team ${phase.team}, but the decider is on team ${decider.team}.`;
        }
        case "RaceOver":
            return checkScores(phase.result.scores.length);
        case "GameOver":
            return isTeam(g, phase.winner) ?
                checkScores(phase.result.scores.length) :
                `The winner is team ${phase.winner}, which does not exist.`;
        default:
            return `Unknown phase ${String((phase as { kind: unknown }).kind)}.`;
    }
};


const checkHands: Check = (g) => {
    for (const { seat, hand } of g.players) {
        // Only the player whose turn it is has drawn a 7th card.
        const limit = g.phase.kind === "Turn" && g.phase.player === seat.id ? 7 : 6;
        if (hand.length > limit) {
            return `${seat.name} holds ${hand.length} cards, but at most ${limit} are allowed.`;
        }
    }
    return null;
};


const checkCards: Check = (g, v) => {
    const cards = physicalCards(g);
    const expected = cardCounts(v.deck);
    for (const card of cardSchema.options) {
        const count = cards.filter((c) => c === card).length;
        if (count !== expected[card]) {
            return `The game has ${count} "${card}" cards, but a ${v.deck} deck has ${expected[card]}.`;
        }
    }
    const total = cardSchema.options.reduce((sum, card) => sum + expected[card], 0);
    return cards.length === total ? null : `The game has ${cards.length} cards, but a ${v.deck} deck has ${total}.`;
};


const checkZones: Check = (g) => {
    const trip = tripDistance(g.extension);
    for (const [t, { zone }] of g.teams.entries()) {
        const miles = zoneMiles(zone);
        if (miles > trip) {
            return `Team ${t} has ${miles} miles, more than the ${trip}-mile trip.`;
        }
        const twoHundreds = zone.distance.filter((c) => c === Card.dist200).length;
        if (twoHundreds > 2) {
            return `Team ${t} has played ${twoHundreds} 200-mile cards, but only 2 are allowed.`;
        }
        const stopped = zone.status.kind === "NeedsRoll" ||
            (zone.status.kind === "Hazard" && zone.status.hazard === Card.stop);
        if (hasSafety(zone, Card.rightOfWay) && (stopped || zone.speedLimit)) {
            return `Team ${t} has Right of Way, so it cannot need a Roll, be stopped, or be speed limited.`;
        }
    }
    return null;
};


/**
 * Checks that a game is consistent: it matches its config and variant, the
 * phase and Extension state make sense, hands are not too big, zones are
 * legal, and the cards are exactly the variant's deck.  Never throws, so it is
 * safe on decoded (untrusted) games.
 * @param g - The game
 * @returns A successful result, or a failed result describing the first
 * problem found
 */
export function checkInvariants(g: Game): Result<void, string> {
    const config = validateGameConfig(g.config);
    if (config.failed) {
        return new FailedResult(`The game's config is invalid: ${config.error}`);
    }
    const variant = variantForSeatCount(g.config.teams.flat().length);
    if (variant.failed) {
        return new FailedResult("The game's config has no variant.");
    }
    const checks = [
        checkPlayers, checkTeams, checkRaceNumber, checkExtension,
        checkPhase, checkHands, checkCards, checkZones,
    ];
    for (const check of checks) {
        const problem = check(g, variant.value);
        if (problem !== null) {
            return new FailedResult(problem);
        }
    }
    return new SucceededResult(undefined);
}
