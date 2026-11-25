import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { Card, cardSchema } from "./card.mjs";
import { cardCounts } from "./deck.mjs";
import { canAttack, hasSafety, zoneMiles } from "./drivingZone.mjs";
import { seatOrder, validateGameConfig, type Game, type PlayerState, type RaceResult } from "./game.mjs";
import { describeRejection } from "./rejection.mjs";
import { EXTENSION_MILES, tripDistance, variantForSeatCount, type RaceVariant } from "./variant.mjs";


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


type Check = (g: Game, v: RaceVariant) => Result<void, string>;


// A Result is immutable, so the success is shared rather than built on every check.
const consistent: Result<void, string> = new SucceededResult(undefined);


function inconsistent(problem: string): FailedResult<string> {
    return new FailedResult(problem);
}


function isTeam(g: Game, team: number): boolean {
    return Number.isInteger(team) && team >= 0 && team < g.teams.length;
}


const checkPlayers: Check = (g) => {
    const order = seatOrder(g.config.teams);
    if (g.players.length !== order.length) {
        return inconsistent(
            `The game has ${g.players.length} players, but its config has ${order.length} seats.`
        );
    }
    const mismatch = g.players.findIndex(({ seat, team }, i) => {
        const expected = order[i]!;
        return seat.id !== expected.seat.id || seat.name !== expected.seat.name ||
            seat.kind !== expected.seat.kind || team !== expected.team;
    });
    return mismatch === -1 ?
        consistent :
        inconsistent(
            `Player ${mismatch} (${g.players[mismatch]!.seat.name}) does not match seat ${mismatch} of the config.`
        );
};


const checkTeams: Check = (g) => g.teams.length === g.config.teams.length ?
    consistent :
    inconsistent(`The game has ${g.teams.length} teams, but its config has ${g.config.teams.length}.`);


const checkRaceNumber: Check = (g) => Number.isInteger(g.raceNumber) && g.raceNumber >= 1 ?
    consistent :
    inconsistent(`The race number must be a whole number of at least 1, but is ${g.raceNumber}.`);


const checkExtension: Check = (g, v) => {
    const e = g.extension;
    if (!v.extension && e.kind !== "NotApplicable") {
        return inconsistent(`Extension is ${e.kind} in a game without Extension.`);
    }
    if (v.extension && e.kind === "NotApplicable") {
        return inconsistent(`Extension must apply in a ${g.players.length}-player game.`);
    }
    if (e.kind === "Called") {
        if (!isTeam(g, e.caller)) {
            return inconsistent(`Extension was called by team ${e.caller}, which does not exist.`);
        }
        // Only a team that reached 700 can call, and miles never go down.
        const miles = zoneMiles(g.teams[e.caller]!.zone);
        if (miles < EXTENSION_MILES) {
            return inconsistent(`Extension was called by team ${e.caller}, which has only ${miles} miles.`);
        }
    }
    return consistent;
};


// How an Extension caller reads in a message: the team number, or "null".
function showCaller(caller: Option<number>): string {
    return caller.match(String, () => "null");
}


// The race result's teams exist, and its Extension caller is the game's (the
// Extension state is only reset when the next race is dealt).
function checkResult(g: Game, { outcome, scores }: RaceResult): Result<void, string> {
    if (scores.length !== g.teams.length) {
        return inconsistent(
            `The race result has ${scores.length} scores, but the game has ${g.teams.length} teams.`
        );
    }
    if (outcome.kind === "TripCompleted" && !isTeam(g, outcome.team)) {
        return inconsistent(
            `The race result names team ${outcome.team} as completing the trip, but it does not exist.`
        );
    }
    if (outcome.kind === "Exhausted" && outcome.winner !== "Tie" && !isTeam(g, outcome.winner)) {
        return inconsistent(
            `The race result names team ${outcome.winner} as the winner, but it does not exist.`
        );
    }
    const caller = Option.fromNullable(outcome.extensionCaller);
    if (caller.isSome && !isTeam(g, caller.value)) {
        return inconsistent(
            `The race result names Extension caller team ${caller.value}, which does not exist.`
        );
    }
    const expected: Option<number> = g.extension.kind === "Called" ?
        new SomeOption(g.extension.caller) :
        NoneOption.get();
    const same = caller.isSome ?
        expected.isSome && expected.value === caller.value :
        expected.isNone;
    return same ?
        consistent :
        inconsistent(
            `The race result's Extension caller is team ${showCaller(caller)}, ` +
            `but the game's is team ${showCaller(expected)}.`
        );
}


