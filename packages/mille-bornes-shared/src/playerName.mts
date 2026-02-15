import { z } from "zod";


export const playerNameSchema = z.string().min(1).max(20);
export type PlayerName = z.infer<typeof playerNameSchema>;
