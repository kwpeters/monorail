import { resultToWire, type ResultWire } from "@repo/depot/schemaUtility";
import { unwrapOrAddIssue } from "@repo/depot/zodHelpers";
import { gameLengthSchema } from "@repo/mille-bornes-core/game";
import { GameId, PlayerId } from "@repo/mille-bornes-core/ids";
import { playerCommandSchema } from "@repo/mille-bornes-core/schemas";
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { type Context } from "./context.mjs";
import { type Screen } from "./screens.mjs";


const notValid = "Your session is not valid. Please enter your name again.";
const somethingWrong = "Something went wrong. Please try again.";


/**
 * The tRPC instance.  The SSE ping interval must be shorter than the time a
 * client waits before it reconnects.
 */
export const t = initTRPC.context<Context>().create({
    sse: {
        ping:   { enabled: true, intervalMs: 2000 },
        client: { reconnectAfterInactivityMs: 6000 }
    },
    isDev:          false,
    // An unexpected failure shows the client no detail and no stack.
    errorFormatter: ({ shape }) => {
        return shape.data.code === "INTERNAL_SERVER_ERROR" ?
            { ...shape, message: somethingWrong, data: { ...shape.data, stack: undefined } } :
            shape;
    }
});


// Every procedure but `session.create` runs for a verified player only.
const authed = t.procedure.use(({ ctx, next }) => {
    if (ctx.player === null) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: notValid });
    }
    return next({ ctx: { ...ctx, player: ctx.player } });
});


const nameSchema = z.string().max(200);
const gameIdSchema = z.string().transform((s, ctx) => unwrapOrAddIssue(GameId.tryCreate(s), ctx));
const playerIdSchema = z.string()
.transform((s, ctx) => unwrapOrAddIssue(PlayerId.tryCreate(s), ctx));


const sessionRouter = t.router({
    create: t.procedure
    .input(z.object({ name: nameSchema.nullable() }))
    .mutation(async ({ ctx, input }): Promise<ResultWire<
        { playerId: string; token: string; name: string },
        string
    >> => {
        const created = await ctx.sessions.create(input.name);
        return resultToWire(created.mapSuccess((c) => {
            return { playerId: c.playerId, token: c.token, name: c.name };
        }));
    }),

    rename: authed
    .input(z.object({ name: nameSchema }))
    .mutation(async ({ ctx, input }) => {
        const renamed = await ctx.sessions.rename(ctx.player, input.name);
        return resultToWire(renamed.mapSuccess(() => undefined));
    }),

    me: authed.query(({ ctx }) => {
        return { playerId: ctx.player, name: ctx.sessions.nameOf(ctx.player) ?? "" };
    })
});


const lobbyRouter = t.router({
    createGame: authed.mutation(async ({ ctx }) => {
        return resultToWire(await ctx.hub.createGame(ctx.player));
    }),

    join: authed
    .input(z.object({ gameId: gameIdSchema }))
    .mutation(async ({ ctx, input }) => {
        return resultToWire(await ctx.hub.join(ctx.player, input.gameId));
    })
});


const pendingRouter = t.router({
    leave: authed.mutation(async ({ ctx }) => {
        return resultToWire(await ctx.hub.leavePending(ctx.player));
    }),

    cancel: authed.mutation(async ({ ctx }) => {
        return resultToWire(await ctx.hub.cancelPending(ctx.player));
    }),

    addRobot: authed.mutation(async ({ ctx }) => resultToWire(await ctx.hub.addRobot(ctx.player))),

    removeSeat: authed
    .input(z.object({ seat: playerIdSchema }))
    .mutation(async ({ ctx, input }) => {
        return resultToWire(await ctx.hub.removeSeat(ctx.player, input.seat));
    }),

    swapSeats: authed
    .input(z.object({ a: playerIdSchema, b: playerIdSchema }))
    .mutation(async ({ ctx, input }) => {
        return resultToWire(await ctx.hub.swapSeats(ctx.player, input.a, input.b));
    }),

    setLength: authed
    .input(z.object({ length: gameLengthSchema }))
    .mutation(async ({ ctx, input }) => {
        return resultToWire(await ctx.hub.setLength(ctx.player, input.length));
    }),

    start: authed.mutation(async ({ ctx }) => resultToWire(await ctx.hub.startGame(ctx.player)))
});


const gameRouter = t.router({
    play: authed
    .input(playerCommandSchema)
    .mutation(async ({ ctx, input }) => resultToWire(await ctx.hub.play(ctx.player, input))),

    end:   authed.mutation(async ({ ctx }) => resultToWire(await ctx.hub.endGame(ctx.player))),
    leave: authed.mutation(async ({ ctx }) => resultToWire(await ctx.hub.leaveFinished(ctx.player)))
});


/** Every procedure of the game server. */
export const appRouter = t.router({
    session: sessionRouter,
    lobby:   lobbyRouter,
    pending: pendingRouter,
    game:    gameRouter,

    // `yield*` hands `return()` on to the hub's stream, which closes the
    // player's presence, so stopping this stream early cannot leak a watch.
    watch: authed.subscription(async function* ({ ctx, signal }): AsyncGenerator<Screen> {
        yield* ctx.hub.watch(ctx.player, signal ?? new AbortController().signal);
    })
});


/** The router's type; the client imports this type only. */
export type AppRouter = typeof appRouter;
