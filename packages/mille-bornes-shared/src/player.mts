import { z } from "zod";
import { playerNameSchema } from "./playerName.mjs";


////////////////////////////////////////////////////////////////////////////////

export const humanPlayerSchema = z.strictObject({
    type: z.literal("HumanPlayer"),
    name: playerNameSchema,
    id:   z.uuidv4()
});
export type HumanPlayer = z.infer<typeof humanPlayerSchema>;

////////////////////////////////////////////////////////////////////////////////

export const botPlayerSchema = z.strictObject({
    type: z.literal("BotPlayer"),
    name: playerNameSchema
});
export type BotPlayer = z.infer<typeof botPlayerSchema>;

////////////////////////////////////////////////////////////////////////////////

export const playerSchema = z.discriminatedUnion(
    "type",
    [humanPlayerSchema, botPlayerSchema]
);
export type Player = z.infer<typeof playerSchema>;
