import { Card, type DistanceCard, type HazardCard, type RemedyCard, type SafetyCard } from "./card.mjs";
import {
    canAttack, canMove, hasSafety, landHazard, newZone, playCoupFourre, playDistance, playRemedy, playSafety,
    zoneMiles, type DrivingZone, type ZoneChange
} from "./drivingZone.mjs";
import { type Miles } from "./miles.mjs";
import { type Rejection } from "./rejection.mjs";
import { type Result } from "@repo/depot/result";


const trip700 = 700 as Miles;
const trip1000 = 1000 as Miles;


function deepFreeze<T>(value: T): T {
    if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
    }
    return value;
}


function succeeded(result: Result<ZoneChange, Rejection>): ZoneChange {
    return result.throwIfFailed();
}


function rejected(result: Result<unknown, Rejection>): Rejection {
    return result.throwIfSucceeded();
}


function rolling(): DrivingZone {
    return deepFreeze(succeeded(playRemedy(newZone(), Card.roll)).zone);
}


function afterRemedy(zone: DrivingZone, card: RemedyCard): ZoneChange {
    return succeeded(playRemedy(zone, card));
}


function afterHazard(zone: DrivingZone, hazard: HazardCard): DrivingZone {
    return deepFreeze(succeeded(landHazard(zone, hazard)).zone);
}


function afterSafety(zone: DrivingZone, safety: SafetyCard): DrivingZone {
    return deepFreeze(succeeded(playSafety(zone, safety)).zone);
}


function afterDistance(zone: DrivingZone, trip: Miles, ...cards: Array<DistanceCard>): DrivingZone {
    return cards.reduce((z, card) => deepFreeze(succeeded(playDistance(z, card, trip)).zone), zone);
}


function rollingAt(miles: number, trip: Miles = trip1000): DrivingZone {
    const hundreds = Math.floor(miles / 100);
    const rest = miles - hundreds * 100;
    const cards: Array<DistanceCard> = [
        ...Array.from({ length: hundreds }, () => Card.dist100),
        ...(rest === 0 ? [] : [rest === 25 ? Card.dist25 : Card.dist50]),
    ];
    return afterDistance(rolling(), trip, ...cards);
}


