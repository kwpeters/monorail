import { z } from "zod";
import { createRouter, publicProcedure } from "./trpc.mjs";
import { createItem, getItems, getItemById, updateItem } from "../domain/itemService.mjs";


const itemRouter = createRouter({
    list: publicProcedure
    .query(() => getItems()),

    getById: publicProcedure
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => getItemById(input.id) ?? null),

    create: publicProcedure
    .input(z.object({ name: z.string().min(1), description: z.string() }))
    .mutation(({ input }) => createItem(input.name, input.description)),

    update: publicProcedure
    .input(z.object({
        id:          z.string().min(1),
        name:        z.string().min(1).optional(),
        description: z.string().optional()
    }))
    .mutation(({ input }) => updateItem(input.id, input.name, input.description) ?? null)
});


export const appRouter = createRouter({
    health: publicProcedure.query(() => ({ ok: true })),
    item:   itemRouter
});

export type AppRouter = typeof appRouter;
