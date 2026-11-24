import { Card, blockingHazardSchema, cardSchema, hazardCardSchema, remedyCardSchema, safetyCardSchema } from "./card.mjs";
import { type Miles } from "./miles.mjs";
import { type PlayerName } from "./playerName.mjs";
import { describeRejection, type Rejection } from "./rejection.mjs";


const ann = "Ann" as PlayerName;


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
                { reason: "NotYourTurn", current: ann },
                ...cardSchema.options.map((card): Rejection => ({ reason: "CardNotInHand", card })),
                { reason: "WrongPhase" },
                { reason: "WindowOpen" },
                { reason: "NoWindowOpen" },
                { reason: "NotOnTargetTeam" },
                ...hazardCardSchema.options.flatMap((hazard) => safetyCardSchema.options.map(
                    (card): Rejection => ({ reason: "WrongSafetyForHazard", hazard, card })
                )),
                { reason: "ExtensionOfferOpen", decider: ann },
                { reason: "NoExtensionOffer" },
                { reason: "NotTheCaller", decider: ann },
                ...[0, 1, 5, 7, 12].map((count): Rejection => ({ reason: "UnsupportedPlayerCount", count })),
                { reason: "WrongDeck" },
            ];
            for (const rejection of rejections) {
                const text = describeRejection(rejection);
                expect(text.length).toBeGreaterThan(0);
                expect(text).not.toContain("undefined");
                expect(text).not.toContain("[object");
            }
        });


        it("names the card that fixes a blocking hazard", () => {
            expect(describeRejection({ reason: "BlockedByHazard", hazard: Card.accident }))
            .toBe("Your car is blocked by Accident. Play Repairs to fix it first.");
            expect(describeRejection({ reason: "BlockedByHazard", hazard: Card.outOfGas }))
            .toBe("Your car is blocked by Out of Gas. Play Gasoline to fix it first.");
            expect(describeRejection({ reason: "BlockedByHazard", hazard: Card.stop }))
            .toBe("Your car is blocked by Stop. Play Roll to fix it first.");
        });


        it("explains an unsupported player count with advice that fits it", () => {
            expect(describeRejection({ reason: "UnsupportedPlayerCount", count: 5 }))
            .toBe("Mille Bornes needs 2, 3, 4, or 6 players. You have 5, so add a robot.");
            expect(describeRejection({ reason: "UnsupportedPlayerCount", count: 1 }))
            .toBe("Mille Bornes needs 2, 3, 4, or 6 players. You have 1, so add a robot.");
            expect(describeRejection({ reason: "UnsupportedPlayerCount", count: 7 }))
            .toBe("Mille Bornes needs 2, 3, 4, or 6 players. You have 7, so remove someone.");
            expect(describeRejection({ reason: "UnsupportedPlayerCount", count: 0 }))
            .toBe("Mille Bornes needs 2, 3, 4, or 6 players. You have 0, so add players.");
        });


        it("names the player whose turn it is", () => {
            expect(describeRejection({ reason: "NotYourTurn", current: ann }))
            .toBe("It's Ann's turn. Please wait until it's yours.");
        });


        it("names the player deciding on Extension", () => {
            expect(describeRejection({ reason: "ExtensionOfferOpen", decider: ann }))
            .toBe("Please wait: Ann is deciding whether to call Extension.");
            expect(describeRejection({ reason: "NotTheCaller", decider: ann }))
            .toBe("Only Ann can decide whether to call Extension.");
        });


        it("names the safety that answers a hazard", () => {
            expect(describeRejection({ reason: "WrongSafetyForHazard", hazard: Card.flatTire, card: Card.extraTank }))
            .toBe("Extra Tank doesn't protect against Flat Tire. Only Puncture Proof can answer it.");
        });

    });

});
