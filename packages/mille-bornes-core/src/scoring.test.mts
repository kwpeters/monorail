import { Card, type DistanceCard, type SafetyCard } from "./card.mjs";
import { newZone, type DrivingZone } from "./drivingZone.mjs";
import { type TeamIndex } from "./ids.mjs";
import { type Points } from "./points.mjs";
import {
    pointsGoal, resolveRace, scoreRace, standardScoring, type GameLength, type RaceOutcome,
    type RaceResolution, type RaceScore
} from "./scoring.mjs";
import { deepFreeze } from "./testHelpers.mjs";


const team0 = 0 as TeamIndex;
const team1 = 1 as TeamIndex;
const hundred = Card.dist100;
const twoHundred = Card.dist200;


function zone(
    distance: ReadonlyArray<DistanceCard>,
    safeties: ReadonlyArray<SafetyCard> = [],
    coupFourres: ReadonlyArray<SafetyCard> = []
): DrivingZone {
    return deepFreeze({
        ...newZone(),
        distance,
        safeties: [
            ...safeties.map((card) => ({ card, coupFourre: false })),
            ...coupFourres.map((card) => ({ card, coupFourre: true })),
        ],
    });
}


function repeat<T>(card: T, count: number): Array<T> {
    return Array.from({ length: count }, () => card);
}


function pts(...values: Array<number>): Array<Points> {
    return values as Array<Points>;
}


const exhausted: RaceOutcome = deepFreeze({ kind: "Exhausted", winner: "Tie", extensionCaller: null });
const allFour: ReadonlyArray<SafetyCard> = [Card.drivingAce, Card.extraTank, Card.punctureProof, Card.rightOfWay];
const completedZone = zone(repeat(hundred, 10));


function tripBy(
    team: TeamIndex,
    delayedAction = false,
    extensionCaller: TeamIndex | null = null
): RaceOutcome {
    return deepFreeze({ kind: "TripCompleted", team, delayedAction, extensionCaller });
}


function rowSum(s: RaceScore): number {
    return s.milestones + s.safeties + s.coupFourres + s.tripCompleted + s.delayedAction +
        s.safeTrip + s.shutout + s.extension;
}


function score(
    zones: ReadonlyArray<DrivingZone>,
    outcome: RaceOutcome,
    broughtForward: ReadonlyArray<number> = zones.map(() => 0)
): ReadonlyArray<RaceScore> {
    return scoreRace(standardScoring, deepFreeze([...zones]), outcome, deepFreeze(pts(...broughtForward)));
}


function resolve(length: GameLength, totals: Array<number>, outcome: RaceOutcome = exhausted): RaceResolution {
    return resolveRace(length, pts(...totals), outcome);
}


interface Scenario {
    readonly name:           string;
    readonly broughtForward: Array<number>;
    readonly scores:         ReadonlyArray<RaceScore>;
}


const scenarios: ReadonlyArray<Scenario> = [
    {
        name:           "plain safety",
        broughtForward: [1000],
        scores:         score(
            [zone([hundred, hundred, hundred, hundred, Card.dist25], [Card.drivingAce])],
            exhausted,
            [1000]
        )
    },
    { name: "all four safeties", broughtForward: [0], scores: score([zone([], allFour)], exhausted) },
    { name: "coup fourre", broughtForward: [0], scores: score([zone([], [], [Card.extraTank])], exhausted) },
    {
        name:           "shutout trip",
        broughtForward: [50, 70],
        scores:         score([completedZone, zone([])], tripBy(team0), [50, 70])
    },
    {
        name:           "delayed trip",
        broughtForward: [0, 0],
        scores:         score([completedZone, zone([Card.dist25])], tripBy(team0, true))
    },
    {
        name:           "extension caller wins",
        broughtForward: [0, 0],
        scores:         score([completedZone, zone([])], tripBy(team0, false, team0))
    },
    {
        name:           "extension caller fails",
        broughtForward: [0, 0, 0],
        scores:         score([zone([]), completedZone, zone([])], tripBy(team1, false, team0))
    },
    {
        name:           "extension exhausted",
        broughtForward: [0, 0],
        scores:         score([zone([]), zone([])], { kind: "Exhausted", winner: "Tie", extensionCaller: team0 })
    },
];