const checkPhase: Check = (g) => {
    const phase = g.phase;
    const player = (id: string): Option<PlayerState> => {
        return Option.fromNullable(g.players.find((p) => p.seat.id === id));
    };
    const unknown = (id: string): Result<void, string> => {
        return inconsistent(`The phase names unknown player ${id}.`);
    };
    switch (phase.kind) {
        case "Turn": {
            const onTurn = player(phase.player);
            if (onTurn.isNone) {
                return unknown(phase.player);
            }
            // The engine only gives a turn to a player with cards, so an
            // empty hand on turn would leave the game stuck.
            return onTurn.value.hand.length > 0 ?
                consistent :
                inconsistent(`${onTurn.value.seat.name} has the turn but holds no cards.`);
        }
        case "HazardIncoming": {
            const attacker = player(phase.attacker);
            if (attacker.isNone) {
                return unknown(phase.attacker);
            }
            if (!isTeam(g, phase.target) || phase.target === attacker.value.team) {
                return inconsistent(`A hazard cannot be in flight against team ${phase.target}.`);
            }
            // Nothing changes a zone while the window is open, so a hazard
            // that cannot land now never will, and the game would be stuck.
            const landing = canAttack(g.teams[phase.target]!.zone, phase.hazard);
            return landing.succeeded ?
                consistent :
                inconsistent(
                    `The ${phase.hazard} in flight against team ${phase.target} cannot land: ` +
                    describeRejection(landing.error)
                );
        }
        case "ExtensionOffer": {
            if (g.extension.kind !== "Available") {
                return inconsistent(`An Extension offer is open, but Extension is ${g.extension.kind}.`);
            }
            const decider = player(phase.decider);
            if (decider.isNone) {
                return unknown(phase.decider);
            }
            if (decider.value.team !== phase.team) {
                return inconsistent(
                    `The Extension offer is for team ${phase.team}, ` +
                    `but the decider is on team ${decider.value.team}.`
                );
            }
            const miles = zoneMiles(g.teams[phase.team]!.zone);
            return miles === EXTENSION_MILES ?
                consistent :
                inconsistent(
                    `The Extension offer is for team ${phase.team}, ` +
                    `which has ${miles} miles, not ${EXTENSION_MILES}.`
                );
        }
        case "RaceOver":
            return checkResult(g, phase.result);
        case "GameOver":
            return isTeam(g, phase.winner) ?
                checkResult(g, phase.result) :
                inconsistent(`The winner is team ${phase.winner}, which does not exist.`);
        default:
            return inconsistent(`Unknown phase ${String((phase as { kind: unknown }).kind)}.`);
    }
};


const checkHands: Check = (g) => {
    for (const { seat, hand } of g.players) {
        // Only the player whose turn it is has drawn a 7th card.
        const limit = g.phase.kind === "Turn" && g.phase.player === seat.id ? 7 : 6;
        if (hand.length > limit) {
            return inconsistent(`${seat.name} holds ${hand.length} cards, but at most ${limit} are allowed.`);
        }
    }
    return consistent;
};


const checkCards: Check = (g, v) => {
    const cards = physicalCards(g);
    const expected = cardCounts(v.deck);
    for (const card of cardSchema.options) {
        const count = cards.filter((c) => c === card).length;
        if (count !== expected[card]) {
            return inconsistent(
                `The game has ${count} "${card}" cards, but a ${v.deck} deck has ${expected[card]}.`
            );
        }
    }
    const total = cardSchema.options.reduce((sum, card) => sum + expected[card], 0);
    return cards.length === total ?
        consistent :
        inconsistent(`The game has ${cards.length} cards, but a ${v.deck} deck has ${total}.`);
};


const checkZones: Check = (g) => {
    const trip = tripDistance(g.extension);
    for (const [t, { zone }] of g.teams.entries()) {
        const miles = zoneMiles(zone);
        if (miles > trip) {
            return inconsistent(`Team ${t} has ${miles} miles, more than the ${trip}-mile trip.`);
        }
        // Reaching the trip distance ends the race at once, or (at 700 while
        // Extension is Available) opens the offer for that team alone.
        const over = g.phase.kind === "RaceOver" || g.phase.kind === "GameOver";
        const offered = g.phase.kind === "ExtensionOffer" && g.phase.team === t;
        if (!over && !offered && miles === trip) {
            return inconsistent(`Team ${t} has reached the ${trip}-mile trip, but the race is not over.`);
        }
        const twoHundreds = zone.distance.filter((c) => c === Card.dist200).length;
        if (twoHundreds > 2) {
            return inconsistent(
                `Team ${t} has played ${twoHundreds} 200-mile cards, but only 2 are allowed.`
            );
        }
        const stopped = zone.status.kind === "NeedsRoll" ||
            (zone.status.kind === "Hazard" && zone.status.hazard === Card.stop);
        if (hasSafety(zone, Card.rightOfWay) && (stopped || zone.speedLimit)) {
            return inconsistent(
                `Team ${t} has Right of Way, so it cannot need a Roll, be stopped, or be speed limited.`
            );
        }
    }
    return consistent;
};


/**
 * Checks that a game is consistent: it matches its config and variant, the
 * phase and Extension state make sense (a hazard in flight can land, and no
 * team is at the trip distance while the race is on), hands are not too big,
 * zones are legal, and the cards are exactly the variant's deck.  Never
 * throws, so it is safe on decoded (untrusted) games.
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
        const verdict = check(g, variant.value);
        if (verdict.failed) {
            return verdict;
        }
    }
    return new SucceededResult(undefined);
}
