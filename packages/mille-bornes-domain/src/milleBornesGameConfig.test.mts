import { safeParse } from "@repo/depot/zodHelpers";
import { schemaMilleBornesGameConfig, schemaRaceDistance, schemaPointsGoal } from "./milleBornesGameConfig.mjs";


describe("schemaRaceDistance", () => {

    it("cannot be negative", () => {
        const res = safeParse(schemaRaceDistance, -25).throwIfSucceeded();
    });


    it("cannot be zero", () => {
        const res = safeParse(schemaRaceDistance, 0).throwIfSucceeded();
    });


    it("fails when it is not a mutltiple of 25", () => {
        safeParse(schemaRaceDistance, 24).throwIfFailed();
    });


    it("succeeds when it is a mutltiple of 25", () => {
        safeParse(schemaRaceDistance, 25).throwIfFailed();
    });

});


describe("schemaPointsGoal", () => {

    it("cannot be negative", () => {
        safeParse(schemaPointsGoal, -1000).throwIfSucceeded();
    });


    it("cannot be zero", () => {
        safeParse(schemaPointsGoal, 0).throwIfSucceeded();
    });


    it("succeeds when it is any positive integer", () => {
        safeParse(schemaPointsGoal, 5000).throwIfFailed();
    });

});