describe("scoring", () => {

    describe("standardScoring", () => {

        it("has the owner-decided values", () => {
            expect(standardScoring).toEqual({
                perMile:         1,
                perSafety:       100,
                allFourSafeties: 300,
                coupFourre:      300,
                tripCompleted:   400,
                delayedAction:   300,
                safeTrip:        300,
                shutout:         500,
                extension:       200,
            });
        });

    });


    describe("scoreRace()", () => {

        it("scores miles and a plain safety, adding the brought-forward total", () => {
            const [s] = score(
                [zone([hundred, hundred, hundred, hundred, Card.dist25], [Card.drivingAce])],
                exhausted,
                [1000]
            );
            expect(s!.miles as number).toBe(425);
            expect(s!.milestones as number).toBe(425);
            expect(s!.safetyCount).toBe(1);
            expect(s!.safeties as number).toBe(100);
            expect(s!.totalForRace as number).toBe(525);
            expect(s!.combinedTotal as number).toBe(1525);
        });


        it("adds 300 to the safeties when a team has all four", () => {
            const [s] = score([zone([], allFour)], exhausted);
            expect(s!.safetyCount).toBe(4);
            expect(s!.safeties as number).toBe(700);
            expect(s!.totalForRace as number).toBe(700);
        });


        it("adds 300 for a Coup Fourre on top of the safety's 100", () => {
            const [s] = score([zone([], [], [Card.extraTank])], exhausted);
            expect(s!.safetyCount).toBe(1);
            expect(s!.safeties as number).toBe(100);
            expect(s!.coupFourreCount).toBe(1);
            expect(s!.coupFourres as number).toBe(300);
            expect(s!.totalForRace as number).toBe(400);
        });


        it("scores the trip, safe trip and shutout bonuses against a team with no miles", () => {
            const [s] = score([completedZone, zone([])], tripBy(team0));
            expect(s!.tripCompleted as number).toBe(400);
            expect(s!.safeTrip as number).toBe(300);
            expect(s!.shutout as number).toBe(500);
            expect(s!.delayedAction as number).toBe(0);
            expect(s!.extension as number).toBe(0);
            expect(s!.totalForRace as number).toBe(2200);
        });


        it("withholds the shutout when an opponent has driven", () => {
            const [s] = score([completedZone, zone([Card.dist25])], tripBy(team0));
            expect(s!.shutout as number).toBe(0);
            expect(s!.totalForRace as number).toBe(1700);
        });


        it("adds the delayed action bonus", () => {
            const [s] = score([completedZone, zone([Card.dist25])], tripBy(team0, true));
            expect(s!.delayedAction as number).toBe(300);
            expect(s!.totalForRace as number).toBe(2000);
        });


        it("withholds the safe trip bonus when a 200-mile card was played", () => {
            const [s] = score([zone([twoHundred, twoHundred, ...repeat(hundred, 6)]), zone([])], tripBy(team0));
            expect(s!.miles as number).toBe(1000);
            expect(s!.safeTrip as number).toBe(0);
        });


        it("gives the other team no trip bonuses but keeps its miles and safeties", () => {
            const [, s] = score([completedZone, zone([hundred], [Card.rightOfWay])], tripBy(team0));
            expect(s!.tripCompleted as number).toBe(0);
            expect(s!.delayedAction as number).toBe(0);
            expect(s!.safeTrip as number).toBe(0);
            expect(s!.shutout as number).toBe(0);
            expect(s!.milestones as number).toBe(100);
            expect(s!.safeties as number).toBe(100);
        });


        it("awards the shutout with three teams only when both opponents have no miles", () => {
            const both = score([completedZone, zone([]), zone([])], tripBy(team0));
            expect(both[0]!.shutout as number).toBe(500);
            const one = score([completedZone, zone([]), zone([Card.dist25])], tripBy(team0));
            expect(one[0]!.shutout as number).toBe(0);
        });


        it("returns one score per team, carrying each brought-forward total", () => {
            const scores = score([zone([]), zone([]), zone([])], exhausted, [10, 20, 30]);
            expect(scores.map((s) => s.broughtForward as number)).toEqual([10, 20, 30]);
        });


        describe("Extension", () => {

            it("pays the caller 200 when the caller completes the trip", () => {
                const scores = score([completedZone, zone([])], tripBy(team0, false, team0));
                expect(scores.map((s) => s.extension as number)).toEqual([200, 0]);
                expect(scores[0]!.tripCompleted as number).toBe(400);
            });


            it("pays every other team 200 when another team completes first", () => {
                const scores = score([zone([]), completedZone, zone([])], tripBy(team1, false, team0));
                expect(scores.map((s) => s.extension as number)).toEqual([0, 200, 200]);
                expect(scores[1]!.tripCompleted as number).toBe(400);
                expect(scores[0]!.tripCompleted as number).toBe(0);
            });


            it("pays the opponent 200 when the cards run out", () => {
                const scores = score(
                    [zone([]), zone([])],
                    { kind: "Exhausted", winner: "Tie", extensionCaller: team0 }
                );
                expect(scores.map((s) => s.extension as number)).toEqual([0, 200]);
            });


            it("pays nothing when nobody called Extension", () => {
                const scores = score([completedZone, zone([]), zone([])], tripBy(team0));
                expect(scores.every((s) => s.extension === 0)).toBeTrue();
            });

        });


        describe("invariants", () => {

            it("makes totalForRace the sum of its rows and combinedTotal the sum with broughtForward", () => {
                for (const scenario of scenarios) {
                    scenario.scores.forEach((s, i) => {
                        const context = `${scenario.name}, team ${i}`;
                        expect(s.totalForRace as number).withContext(context).toBe(rowSum(s));
                        expect(s.combinedTotal as number).withContext(context)
                        .toBe(scenario.broughtForward[i]! + s.totalForRace);
                    });
                }
            });

        });

    });


    describe("pointsGoal()", () => {

        it("is null for Quick, 2000 for Short and 5000 for Full", () => {
            expect(pointsGoal("Quick")).toBeNull();
            expect(pointsGoal("Short") as number).toBe(2000);
            expect(pointsGoal("Full") as number).toBe(5000);
        });

    });


    describe("resolveRace()", () => {

        it("ends a Quick game when a team completes the trip", () => {
            expect(resolve("Quick", [0, 0], tripBy(team1))).toEqual({ kind: "GameOver", winner: team1 });
        });


        it("ends a Quick game for the Exhausted winner, and continues on a Tie", () => {
            expect(resolve("Quick", [0, 0], { kind: "Exhausted", winner: team0, extensionCaller: null }))
            .toEqual({ kind: "GameOver", winner: team0 });
            expect(resolve("Quick", [0, 0], { kind: "Exhausted", winner: "Tie", extensionCaller: null }))
            .toEqual({ kind: "NextRace" });
        });


        it("ends a Short game when the leader has reached 2000", () => {
            expect(resolve("Short", [2100, 1900])).toEqual({ kind: "GameOver", winner: team0 });
        });


        it("continues a Short game when no team has reached 2000", () => {
            expect(resolve("Short", [1900, 1500])).toEqual({ kind: "NextRace" });
        });


        it("continues when the highest total is tied", () => {
            expect(resolve("Short", [2000, 2000])).toEqual({ kind: "NextRace" });
        });


        it("awards the highest total when both teams passed the goal", () => {
            expect(resolve("Short", [2100, 2150])).toEqual({ kind: "GameOver", winner: team1 });
        });


        it("ends a Full game at exactly 5000 but not at 4999", () => {
            expect(resolve("Full", [5000, 4999])).toEqual({ kind: "GameOver", winner: team0 });
            expect(resolve("Full", [4999, 4000])).toEqual({ kind: "NextRace" });
        });


        it("continues with three teams when the top two are tied", () => {
            expect(resolve("Short", [2100, 2100, 500])).toEqual({ kind: "NextRace" });
        });

    });

});
