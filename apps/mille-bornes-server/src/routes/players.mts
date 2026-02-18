import { z } from "zod";
import express from "express";
import { handleRoute } from "@repo/depot-node/expressHelpers";
import { HttpSuccess } from "@repo/depot/httpStatusCodes";
import { hashUuid, Uuid, UuidFormat } from "@repo/depot/uuid";
import { VoMap } from "@repo/depot/voMap";
import { SucceededResult } from "@repo/depot/result";
import { playerNameSchema } from "@repo/mille-bornes-shared/playerName";
import { humanPlayerSchema, playerIdSchema, type HumanPlayer, type PlayerId } from "@repo/mille-bornes-shared/player";


const router = express.Router();
export function mount(app: express.Express): void {
    app.use("/players", router);
}


////////////////////////////////////////////////////////////////////////////////

const createPlayerRequestSchema = z.object({
    name: playerNameSchema,
    // The client may provide a previously used player ID to indicate that this
    // is a returning user (potentially stored in local storage). This allows
    // the server to recognize returning users and avoid creating duplicate
    // player entries for them.
    id:   z.optional(playerIdSchema)
});
const createPlayerResponseSchema = humanPlayerSchema;


router.post("/", async (req, res) => {

    return handleRoute(
        req, createPlayerRequestSchema,
        res, createPlayerResponseSchema,
        (req, reqBody) => {

            if (reqBody.id && humanPlayers.has(reqBody.id)) {
                // We already know about this user.
                return new SucceededResult({
                    statusCode: HttpSuccess._200_OK,
                    body:       humanPlayers.get(reqBody.id)!
                });
            }

            // We do not recognize the player.  Create a new player.
            const id = Uuid.create(UuidFormat.D) as PlayerId;
            const newPlayer: HumanPlayer = {
                type: "HumanPlayer",
                name: reqBody.name,
                id:   id
            };
            return new SucceededResult({
                statusCode: HttpSuccess._201_Created,
                body:       newPlayer
            });
        }
    );
});


////////////////////////////////////////////////////////////////////////////////

export const humanPlayers = new VoMap<Uuid, HumanPlayer>(hashUuid);
