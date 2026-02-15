import { z } from "zod";
import express from "express";
import { safeParse } from "@repo/depot/zodHelpers";
import { sendError, sendSuccess } from "@repo/depot-node/expressHelpers";
import { HttpError, HttpSuccess } from "@repo/depot/httpStatusCodes";
import { Uuid, UuidFormat } from "@repo/depot/uuid";
import { playerNameSchema } from "@repo/mille-bornes-shared/playerName";
import { humanPlayerSchema, type HumanPlayer } from "@repo/mille-bornes-shared/player";


const router = express.Router();
export function mount(app: express.Express): void {
    app.use("/players", router);
}


////////////////////////////////////////////////////////////////////////////////


const createPlayerRequestSchema = z.strictObject({
    name: playerNameSchema
});


const createPlayerResponseSchema = humanPlayerSchema;


router.post("/", async (req, res) => {
    await Promise.resolve(0);

    const body = req.body as unknown;
    let r = safeParse(createPlayerRequestSchema, body);
    if (r.failed) {
        sendError(res, HttpError._400_BadRequest, "Invalid request body.");
        return;
    }

    const id = Uuid.create(UuidFormat.D);

    const humanPlayer = {
        type: "HumanPlayer",
        name: r.value.name,
        id:   id.toString()
    } satisfies HumanPlayer;

    r = safeParse(createPlayerResponseSchema, humanPlayer);
    if (r.failed) {
        sendError(res, HttpError._500_InternalServerError, "Invalid response body.", r.error);
        return;
    }

    sendSuccess(res, HttpSuccess._201_Created, humanPlayer);
});


////////////////////////////////////////////////////////////////////////////////
