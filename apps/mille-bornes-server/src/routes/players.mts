import { z } from "zod";
import express from "express";
import { handleRoute } from "@repo/depot-node/expressHelpers";
import { HttpSuccess } from "@repo/depot/httpStatusCodes";
import { Uuid, UuidFormat } from "@repo/depot/uuid";
import { SucceededResult } from "@repo/depot/result";
import { playerNameSchema } from "@repo/mille-bornes-shared/playerName";
import { humanPlayerSchema } from "@repo/mille-bornes-shared/player";


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

    return handleRoute(
        req, createPlayerRequestSchema,
        res, createPlayerResponseSchema,
        (req, reqBody) => {
            const id = Uuid.create(UuidFormat.D);

            // TODO: Need to actually put the player into a collection of human players.

            return new SucceededResult({
                statusCode: HttpSuccess._201_Created,
                body:       {
                    type: "HumanPlayer",
                    name: reqBody.name,
                    id:   id.toString()
                }
            });
        }
    );
});
