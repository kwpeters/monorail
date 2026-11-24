import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { getRandom } from "@repo/depot/random";
import { PlayerName } from "./playerName.mjs";


// Each must be valid under `PlayerName.tryCreate()` (the tests check).
const rawNames: ReadonlyArray<string> = [
    "Sir Honks-a-Lot",
    "Gary the Flat Tire",
    "Captain Crumbs",
    "Professor Pothole",
    "Lady Dashboard",
    "Turbo Turnip",
    "Madame Muffler",
    "Baron von Beepington",
    "Wobbly Wanda",
    "Admiral Fender",
    "Zippy McZoom",
    "Duchess of Detour",
    "Gearbox Gus",
    "Sputter",
    "Colonel Cupholder",
    "Honkers McGee",
    "Sally Sideswipe",
    "Doctor Dipstick",
    "Mr. Backseat Driver",
    "Pedal Pete",
    "Granny Gasket",
    "Bumper Betty",
    "Skid Marks Sam",
    "Count Carburetor",
    "Lunchbox Larry",
    "Princess Piston",
    "Roadrunner Ron",
    "Fuzzy Dice Dave",
    "Queen of the Cones",
    "Detour Dan",
    "Moose Crossing",
    "Cruise Control Carl",
    "Gasket Gertrude",
    "Noodle Nate",
    "Waffle Wheels",
    "Captain Seatbelt",
    "Rusty Bolt",
    "Pickle Pilot",
    "Lord Speedbump",
    "Tiny Tim Tires",
];


/**
 * The pool of funny names shared by robots and by humans who press
 * "Surprise me".
 */
export const whimsicalNames: ReadonlyArray<PlayerName> =
    rawNames.map((raw) => PlayerName.tryCreate(raw).throwIfFailed());


/**
 * Picks a random whimsical name that nobody is using.
 * @param taken - The names already in use; a name that differs only by case,
 * spacing or accents counts as in use
 * @param rand - Returns a number from 0 (included) to 1 (excluded)
 * @returns The name, or a failed result when every name in the pool is taken
 */
export function pickWhimsicalName(
    taken:  ReadonlyArray<PlayerName>,
    rand:   () => number = getRandom
): Result<PlayerName, string> {
    const available = whimsicalNames.filter((name) => !taken.some((t) => PlayerName.isSame(t, name)));
    if (available.length === 0) {
        return new FailedResult("Every whimsical name is already taken.");
    }
    // Clamp so that a misbehaving `rand` cannot index past the end.
    const index = Math.min(available.length - 1, Math.max(0, Math.floor(rand() * available.length)));
    return new SucceededResult(available[index]!);
}
