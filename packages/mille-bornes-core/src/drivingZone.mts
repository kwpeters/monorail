import { Option } from "@repo/depot/option";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import {
    Card, hazardCardSchema, type BlockingHazard, type DistanceCard, type HazardCard, type RemedyCard, type SafetyCard,
    distanceMiles, remedyFor, safetyFor
} from "./card.mjs";
import { Miles } from "./miles.mjs";
import { type Rejection } from "./rejection.mjs";


/**
 * Whether a team's car can drive: it needs a Roll, it is rolling, or a
 * blocking hazard is showing.
 */
export type ZoneStatus =
    | { readonly kind: "NeedsRoll" }
    | { readonly kind: "Rolling" }
    | { readonly kind: "Hazard"; readonly hazard: BlockingHazard };


/** A safety card a team has played and whether it was a Coup Fourre. */
export interface PlayedSafety {
    readonly card:       SafetyCard;
    readonly coupFourre: boolean;
}


/**
 * Everything showing in front of a team: its battle pile status, speed limit,
 * distance cards and safeties.  Instances are immutable.
 *
 * Invariant: once Right of Way is in play, the status is never `NeedsRoll` or
 * `Hazard(stop)` and `speedLimit` is false.  `canMove()` relies on this by
 * testing only for `Rolling`.
 */
export interface DrivingZone {
    readonly status:     ZoneStatus;
    readonly speedLimit: boolean;
    readonly distance:   ReadonlyArray<DistanceCard>;
    readonly safeties:   ReadonlyArray<PlayedSafety>;
}


/** The result of a play: the new zone and the cards that went to the discard pile. */
export interface ZoneChange {
    readonly zone:      DrivingZone;
    readonly discarded: ReadonlyArray<Card>;
}


const needsRoll: ZoneStatus = { kind: "NeedsRoll" };
const rolling: ZoneStatus = { kind: "Rolling" };
const maxSpeedLimitedMiles = 50;
const maxTwoHundreds = 2;


function fail(rejection: Rejection): FailedResult<Rejection> {
    return new FailedResult(rejection);
}


function change(zone: DrivingZone, discarded: ReadonlyArray<Card> = []): SucceededResult<ZoneChange> {
    return new SucceededResult({ zone, discarded });
}


/**
 * Creates the zone of a team at the start of a race.
 * @returns A zone that needs a Roll, with no miles and no safeties
 */
export function newZone(): DrivingZone {
    return { status: needsRoll, speedLimit: false, distance: [], safeties: [] };
}


/**
 * Gets the total miles a team has driven.
 * @param z - The zone
 * @returns The sum of the zone's distance cards
 */
export function zoneMiles(z: DrivingZone): Miles {
    return z.distance.reduce((total, card) => Miles.add(total, distanceMiles(card)), Miles.zero);
}


/**
 * Determines whether a team's car can drive.
 * @param z - The zone
 * @returns true when the car is rolling
 */
export function canMove(z: DrivingZone): boolean {
    return z.status.kind === "Rolling";
}


/**
 * Determines whether a team has played a safety card.
 * @param z - The zone
 * @param card - The safety card
 * @returns true when the safety has been played
 */
export function hasSafety(z: DrivingZone, card: SafetyCard): boolean {
    return z.safeties.some((played) => played.card === card);
}


/**
 * Plays a distance card.  Checks, in order: the car can move, any speed limit,
 * the two-200s limit, and that the trip is not overshot.
 * @param z - The zone to play on
 * @param card - The distance card
 * @param tripDistance - The trip distance in force (700 or 1,000)
 * @returns The new zone, or the reason the card cannot be played
 */
export function playDistance(
    z: DrivingZone,
    card: DistanceCard,
    tripDistance: Miles
): Result<ZoneChange, Rejection> {
    const miles = distanceMiles(card);
    const remaining = Math.max(0, tripDistance - zoneMiles(z)) as Miles;

    if (z.status.kind === "NeedsRoll") {
        return fail({ reason: "NotRolling" });
    }
    if (z.status.kind === "Hazard") {
        return fail({ reason: "BlockedByHazard", hazard: z.status.hazard });
    }
    if (z.speedLimit && miles > maxSpeedLimitedMiles) {
        return fail({ reason: "SpeedLimited" });
    }
    if (card === Card.dist200 && z.distance.filter((c) => c === Card.dist200).length >= maxTwoHundreds) {
        return fail({ reason: "TooManyTwoHundreds" });
    }
    if (miles > remaining) {
        return fail({ reason: "WouldOvershoot", remaining, trip: tripDistance });
    }
    return change({ ...z, distance: [...z.distance, card] });
}


function statusAfterFix(z: DrivingZone): ZoneStatus {
    return hasSafety(z, Card.rightOfWay) ? rolling : needsRoll;
}


function playRoll(z: DrivingZone): Result<ZoneChange, Rejection> {
    if (hasSafety(z, Card.rightOfWay)) {
        return fail({ reason: "RollNotNeeded", because: "RightOfWay" });
    }
    switch (z.status.kind) {
        case "Rolling":
            return fail({ reason: "RollNotNeeded", because: "AlreadyRolling" });
        case "NeedsRoll":
            return change({ ...z, status: rolling }, [Card.roll]);
        case "Hazard":
            return z.status.hazard === Card.stop ?
                change({ ...z, status: rolling }, [Card.roll, Card.stop]) :
                fail({ reason: "BlockedByHazard", hazard: z.status.hazard });
    }
}


