import express from "express";
import type { FailedResult } from "@repo/depot/result";
import { gameConfigSchema } from "@repo/mille-bornes-shared/gameConfig";
import { newGame } from "@repo/mille-bornes-engine/games";
import { safeParse } from "@repo/depot/zodHelpers";


export const router = express.Router();


interface JsonErrorResponse {
    error:   string;
    details: unknown;
}


function createJsonError(error: string, details: unknown): JsonErrorResponse {
    return { error, details };
}


function createFailedResultJsonError(error: string, result: FailedResult<unknown>): JsonErrorResponse {
    return createJsonError(error, result.error);
}


/* POST create new game. */
router.post("/", async function (req, res) {
    const resParse = safeParse(gameConfigSchema, req.body);
    if (resParse.failed) {
        res.status(400).json(createFailedResultJsonError("Invalid game configuration.", resParse));
        return;
    }

    const resId = await newGame(resParse.value);
    if (resId.failed) {
        res.status(500).json(createFailedResultJsonError("Failed to create game.", resId));
        return;
    }

    res.status(201).json({
        success: true,
        gameId:  resId.value,
    });
});
