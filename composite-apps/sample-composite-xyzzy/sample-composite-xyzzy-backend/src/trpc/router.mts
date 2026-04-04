import { z } from "zod";
import { createRouter, publicProcedure } from "./trpc.mjs";

export const appRouter = createRouter({
    health: publicProcedure.query(() => ({ ok: true })),
    hello:  publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .query(({ input }) => ({ message: `Hello ${input.name}` }))
});

export type AppRouter = typeof appRouter;
