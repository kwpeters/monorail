import { z } from "zod";
import { Uuid } from "@repo/depot/uuid";
import { type Brand } from "@repo/depot/brand";
import { pipe } from "@repo/depot/pipe2";
import { playerNameSchema } from "./playerName.mjs";


////////////////////////////////////////////////////////////////////////////////

export type PlayerId = Brand<Uuid, "PlayerId">;
export const playerIdSchema = z.uuidv4().transform((str) => {
    return pipe(
        Uuid.fromString(str),
        (res) => res.throwIfFailedWith(`Invalid PlayerId string "${str}".`),
        (uuid) => uuid as PlayerId
    );
});

export const humanPlayerSchema = z.strictObject({
    type: z.literal("HumanPlayer"),
    name: playerNameSchema,
    id:   playerIdSchema
});
export type HumanPlayer = z.infer<typeof humanPlayerSchema>;

////////////////////////////////////////////////////////////////////////////////

export const botPlayerSchema = z.strictObject({
    type: z.literal("BotPlayer"),
    name: playerNameSchema,
    id:   playerIdSchema
});
export type BotPlayer = z.infer<typeof botPlayerSchema>;

////////////////////////////////////////////////////////////////////////////////

export const playerSchema = z.discriminatedUnion(
    "type",
    [humanPlayerSchema, botPlayerSchema]
);
export type Player = z.infer<typeof playerSchema>;