/**
 * Plays a remedy card.  A remedy for a calamity leaves the car needing a Roll
 * (or rolling, with Right of Way).
 * @param z - The zone to play on
 * @param card - The remedy card
 * @returns The new zone, or the reason the card cannot be played
 */
export function playRemedy(z: DrivingZone, card: RemedyCard): Result<ZoneChange, Rejection> {
    if (card === Card.roll) {
        return playRoll(z);
    }
    // A team that holds the safety can never be hit, so it never needs the remedy.
    const immune = Option.fromNullable(
        hazardCardSchema.options.find((h) => remedyFor(h) === card && hasSafety(z, safetyFor(h)))
    );
    if (immune.isSome) {
        return fail({ reason: "RemedyNeverNeeded", card, safety: safetyFor(immune.value) });
    }
    if (card === Card.endOfSpeedLimit) {
        return z.speedLimit ?
            change({ ...z, speedLimit: false }, [card, Card.speedLimit]) :
            fail({ reason: "RemedyNotNeeded", card });
    }
    if (z.status.kind === "Hazard" && remedyFor(z.status.hazard) === card) {
        return change({ ...z, status: statusAfterFix(z) }, [card, z.status.hazard]);
    }
    return fail({ reason: "RemedyNotNeeded", card });
}


function applySafety(z: DrivingZone, card: SafetyCard, coupFourre: boolean): ZoneChange {
    const discarded: Array<Card> = [];
    let status = z.status;
    let speedLimit = z.speedLimit;

    if (status.kind === "Hazard" && safetyFor(status.hazard) === card) {
        discarded.push(status.hazard);
        status = rolling;
    }
    if (card === Card.rightOfWay) {
        if (status.kind === "NeedsRoll") {
            status = rolling;
        }
        if (speedLimit) {
            discarded.push(Card.speedLimit);
            speedLimit = false;
        }
    }
    return {
        zone: { ...z, status, speedLimit, safeties: [...z.safeties, { card, coupFourre }] },
        discarded
    };
}


/**
 * Plays a safety card.  It cancels a matching blocking hazard showing, leaving
 * the car rolling; Right of Way also clears a speed limit and starts a car that
 * needs a Roll.  Any other hazard or status is left as it was.
 * @param z - The zone to play on
 * @param card - The safety card
 * @returns The new zone and the cards cleared from it (to be discarded), or
 * SafetyAlreadyPlayed
 */
export function playSafety(z: DrivingZone, card: SafetyCard): Result<ZoneChange, Rejection> {
    if (hasSafety(z, card)) {
        return fail({ reason: "SafetyAlreadyPlayed", safety: card });
    }
    return new SucceededResult(applySafety(z, card, false));
}


/**
 * Determines whether a hazard may be played against a team.
 * @param z - The target's zone
 * @param hazard - The hazard card
 * @returns A successful void result, or the reason the attack is refused
 */
export function canAttack(z: DrivingZone, hazard: HazardCard): Result<void, Rejection> {
    const safety = safetyFor(hazard);
    if (hasSafety(z, safety)) {
        return fail({ reason: "TargetProtected", safety });
    }
    if (hazard === Card.speedLimit) {
        return z.speedLimit ? fail({ reason: "TargetAlreadySpeedLimited" }) : new SucceededResult(undefined);
    }
    return canMove(z) ? new SucceededResult(undefined) : fail({ reason: "TargetNotMoving", hazard });
}


/**
 * Shows a hazard on a team's zone after re-checking that the attack is legal.
 * A Speed Limit sets the speed limit; any other hazard blocks the car.
 * @param z - The target's zone
 * @param hazard - The hazard card
 * @returns The new zone, or the reason the attack is refused
 */
export function landHazard(z: DrivingZone, hazard: HazardCard): Result<ZoneChange, Rejection> {
    return canAttack(z, hazard).mapSuccess(() => hazard === Card.speedLimit ?
        { zone: { ...z, speedLimit: true }, discarded: [] } :
        { zone: { ...z, status: { kind: "Hazard", hazard } satisfies ZoneStatus }, discarded: [] });
}


/**
 * Plays a safety card as a Coup Fourre in response to an attack that was
 * never shown on this zone.  The caller must ensure the safety has not
 * already been played.
 *
 * The caller must discard the hazard in flight (it never reaches this zone)
 * plus every card in `discarded` of the result.  Right of Way clears a Stop
 * and a speed limit already showing (both are in `discarded`) and starts a car
 * that needs a Roll.  Other safeties leave the status unchanged.
 * @param z - The zone of the team playing the Coup Fourre
 * @param card - The safety card
 * @returns The new zone with the safety recorded as a Coup Fourre, and the
 * cards cleared from the zone that must also be discarded
 */
export function playCoupFourre(z: DrivingZone, card: SafetyCard): ZoneChange {
    return applySafety(z, card, true);
}
