import { safeParse } from "@repo/depot/zodHelpers";
import { milleBornesGameConfigSchema, raceDistanceSchema, pointsGoalSchema, numHumanPlayersSchema,
         numBotPlayersSchema, numTeamsSchema } from "./milleBornesGameConfig.mjs";


describe("raceDistanceSchema", () => {

    it("cannot be negative", () => {
        const res = safeParse(raceDistanceSchema, -25).throwIfSucceeded();
    });


    it("cannot be zero", () => {
        const res = safeParse(raceDistanceSchema, 0).throwIfSucceeded();
    });


    it("fails when it is not a mutltiple of 25", () => {
        safeParse(raceDistanceSchema, 24).throwIfSucceeded();
    });


    it("succeeds when it is a mutltiple of 25", () => {
        safeParse(raceDistanceSchema, 25).throwIfFailed();
    });

});


describe("pointsGoalSchema", () => {

    it("cannot be negative", () => {
        safeParse(pointsGoalSchema, -1000).throwIfSucceeded();
    });


    it("cannot be zero", () => {
        safeParse(pointsGoalSchema, 0).throwIfSucceeded();
    });


    it("succeeds when it is any positive integer", () => {
        safeParse(pointsGoalSchema, 5000).throwIfFailed();
    });

});


describe("humHumanPlayersSchema", () => {

    it("cannot be zero", () => {
        safeParse(numHumanPlayersSchema, 0).throwIfSucceeded();
    });


    it("cannot be negative", () => {
        safeParse(numHumanPlayersSchema, -1).throwIfSucceeded();
    });


    it("cannot be greater than 6", () => {
        safeParse(numHumanPlayersSchema, 7).throwIfSucceeded();
    });


    it("succeeds when it is 1 (minimum)", () => {
        safeParse(numHumanPlayersSchema, 1).throwIfFailed();
    });


    it("succeeds when it is 6 (maximum)", () => {
        safeParse(numHumanPlayersSchema, 6).throwIfFailed();
    });

});


describe("numBotPlayersSchema", () => {

    it("cannot be negative", () => {
        safeParse(numBotPlayersSchema, -1).throwIfSucceeded();
    });


    it("cannot be greater than 5", () => {
        safeParse(numBotPlayersSchema, 6).throwIfSucceeded();
    });


    it("succeeds when it is 0 (minimum)", () => {
        safeParse(numBotPlayersSchema, 0).throwIfFailed();
    });


    it("succeeds when it is 5 (maximum)", () => {
        safeParse(numBotPlayersSchema, 5).throwIfFailed();
    });

});


describe("numTeamsSchema", () => {

    it("cannot be 1", () => {
        safeParse(numTeamsSchema, 1).throwIfSucceeded();
    });


    it("cannot be greater than 3", () => {
        safeParse(numTeamsSchema, 4).throwIfSucceeded();
    });


    it("succeeds when it is 2 (minimum)", () => {
        safeParse(numTeamsSchema, 2).throwIfFailed();
    });


    it("succeeds when it is 3 (maximum)", () => {
        safeParse(numTeamsSchema, 3).throwIfFailed();
    });

});


describe("milleBornesGameConfigSchema", () => {

    it("fails if the total number of players is not a multiple of the number of teams", () => {
        safeParse(milleBornesGameConfigSchema, {
            raceDistance:    1000,
            pointsGoal:      5000,
            numHumanPlayers: 3,
            numBotPlayers:   2,
            numTeams:        2
        }).throwIfSucceeded();
    });


    it("succeeds when all game settings are valid", () => {
        safeParse(milleBornesGameConfigSchema, {
            raceDistance:    1000,
            pointsGoal:      5000,
            numHumanPlayers: 2,
            numBotPlayers:   2,
            numTeams:        2
        }).throwIfFailed();
    });

});
