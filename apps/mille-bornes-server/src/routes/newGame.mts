import express from "express";
import { sendError, sendSuccess } from "@repo/depot-node/expressHelpers";
import { HttpSuccess, HttpError } from "@repo/depot/httpStatusCodes";
import { gameConfigSchema } from "@repo/mille-bornes-shared/gameConfig";
import { newGame } from "@repo/mille-bornes-engine/games";
import { safeParse } from "@repo/depot/zodHelpers";
import { pipeWhileSuccessful } from "@repo/depot/pipeWhileSuccessful";


export const router = express.Router();


router.post("/", async function (req, res) {
    return pipeWhileSuccessful(
        safeParse(gameConfigSchema, req.body)
        .tapError((err) => sendError(res, HttpError._400_BadRequest, "Invalid game configuration.", err)),
        async (config) => (await newGame(config))
        .tapError((err) => sendError(res, HttpError._500_InternalServerError, "Failed to create game.", err))
        .tapSuccess((gameId) => sendSuccess(res, HttpSuccess._201_Created, {gameId}))
    );
});
