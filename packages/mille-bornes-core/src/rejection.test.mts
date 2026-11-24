import { Card, blockingHazardSchema, hazardCardSchema, remedyCardSchema, safetyCardSchema } from "./card.mjs";
import { type Miles } from "./miles.mjs";
import { describeRejection, type Rejection } from "./rejection.mjs";


describe("rejection", () => {

    describe("describeRejection()", () => {

        it("explains the fixed-text rejections", () => {
            expect(describeRejection({ reason: "TooManyTwoHundreds" }))
            .toBe("Each team can only play two 200-mile cards per race.");
            expect(describeRejection({ reason: "NotRolling" }))
            .toBe("You can't drive yet. Play a Roll card first.");
            expect(describeRejection({ reason: "SpeedLimited" })).toBe(
                "A speed limit is active: you can only play 25- or 50-mile cards until you play End of Speed Limit."
            );
        });


        it("explains an overshoot", () => {
            expect(describeRejection({ reason: "WouldOvershoot", remaining: 50 as Miles, trip: 700 as Miles }))
            .toBe("That would take you past 700 miles. You have 50 miles to go and must land on 700 exactly.");
        });


        it("formats miles with a thousands separator", () => {
            expect(describeRejection({ reason: "WouldOvershoot", remaining: 100 as Miles, trip: 1000 as Miles }))
            .toBe("That would take you past 1,000 miles. You have 100 miles to go and must land on 1,000 exactly.");
        });


        it("produces a clean non-empty message for every variant", () => {
            const rejections: Array<Rejection> = [
                { reason: "NotRolling" },
                ...blockingHazardSchema.options.map((hazard): Rejection => ({ reason: "BlockedByHazard", hazard })),
                { reason: "SpeedLimited" },
                { reason: "WouldOvershoot", remaining: 25 as Miles, trip: 1000 as Miles },
                { reason: "TooManyTwoHundreds" },
                ...remedyCardSchema.options.map((card): Rejection => ({ reason: "RemedyNotNeeded", card })),
                { reason: "RollNotNeeded", because: "AlreadyRolling" },
                { reason: "RollNotNeeded", because: "RightOfWay" },
                { reason: "CannotAttackOwnTeam" },
                ...hazardCardSchema.options.map((hazard): Rejection => ({ reason: "TargetNotMoving", hazard })),
                ...safetyCardSchema.options.map((safety): Rejection => ({ reason: "TargetProtected", safety })),
                { reason: "TargetAlreadySpeedLimited" },
                ...safetyCardSchema.options.map((safety): Rejection => ({ reason: "SafetyAlreadyPlayed", safety })),
            ];
            for (const rejection of rejections) {
                const text = describeRejection(rejection);
                expect(text.length).toBeGreaterThan(0);
                expect(text).not.toContain("undefined");
                expect(text).not.toContain("[object");
            }
        });


        it("names the card that fixes a blocking hazard", () => {
            expect(describeRejection({ reason: "BlockedByHazard", hazard: Card.accident })).toContain(Card.repairs);
        });

    });

});
