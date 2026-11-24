import { Card, safetyCardSchema } from "./card.mjs";
import { hasSafety, zoneMiles, type DrivingZone } from "./drivingZone.mjs";
import { type TeamIndex } from "./ids.mjs";
import { type Miles } from "./miles.mjs";
import { type Points } from "./points.mjs";


/** The point values used to score a race. */
export interface ScoringRules {
    readonly perMile:         number;
    readonly perSafety:       number;
    readonly allFourSafeties: number;
    readonly coupFourre:      number;
    readonly tripCompleted:   number;
    readonly delayedAction:   number;
    readonly safeTrip:        number;
    readonly shutout:         number;
    readonly extension:       number;
}


/**
 * The scoring values for this project.  Safe Trip (300) and Shutout (500) are
 * reversed from the printed rulebook by the owner's decision.
 */
export const standardScoring: ScoringRules = {
    perMile:         1,
    perSafety:       100,
    allFourSafeties: 300,
    coupFourre:      300,
    tripCompleted:   400,
    delayedAction:   300,
    safeTrip:        300,
    shutout:         500,
    extension:       200,
};


/** How a race ended. */
export type RaceOutcome =
    | {
        readonly kind:            "TripCompleted";
        readonly team:            TeamIndex;
        readonly delayedAction:   boolean;
        readonly extensionCaller: TeamIndex | null;
    }
    | {
        readonly kind:            "Exhausted";
        readonly winner:          TeamIndex | "Tie";
        readonly extensionCaller: TeamIndex | null;
    };


/**
 * One team's score for a race: one value per row of the rulebook's score
 * sheet.  Every row is present and is 0 when not earned.
 */
export interface RaceScore {
    readonly broughtForward:  Points;
    readonly miles:           Miles;
    readonly milestones:      Points;
    readonly safetyCount:     number;
    readonly safeties:        Points;
    readonly coupFourreCount: number;
    readonly coupFourres:     Points;
    readonly tripCompleted:   Points;
    readonly delayedAction:   Points;
    readonly safeTrip:        Points;
    readonly shutout:         Points;
    readonly extension:       Points;
    readonly totalForRace:    Points;
    readonly combinedTotal:   Points;
}


/** How long a game lasts: a single race, or until a team reaches a goal. */
export type GameLength = "Quick" | "Short" | "Full";


/**
 * Gets the points a team must reach to end a game of the given length.
 * @param length - The game length
 * @returns The goal, or null for a Quick game (which lasts one decided race)
 */
export function pointsGoal(length: GameLength): Points | null {
    switch (length) {
        case "Quick": return null;
        case "Short": return 2000 as Points;
        case "Full": return 5000 as Points;
    }
}


function scoreTeam(
    rules: ScoringRules,
    zones: ReadonlyArray<DrivingZone>,
    outcome: RaceOutcome,
    broughtForward: Points,
    team: number
): RaceScore {
    const zone = zones[team]!;
    const miles = zoneMiles(zone);
    const safetyCount = zone.safeties.length;
    const coupFourreCount = zone.safeties.filter((s) => s.coupFourre).length;
    const hasAllFour = safetyCardSchema.options.every((card) => hasSafety(zone, card));
    const completed = outcome.kind === "TripCompleted" && outcome.team === team;
    const caller = outcome.extensionCaller;
    // The caller is paid when it completes the trip; otherwise everyone else is.
    const callerCompleted = outcome.kind === "TripCompleted" && outcome.team === caller;
    const earnsExtension = caller !== null && (callerCompleted ? team === caller : team !== caller);

    const milestones = miles * rules.perMile;
    const safeties = safetyCount * rules.perSafety + (hasAllFour ? rules.allFourSafeties : 0);
    const coupFourres = coupFourreCount * rules.coupFourre;
    const tripCompleted = completed ? rules.tripCompleted : 0;
    const delayedAction = completed && outcome.delayedAction ? rules.delayedAction : 0;
    const safeTrip = completed && !zone.distance.includes(Card.dist200) ? rules.safeTrip : 0;
    const shutout = completed && zones.every((z, i) => i === team || zoneMiles(z) === 0) ? rules.shutout : 0;
    const extension = earnsExtension ? rules.extension : 0;
    const totalForRace =
        milestones + safeties + coupFourres + tripCompleted + delayedAction + safeTrip + shutout + extension;

    return {
        broughtForward,
        miles,
        milestones:    milestones as Points,
        safetyCount,
        safeties:      safeties as Points,
        coupFourreCount,
        coupFourres:   coupFourres as Points,
        tripCompleted: tripCompleted as Points,
        delayedAction: delayedAction as Points,
        safeTrip:      safeTrip as Points,
        shutout:       shutout as Points,
        extension:     extension as Points,
        totalForRace:  totalForRace as Points,
        combinedTotal: (broughtForward + totalForRace) as Points,
    };
}


/**
 * Scores a finished race for every team.
 * @param rules - The scoring values
 * @param zones - Each team's driving zone at the end of the race, indexed by team
 * @param outcome - How the race ended
 * @param broughtForward - Each team's total before this race, indexed by team
 * @returns One score sheet column per team, indexed by team
 */
export function scoreRace(
    rules: ScoringRules,
    zones: ReadonlyArray<DrivingZone>,
    outcome: RaceOutcome,
    broughtForward: ReadonlyArray<Points>
): ReadonlyArray<RaceScore> {
    return zones.map((_, team) => scoreTeam(rules, zones, outcome, broughtForward[team]!, team));
}


/** Whether the game goes on to another race or has been won. */
export type RaceResolution =
    | { readonly kind: "NextRace" }
    | { readonly kind: "GameOver"; readonly winner: TeamIndex };


/**
 * Decides whether the game is over after a race.  A Quick game ends when a
 * team completes the trip or wins on Exhausted; a tied Exhausted race gets
 * another race.  A Short or Full game ends only when some team has reached
 * the goal and exactly one team has the highest total.
 * @param length - The game length
 * @param totalsAfterRace - Each team's combined total after the race, indexed by team
 * @param outcome - How the race ended
 * @returns NextRace, or GameOver with the winning team
 */
export function resolveRace(
    length: GameLength,
    totalsAfterRace: ReadonlyArray<Points>,
    outcome: RaceOutcome
): RaceResolution {
    const goal = pointsGoal(length);
    if (goal === null) {
        const winner = outcome.kind === "TripCompleted" ? outcome.team : outcome.winner;
        return winner === "Tie" ? { kind: "NextRace" } : { kind: "GameOver", winner };
    }
    const best = Math.max(...totalsAfterRace);
    const leaders = totalsAfterRace.flatMap((total, team) => total === best ? [team as TeamIndex] : []);
    return best >= goal && leaders.length === 1 ?
        { kind: "GameOver", winner: leaders[0]! } :
        { kind: "NextRace" };
}
