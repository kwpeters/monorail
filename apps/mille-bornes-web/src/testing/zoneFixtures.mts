import {
    Card, type BlockingHazard, type DistanceCard, type SafetyCard
} from "@repo/mille-bornes-core/card";
import {
    landHazard, newZone, playCoupFourre, playDistance, playRemedy, playSafety,
    type DrivingZone
} from "@repo/mille-bornes-core/drivingZone";
import { FULL_TRIP_MILES } from "@repo/mille-bornes-core/variant";


// Test support: never import this from production code.  Zones are built by
// applying core's own rules, so they are states a real game can reach.


/**
 * A team that has rolled and then driven the given cards.
 * @param distance - The distance cards, in play order (default none)
 * @returns The zone
 */
export function rollingZone(distance: ReadonlyArray<DistanceCard> = []): DrivingZone {
    let zone = playRemedy(newZone(), Card.roll).throwIfFailed().zone;
    for (const card of distance) {
        zone = playDistance(zone, card, FULL_TRIP_MILES).throwIfFailed().zone;
    }
    return zone;
}


/**
 * A rolling team that has been hit by a blocking hazard.
 * @param hazard - The hazard
 * @param distance - Distance cards driven first (default none)
 * @returns The zone
 */
export function blockedZone(
    hazard: BlockingHazard,
    distance: ReadonlyArray<DistanceCard> = []
): DrivingZone {
    return landHazard(rollingZone(distance), hazard).throwIfFailed().zone;
}


/**
 * A rolling team under a Speed Limit.
 * @returns The zone
 */
export function speedLimitedZone(): DrivingZone {
    return landHazard(rollingZone(), Card.speedLimit).throwIfFailed().zone;
}


/**
 * Adds a safety played in the ordinary way.
 * @param zone - The zone
 * @param safety - The safety
 * @returns The new zone
 */
export function withSafety(zone: DrivingZone, safety: SafetyCard): DrivingZone {
    return playSafety(zone, safety).throwIfFailed().zone;
}


/**
 * Adds a safety played as a Coup Fourre.
 * @param zone - The zone
 * @param safety - The safety
 * @returns The new zone
 */
export function withCoupFourre(zone: DrivingZone, safety: SafetyCard): DrivingZone {
    return playCoupFourre(zone, safety).zone;
}