describe("drivingZone", () => {

    describe("newZone()", () => {

        it("needs a Roll, has no miles and cannot move", () => {
            const zone = newZone();
            expect(zone.status).toEqual({ kind: "NeedsRoll" });
            expect(zoneMiles(zone) as number).toBe(0);
            expect(canMove(zone)).toBeFalse();
            expect(zone.speedLimit).toBeFalse();
        });

    });


    describe("playDistance()", () => {

        it("rejects NotRolling when a Roll is needed", () => {
            const zone = deepFreeze(newZone());
            expect(rejected(playDistance(zone, Card.dist25, trip1000))).toEqual({ reason: "NotRolling" });
        });


        it("rejects BlockedByHazard when a hazard is showing", () => {
            const zone = afterHazard(rolling(), Card.accident);
            expect(rejected(playDistance(zone, Card.dist25, trip1000)))
            .toEqual({ reason: "BlockedByHazard", hazard: Card.accident });
        });


        it("adds the miles and discards nothing when rolling", () => {
            const zone = rolling();
            const change = succeeded(playDistance(zone, Card.dist75, trip1000));
            expect(zoneMiles(change.zone) as number).toBe(75);
            expect(change.zone.distance).toEqual([Card.dist75]);
            expect(change.discarded).toEqual([]);
            expect(zoneMiles(zone) as number).toBe(0);
        });


        it("allows only 25 and 50 under a speed limit", () => {
            const zone = afterHazard(rolling(), Card.speedLimit);
            expect(rejected(playDistance(zone, Card.dist75, trip1000))).toEqual({ reason: "SpeedLimited" });
            expect(rejected(playDistance(zone, Card.dist100, trip1000))).toEqual({ reason: "SpeedLimited" });
            expect(rejected(playDistance(zone, Card.dist200, trip1000))).toEqual({ reason: "SpeedLimited" });
            expect(zoneMiles(succeeded(playDistance(zone, Card.dist50, trip1000)).zone) as number).toBe(50);
            expect(zoneMiles(succeeded(playDistance(zone, Card.dist25, trip1000)).zone) as number).toBe(25);
        });


        it("refuses to pass a 1,000-mile trip", () => {
            const zone = rollingAt(900);
            expect(rejected(playDistance(zone, Card.dist200, trip1000)))
            .toEqual({ reason: "WouldOvershoot", remaining: 100 as Miles, trip: trip1000 });
            expect(zoneMiles(succeeded(playDistance(zone, Card.dist100, trip1000)).zone) as number).toBe(1000);
        });


        it("refuses to pass a 700-mile trip", () => {
            const zone = rollingAt(650, trip700);
            const overshoot: Rejection = { reason: "WouldOvershoot", remaining: 50 as Miles, trip: trip700 };
            expect(rejected(playDistance(zone, Card.dist100, trip700))).toEqual(overshoot);
            expect(rejected(playDistance(zone, Card.dist75, trip700))).toEqual(overshoot);
            expect(zoneMiles(succeeded(playDistance(zone, Card.dist50, trip700)).zone) as number).toBe(700);
            expect(zoneMiles(succeeded(playDistance(zone, Card.dist25, trip700)).zone) as number).toBe(675);
        });


        it("allows at most two 200-mile cards", () => {
            const zone = afterDistance(rolling(), trip1000, Card.dist200, Card.dist200);
            expect(rejected(playDistance(zone, Card.dist200, trip1000))).toEqual({ reason: "TooManyTwoHundreds" });
            expect(zoneMiles(zone) as number).toBe(400);
        });


        it("checks movement before speed, speed before 200s, and 200s before overshoot", () => {
            const twoHundreds = afterDistance(rolling(), trip1000, Card.dist200, Card.dist200);
            expect(rejected(playDistance(afterHazard(newZone(), Card.speedLimit), Card.dist100, trip1000)))
            .toEqual({ reason: "NotRolling" });
            expect(rejected(playDistance(afterHazard(twoHundreds, Card.speedLimit), Card.dist200, trip1000)))
            .toEqual({ reason: "SpeedLimited" });
            const hundreds = Array.from({ length: 5 }, () => Card.dist100);
            const at900 = afterDistance(twoHundreds, trip1000, ...hundreds);
            expect(rejected(playDistance(at900, Card.dist200, trip1000))).toEqual({ reason: "TooManyTwoHundreds" });
        });

    });


    describe("playRemedy()", () => {

        it("Roll starts a car that needs a Roll", () => {
            const change = afterRemedy(deepFreeze(newZone()), Card.roll);
            expect(change.zone.status).toEqual({ kind: "Rolling" });
            expect(change.discarded).toEqual([Card.roll]);
        });


        it("rejects Roll while already rolling", () => {
            expect(rejected(playRemedy(rolling(), Card.roll)))
            .toEqual({ reason: "RollNotNeeded", because: "AlreadyRolling" });
        });


        it("rejects Roll when the team has Right of Way", () => {
            const zone = afterSafety(newZone(), Card.rightOfWay);
            expect(rejected(playRemedy(zone, Card.roll)))
            .toEqual({ reason: "RollNotNeeded", because: "RightOfWay" });
            expect(rejected(playRemedy(afterSafety(rolling(), Card.rightOfWay), Card.roll)))
            .toEqual({ reason: "RollNotNeeded", because: "RightOfWay" });
        });


        it("rejects Roll while an accident, flat tire or out of gas must be fixed first", () => {
            const zone = afterHazard(rolling(), Card.accident);
            expect(rejected(playRemedy(zone, Card.roll))).toEqual({ reason: "BlockedByHazard", hazard: Card.accident });
        });


        it("rejects a remedy with nothing to cure", () => {
            expect(rejected(playRemedy(rolling(), Card.repairs)))
            .toEqual({ reason: "RemedyNotNeeded", card: Card.repairs });
            expect(rejected(playRemedy(rolling(), Card.endOfSpeedLimit)))
            .toEqual({ reason: "RemedyNotNeeded", card: Card.endOfSpeedLimit });
            expect(rejected(playRemedy(afterHazard(rolling(), Card.stop), Card.repairs)))
            .toEqual({ reason: "RemedyNotNeeded", card: Card.repairs });
            expect(rejected(playRemedy(afterHazard(rolling(), Card.flatTire), Card.gasoline)))
            .toEqual({ reason: "RemedyNotNeeded", card: Card.gasoline });
        });


        it("fixing a calamity leaves the car needing a Roll", () => {
            const zone = afterHazard(rolling(), Card.accident);
            const change = afterRemedy(zone, Card.repairs);
            expect(change.zone.status).toEqual({ kind: "NeedsRoll" });
            expect(change.discarded).toEqual([Card.repairs, Card.accident]);
        });


        it("fixing a calamity leaves a Right of Way car rolling", () => {
            const zone = afterHazard(afterSafety(rolling(), Card.rightOfWay), Card.accident);
            const change = afterRemedy(zone, Card.repairs);
            expect(change.zone.status).toEqual({ kind: "Rolling" });
            expect(change.discarded).toEqual([Card.repairs, Card.accident]);
        });


        it("fixes out of gas with Gasoline and a flat tire with Spare Tire", () => {
            const gas = afterRemedy(afterHazard(rolling(), Card.outOfGas), Card.gasoline);
            expect(gas.zone.status).toEqual({ kind: "NeedsRoll" });
            expect(gas.discarded).toEqual([Card.gasoline, Card.outOfGas]);
            const tire = afterRemedy(afterHazard(rolling(), Card.flatTire), Card.spareTire);
            expect(tire.zone.status).toEqual({ kind: "NeedsRoll" });
            expect(tire.discarded).toEqual([Card.spareTire, Card.flatTire]);
        });


        it("Roll fixes a Stop", () => {
            const change = afterRemedy(afterHazard(rolling(), Card.stop), Card.roll);
            expect(change.zone.status).toEqual({ kind: "Rolling" });
            expect(change.discarded).toEqual([Card.roll, Card.stop]);
        });


        it("End of Speed Limit lifts a speed limit without changing the status", () => {
            const zone = afterHazard(rolling(), Card.speedLimit);
            const change = afterRemedy(zone, Card.endOfSpeedLimit);
            expect(change.zone.speedLimit).toBeFalse();
            expect(change.zone.status).toEqual({ kind: "Rolling" });
            expect(change.discarded).toEqual([Card.endOfSpeedLimit, Card.speedLimit]);
            expect(zone.speedLimit).toBeTrue();
        });

    });


    describe("canAttack()", () => {

        it("refuses accident, out of gas, flat tire and stop on a car that is not rolling", () => {
            const needsRoll = deepFreeze(newZone());
            const hazardous = afterHazard(rolling(), Card.stop);
            for (const hazard of [Card.accident, Card.outOfGas, Card.flatTire, Card.stop] as const) {
                expect(rejected(canAttack(needsRoll, hazard))).toEqual({ reason: "TargetNotMoving", hazard });
                expect(rejected(canAttack(hazardous, hazard))).toEqual({ reason: "TargetNotMoving", hazard });
            }
        });


        it("allows every hazard on a rolling car", () => {
            for (const hazard of [Card.accident, Card.outOfGas, Card.flatTire, Card.stop, Card.speedLimit] as const) {
                expect(canAttack(rolling(), hazard).succeeded).toBeTrue();
            }
        });


        it("allows a speed limit on a car that needs a Roll or has a hazard", () => {
            expect(canAttack(deepFreeze(newZone()), Card.speedLimit).succeeded).toBeTrue();
            expect(canAttack(afterHazard(rolling(), Card.accident), Card.speedLimit).succeeded).toBeTrue();
        });


        it("refuses a second speed limit", () => {
            const zone = afterHazard(rolling(), Card.speedLimit);
            expect(rejected(canAttack(zone, Card.speedLimit))).toEqual({ reason: "TargetAlreadySpeedLimited" });
        });


        it("refuses speed limit and stop against Right of Way", () => {
            const zone = afterSafety(rolling(), Card.rightOfWay);
            const protectedBy: Rejection = { reason: "TargetProtected", safety: Card.rightOfWay };
            expect(rejected(canAttack(zone, Card.speedLimit))).toEqual(protectedBy);
            expect(rejected(canAttack(zone, Card.stop))).toEqual(protectedBy);
        });


        it("refuses each calamity against its safety", () => {
            const pairs = [
                [Card.accident, Card.drivingAce],
                [Card.outOfGas, Card.extraTank],
                [Card.flatTire, Card.punctureProof],
            ] as const;
            for (const [hazard, safety] of pairs) {
                const zone = afterSafety(rolling(), safety);
                expect(rejected(canAttack(zone, hazard))).toEqual({ reason: "TargetProtected", safety });
            }
        });

    });


    describe("landHazard()", () => {

        it("shows a blocking hazard on a rolling car", () => {
            const zone = rolling();
            const change = succeeded(landHazard(zone, Card.accident));
            expect(change.zone.status).toEqual({ kind: "Hazard", hazard: Card.accident });
            expect(change.discarded).toEqual([]);
            expect(canMove(change.zone)).toBeFalse();
            expect(zone.status).toEqual({ kind: "Rolling" });
        });


        it("sets the speed limit without changing the status", () => {
            const change = succeeded(landHazard(rolling(), Card.speedLimit));
            expect(change.zone.speedLimit).toBeTrue();
            expect(change.zone.status).toEqual({ kind: "Rolling" });
        });


        it("re-checks canAttack", () => {
            expect(rejected(landHazard(deepFreeze(newZone()), Card.stop)))
            .toEqual({ reason: "TargetNotMoving", hazard: Card.stop });
            expect(rejected(landHazard(afterHazard(rolling(), Card.speedLimit), Card.speedLimit)))
            .toEqual({ reason: "TargetAlreadySpeedLimited" });
        });

    });


    describe("playSafety()", () => {

        it("cancels the matching calamity and leaves the car rolling", () => {
            const pairs = [
                [Card.accident, Card.drivingAce],
                [Card.outOfGas, Card.extraTank],
                [Card.flatTire, Card.punctureProof],
            ] as const;
            for (const [hazard, safety] of pairs) {
                const change = succeeded(playSafety(afterHazard(rolling(), hazard), safety));
                expect(change.zone.status).toEqual({ kind: "Rolling" });
                expect(change.discarded).toEqual([hazard]);
                expect(change.zone.safeties).toEqual([{ card: safety, coupFourre: false }]);
                expect(hasSafety(change.zone, safety)).toBeTrue();
            }
        });


        it("leaves an unrelated hazard in place", () => {
            const zone = afterHazard(rolling(), Card.accident);
            const change = succeeded(playSafety(zone, Card.punctureProof));
            expect(change.zone.status).toEqual({ kind: "Hazard", hazard: Card.accident });
            expect(change.discarded).toEqual([]);
        });


        it("Right of Way cancels a Stop and a speed limit", () => {
            const zone = afterHazard(afterHazard(rolling(), Card.speedLimit), Card.stop);
            const change = succeeded(playSafety(zone, Card.rightOfWay));
            expect(change.zone.status).toEqual({ kind: "Rolling" });
            expect(change.zone.speedLimit).toBeFalse();
            expect(change.discarded).toEqual([Card.stop, Card.speedLimit]);
        });


        it("Right of Way keeps a flat tire but clears the speed limit", () => {
            const zone = afterHazard(afterHazard(rolling(), Card.speedLimit), Card.flatTire);
            const change = succeeded(playSafety(zone, Card.rightOfWay));
            expect(change.zone.status).toEqual({ kind: "Hazard", hazard: Card.flatTire });
            expect(change.zone.speedLimit).toBeFalse();
            expect(change.discarded).toEqual([Card.speedLimit]);
        });


        it("Right of Way starts a car that needs a Roll", () => {
            const change = succeeded(playSafety(deepFreeze(newZone()), Card.rightOfWay));
            expect(change.zone.status).toEqual({ kind: "Rolling" });
            expect(canMove(change.zone)).toBeTrue();
        });


        it("rejects the same safety twice", () => {
            const zone = afterSafety(rolling(), Card.extraTank);
            expect(rejected(playSafety(zone, Card.extraTank)))
            .toEqual({ reason: "SafetyAlreadyPlayed", safety: Card.extraTank });
        });

    });


    describe("playCoupFourre()", () => {

        it("records a coup fourre and leaves the status unchanged", () => {
            const zone = rolling();
            const change = playCoupFourre(zone, Card.punctureProof);
            expect(change.zone.status).toEqual({ kind: "Rolling" });
            expect(change.zone.safeties).toEqual([{ card: Card.punctureProof, coupFourre: true }]);
            expect(change.discarded).toEqual([]);
            expect(zone.safeties).toEqual([]);
        });


        it("Right of Way as a coup fourre also clears an existing speed limit", () => {
            const zone = afterHazard(rolling(), Card.speedLimit);
            const change = playCoupFourre(zone, Card.rightOfWay);
            expect(change.zone.speedLimit).toBeFalse();
            expect(change.discarded).toEqual([Card.speedLimit]);
        });

    });


    describe("zoneMiles()", () => {

        it("sums the distance cards", () => {
            expect(zoneMiles(rollingAt(325)) as number).toBe(325);
        });

    });


    describe("hasSafety()", () => {

        it("is false until the safety is played", () => {
            expect(hasSafety(rolling(), Card.drivingAce)).toBeFalse();
            expect(hasSafety(afterSafety(rolling(), Card.drivingAce), Card.drivingAce)).toBeTrue();
        });

    });

});
