import { safeParse } from "@repo/depot/zodHelpers";
import {
    humanPlayerSchema,
    gameConfigSchema,
    type GameConfig,
    numTeamsSchema,
    pointsGoalSchema,
    playersSchema,
    raceDistanceSchema,
    type HumanPlayer,
    type Players,
} from "./gameConfig.mjs";


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


describe("humanPlayerSchema", () => {

    it("cannot have a name containing zero characters", () => {
        safeParse(humanPlayerSchema, { type: "HumanPlayer", name: "" } satisfies HumanPlayer).throwIfSucceeded();
    });


    it("cannot have a name containing more than 20 characters", () => {
        safeParse(humanPlayerSchema, { type: "HumanPlayer", name: "ABCDEFGHIJKLMNOPQRSTU" } satisfies HumanPlayer).throwIfSucceeded();
    });


    it("succeeds when all fields are valid", () => {
        safeParse(humanPlayerSchema, { type: "HumanPlayer", name: "Alice" } satisfies HumanPlayer).throwIfFailed();
    });

});


describe("playersSchema", () => {

    it("fails when there are no players", () => {
        safeParse(playersSchema, [] satisfies Players).throwIfSucceeded();
    });


    it("fails if there are more than 6 players", () => {
        safeParse(
            playersSchema,
            [
                { type: "HumanPlayer", name: "Alice" },
                { type: "BotPlayer",   name: "Bot A" },
                { type: "BotPlayer",   name: "Bot B" },
                { type: "BotPlayer",   name: "Bot C" },
                { type: "BotPlayer",   name: "Bot D" },
                { type: "BotPlayer",   name: "Bot E" },
                { type: "BotPlayer",   name: "Bot F" },
            ] satisfies Players
        ).throwIfSucceeded();
    });


    it("fails if there are zero human players", () => {
        safeParse(
            playersSchema,
            [
                { type: "BotPlayer", name: "Bot A" },
                { type: "BotPlayer", name: "Bot B" },
            ] satisfies Players
        ).throwIfSucceeded();
    });


    it("fails if two human players have the same name", () => {
        safeParse(
            playersSchema,
            [
                { type: "HumanPlayer", name: "Alice" },
                { type: "HumanPlayer", name: "Alice" },
            ] satisfies Players
        ).throwIfSucceeded();
    });


    it("fails if two bots have the same name", () => {
        safeParse(
            playersSchema,
            [
                { type: "HumanPlayer", name: "Alice" },
                { type: "BotPlayer",   name: "Bot A" },
                { type: "BotPlayer",   name: "Bot A" },
            ] satisfies Players
        ).throwIfSucceeded();
    });


    it("fails if a human and a bot have the same name", () => {
        safeParse(
            playersSchema,
            [
                { type: "HumanPlayer", name: "Alex" },
                { type: "BotPlayer",   name: "Alex" },
            ] satisfies Players
        ).throwIfSucceeded();
    });


    it("succeeds when all fields are valid and all constraints are satisfied", () => {
        safeParse(
            playersSchema,
            [
                { type: "HumanPlayer", name: "Alice" },
                { type: "BotPlayer",   name: "Bot A" },
                { type: "HumanPlayer", name: "Bob" },
                { type: "BotPlayer",   name: "Bot B" },
            ] satisfies Players
        ).throwIfFailed();
    });

});


describe("gameConfigSchema", () => {

    it("fails if the number of players and number of teams results in non-uniform team sizes", () => {
        safeParse(gameConfigSchema, {
            raceDistance: 1000,
            pointsGoal:   5000,
            numTeams:     2,
            players:      [
                { type: "HumanPlayer", name: "Alice" },
                { type: "BotPlayer",   name: "Bot A" },
                { type: "BotPlayer",   name: "Bot B" },
            ],
        } satisfies GameConfig).throwIfSucceeded();
    });


    it("succeeds when all fields are valid and all constraints are satisfied", () => {
        safeParse(gameConfigSchema, {
            raceDistance: 1000,
            pointsGoal:   5000,
            numTeams:     2,
            players:      [
                { type: "HumanPlayer", name: "Alice" },
                { type: "BotPlayer",   name: "Bot A" },
                { type: "HumanPlayer", name: "Bob" },
                { type: "BotPlayer",   name: "Bot B" },
            ],
        } satisfies GameConfig).throwIfFailed();
    });

});
