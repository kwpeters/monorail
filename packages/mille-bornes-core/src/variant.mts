import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { type DeckKind } from "./deck.mjs";
import { type TeamIndex } from "./ids.mjs";
import { type Miles } from "./miles.mjs";
import { type Rejection } from "./rejection.mjs";


/**
 * The rulebook's variant for a seat count: the team structure, the initial
 * trip distance, whether Extension is played, and the deck.
 */
export interface RaceVariant {
    readonly teamCount:    2 | 3;
    readonly teamSize:     1 | 2;
    readonly tripDistance: Miles;
    readonly extension:    boolean;
    readonly deck:         DeckKind;
}


/** The trip distance while Extension may still be called. */
export const EXTENSION_MILES = 700 as Miles;

/** The trip distance without Extension or after it is called. */
export const FULL_TRIP_MILES = 1000 as Miles;


// Keyed by seat count.
/* eslint-disable @typescript-eslint/naming-convention */
const variants: Readonly<Partial<Record<number, RaceVariant>>> = {
    2: { teamCount: 2, teamSize: 1, tripDistance: EXTENSION_MILES, extension: true, deck: "Reduced" },
    3: { teamCount: 3, teamSize: 1, tripDistance: EXTENSION_MILES, extension: true, deck: "Reduced" },
    4: { teamCount: 2, teamSize: 2, tripDistance: FULL_TRIP_MILES, extension: false, deck: "Standard" },
    6: { teamCount: 3, teamSize: 2, tripDistance: EXTENSION_MILES, extension: true, deck: "Standard" },
};
/* eslint-enable @typescript-eslint/naming-convention */


/**
 * Gets the variant for a number of seats (robots included).
 * @param seats - The number of seats
 * @returns The variant, or UnsupportedPlayerCount unless seats is 2, 3, 4 or 6
 */
export function variantForSeatCount(seats: number): Result<RaceVariant, Rejection> {
    const variant = variants[seats];
    return variant ?
        new SucceededResult(variant) :
        new FailedResult({ reason: "UnsupportedPlayerCount", count: seats });
}


/**
 * Whether Extension does not apply to this game, may still be called, or has
 * been called by a team.
 */
export type ExtensionState =
    | { readonly kind: "NotApplicable" }
    | { readonly kind: "Available" }
    | { readonly kind: "Called"; readonly caller: TeamIndex };


/**
 * Gets the Extension state at the start of a race.
 * @param v - The variant
 * @returns Available when the variant plays Extension, else NotApplicable
 */
export function initialExtension(v: RaceVariant): ExtensionState {
    return v.extension ? { kind: "Available" } : { kind: "NotApplicable" };
}


/**
 * Gets the trip distance currently in force.
 * @param e - The Extension state
 * @returns 700 while Extension is Available, otherwise 1,000
 */
export function tripDistance(e: ExtensionState): Miles {
    return e.kind === "Available" ? EXTENSION_MILES : FULL_TRIP_MILES;
}
