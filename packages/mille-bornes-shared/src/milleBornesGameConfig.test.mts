import { safeParse } from "@repo/depot/zodHelpers";
import { schemaMilleBornesGameConfig, schemaRaceDistance, schemaPointsGoal, schemaNumHumanPlayers,
         schemaNumBotPlayers, schemaNumTeams } from "./milleBornesGameConfig.mjs";


describe("schemaRaceDistance", () => {

    it("cannot be negative", () => {
        const res = safeParse(schemaRaceDistance, -25).throwIfSucceeded();
    });


    it("cannot be zero", () => {
        const res = safeParse(schemaRaceDistance, 0).throwIfSucceeded();
    });


    it("fails when it is not a mutltiple of 25", () => {
        safeParse(schemaRaceDistance, 24).throwIfSucceeded();
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


describe("schemaNumHumanPlayers", () => {

    it("cannot be zero", () => {
        safeParse(schemaNumHumanPlayers, 0).throwIfSucceeded();
    });


    it("cannot be negative", () => {
        safeParse(schemaNumHumanPlayers, -1).throwIfSucceeded();
    });


    it("cannot be greater than 6", () => {
        safeParse(schemaNumHumanPlayers, 7).throwIfSucceeded();
    });


    it("succeeds when it is 1 (minimum)", () => {
        safeParse(schemaNumHumanPlayers, 1).throwIfFailed();
    });


    it("succeeds when it is 6 (maximum)", () => {
        safeParse(schemaNumHumanPlayers, 6).throwIfFailed();
    });

});


describe("schemaNumBotPlayers", () => {

    it("cannot be negative", () => {
        safeParse(schemaNumBotPlayers, -1).throwIfSucceeded();
    });


    it("cannot be greater than 5", () => {
        safeParse(schemaNumBotPlayers, 6).throwIfSucceeded();
    });


    it("succeeds when it is 0 (minimum)", () => {
        safeParse(schemaNumBotPlayers, 0).throwIfFailed();
    });


    it("succeeds when it is 5 (maximum)", () => {
        safeParse(schemaNumBotPlayers, 5).throwIfFailed();
    });

});


describe("schemaNumTeams", () => {

    it("cannot be 1", () => {
        safeParse(schemaNumTeams, 1).throwIfSucceeded();
    });


    it("cannot be greater than 3", () => {
        safeParse(schemaNumTeams, 4).throwIfSucceeded();
    });


    it("succeeds when it is 2 (minimum)", () => {
        safeParse(schemaNumTeams, 2).throwIfFailed();
    });


    it("succeeds when it is 3 (maximum)", () => {
        safeParse(schemaNumTeams, 3).throwIfFailed();
    });

});


describe("schemaMilleBornesGameConfig", () => {

    it("fails if the total number of players is not a multiple of the number of teams", () => {
        safeParse(schemaMilleBornesGameConfig, {
            raceDistance:    1000,
            pointsGoal:      5000,
            numHumanPlayers: 3,
            numBotPlayers:   2,
            numTeams:        2
        }).throwIfSucceeded();
    });


    it("succeeds when all game settings are valid", () => {
        safeParse(schemaMilleBornesGameConfig, {
            raceDistance:    1000,
            pointsGoal:      5000,
            numHumanPlayers: 2,
            numBotPlayers:   2,
            numTeams:        2
        }).throwIfFailed();
    });

});
