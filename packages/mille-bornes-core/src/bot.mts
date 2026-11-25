import { getRandom } from "@repo/depot/random";
import {
    Card, distanceCardSchema, distanceMiles, hazardCardSchema, remedyFor, safetyCardSchema,
    safetyFor, type HazardCard
} from "./card.mjs";
import { type PlayerCommand } from "./commands.mjs";
import { hasSafety, zoneMiles } from "./drivingZone.mjs";
import { legalPlays, type PlayerView } from "./view.mjs";


type Command<TType extends PlayerCommand["type"]> = Extract<PlayerCommand, { type: TType }>;


// Picks one item at random; callers pass a non-empty list.  A faulty `rand`
// may return NaN, a negative number or 1 or more, so the index is clamped:
// NaN and negatives pick the first item, 1 and more the last.
function pick<TItem>(items: ReadonlyArray<TItem>, rand: () => number): TItem | undefined {
    const r = rand();
    return items[r >= 0 ? Math.min(items.length - 1, Math.floor(r * items.length)) : 0];
}


// The miles the viewer's team leads every other team by (negative when it
// trails any team).
function leadOverEveryone(view: PlayerView): number {
    const miles = (team: PlayerView["teams"][number]): number => zoneMiles(team.zone);
    const mine = miles(view.teams[view.me.team]!);
    return Math.min(
        Infinity,
        ...view.teams.filter((t) => t.index !== view.me.team).map((t) => mine - miles(t))
    );
}


/** The lead, in miles, that makes a robot call Extension. */
const extensionLead = 100;


// A card's place in the discard order: the lower the number, the sooner it is
// discarded.  See `chooseCommand()`.
function discardRank(card: Card, view: PlayerView, legal: ReadonlyArray<PlayerCommand>): number {
    const myZone = view.teams[view.me.team]!.zone;
    const distance = distanceCardSchema.safeParse(card).data;
    // Distance cards by miles, remedies between the 100 and the 200.
    const keepValue = distance ? distanceMiles(distance) : 125;

    const cured = hazardCardSchema.options.filter((h) => remedyFor(h) === card);
    if (cured.length > 0 && cured.every((h) => hasSafety(myZone, safetyFor(h)))) {
        return 0;
    }
    if (hazardCardSchema.safeParse(card).success &&
        !legal.some((c) => c.type === "Attack" && c.card === card)) {
        return 1000 + keepValue;
    }
    if (distance) {
        const remaining = view.trip.distance - zoneMiles(myZone);
        const thirdTwoHundred = distance === Card.dist200 &&
            myZone.distance.filter((c) => c === Card.dist200).length >= 2;
        // Extension may still raise the trip, so only a fixed trip is certain.
        const overshoots = view.trip.extension.kind !== "Available" &&
            distanceMiles(distance) > remaining;
        if (thirdTwoHundred || overshoots) {
            return 2000;
        }
    }
    if (safetyCardSchema.safeParse(card).success) {
        return 5000;
    }
    const copies = view.me.hand.filter((c) => c === card).length;
    return (copies > 1 ? 3000 : 4000) + keepValue;
}


/**
 * Decides what a robot does with what it sees.  A robot is a pure function of
 * its `PlayerView`: it sees exactly what a human player sees and cannot
 * cheat.  The result is always one of `legalPlays(view)`, so the engine
 * accepts it.
 *
 * In order of preference:
 * 1. A Coup Fourre, when a hazard is incoming at its team and it holds the
 *    counter.
 * 2. In an Extension offer for it: call Extension when its team leads every
 *    other team by at least 100 miles, else decline.
 * 3. On its turn: drive the largest distance card that can be played; else a
 *    remedy for a hazard showing (a Roll for a Stop), or the safety that
 *    cancels it; else Roll when the car needs one; else play any safety;
 *    else attack the team with the most miles that some hazard in hand can
 *    hit; else discard.
 *
 * The discard is the card least useful to keep, in this order: a remedy for
 * hazards its safeties already prevent; a hazard no legal Attack plays now;
 * a distance card that can never be played again; a duplicate; any other
 * card, the lowest-value first (distance cards by miles, with remedies ranked
 * between the 100 and the 200); and a safety only when nothing else is left.
 * @param view - What the robot sees
 * @param rand - Returns a number in [0, 1); breaks ties between equally good
 * plays (default `getRandom`); a fixed `rand` makes the choice deterministic.
 * A value outside [0, 1), or NaN, still gives a legal play
 * @returns The command, or null when the robot has no decision to make (not
 * its turn, no Coup Fourre it can play, no Extension offer for it)
 */
export function chooseCommand(
    view: PlayerView,
    rand: () => number = getRandom
): PlayerCommand | null {
    const legal = legalPlays(view);
    const ofType = <TType extends PlayerCommand["type"]>(type: TType): Array<Command<TType>> => {
        return legal.filter((c): c is Command<TType> => c.type === type);
    };

    const coupFourre = ofType("CoupFourre")[0];
    if (coupFourre) {
        return coupFourre;
    }

    if (ofType("CallExtension").length > 0) {
        const decision = leadOverEveryone(view) >= extensionLead ?
            "CallExtension" :
            "DeclineExtension";
        return legal.find((c) => c.type === decision) ?? null;
    }

    const driving = ofType("Drive")
    .sort((a, b) => distanceMiles(b.card) - distanceMiles(a.card))[0];
    if (driving) {
        return driving;
    }

    const myZone = view.teams[view.me.team]!.zone;
    const showing: Array<HazardCard> = [
        ...(myZone.status.kind === "Hazard" ? [myZone.status.hazard] : []),
        ...(myZone.speedLimit ? [Card.speedLimit] : []),
    ];
    const cures = [
        ...ofType("Remedy").filter((c) => showing.some((h) => remedyFor(h) === c.card)),
        ...ofType("PlaySafety").filter((c) => showing.some((h) => safetyFor(h) === c.card)),
    ];
    const roll = legal.filter((c) => c.type === "Remedy" && c.card === Card.roll);
    const safeties = ofType("PlaySafety");
    for (const choices of [cures, roll, safeties]) {
        const choice = choices[0];
        if (choice) {
            return choice;
        }
    }

    const attacks = ofType("Attack");
    if (attacks.length > 0) {
        const milesOf = (a: Command<"Attack">): number => zoneMiles(view.teams[a.targetTeam]!.zone);
        const mostMiles = Math.max(...attacks.map(milesOf));
        return pick(attacks.filter((a) => milesOf(a) === mostMiles), rand) ?? null;
    }

    const discards = ofType("Discard");
    const ranks = discards.map((d) => discardRank(d.card, view, legal));
    const least = Math.min(...ranks);
    return pick(discards.filter((_, i) => ranks[i] === least), rand) ?? null;
}
