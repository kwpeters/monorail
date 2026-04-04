import { initTRPC } from "@trpc/server";
import type { TrpcContext } from "./context.mjs";

const t = initTRPC.context<TrpcContext>().create();

export const createRouter = t.router;
export const publicProcedure = t.procedure;
