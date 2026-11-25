import { type Result } from "@repo/depot/result";
import { discriminatedResultSchema } from "@repo/depot/schemaUtility";
import { chooseCommand } from "@repo/mille-bornes-core/bot";
import { type GameId, PlayerId } from "@repo/mille-bornes-core/ids";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import {
    createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink, type TRPCClient
} from "@trpc/client";
import { EventSource } from "eventsource";
import { z } from "zod";
import { type AppRouter } from "./router.mjs";
import { type Screen } from "./screens.mjs";


const voidResultSchema = discriminatedResultSchema(z.void(), z.string());
const credentialResultSchema = discriminatedResultSchema(
    z.object({ playerId: z.string(), token: z.string(), name: z.string() }),
    z.string()
);
const defaultTimeoutMs = 10_000;


/**
 * A "text client": makes the same calls a phone makes, over real HTTP and
 * SSE, with its decisions taken from core's `chooseCommand()`.  For tests.
 */
export interface ScriptedPlayer {
    readonly playerId:      PlayerId;
    readonly name:          PlayerName;
    /** The `Authorization` header value; reuse it with `connectScriptedPlayer()`. */
    readonly authorization: string;
    /** Every screen received, in order. */
    readonly screens:       ReadonlyArray<Screen>;

    /** @returns The outcome of `lobby.createGame`. */
    createGame(): Promise<Result<void, string>>;

    /**
     * @param gameId - The game to join
     * @returns The outcome of `lobby.join`
     */
    join(gameId: GameId): Promise<Result<void, string>>;

    /** @returns The outcome of `pending.addRobot`. */
    addRobot(): Promise<Result<void, string>>;

    /** @returns The outcome of `pending.start`. */
    start(): Promise<Result<void, string>>;

    /** @returns The outcome of `game.end`. */
    endGame(): Promise<Result<void, string>>;

    /** @returns The outcome of `game.leave`. */
    leave(): Promise<Result<void, string>>;

    /**
     * Waits for the current screen, or a later one, to satisfy `pred`.
     * @param pred - The condition
     * @param timeoutMs - How long to wait (default 10 s)
     * @returns The first such screen; rejects on timeout with the last screen,
     * any subscription error and any refused play in the message
     */
    waitFor(pred: (s: Screen) => boolean, timeoutMs?: number): Promise<Screen>;

    /**
     * From now on, on every Playing screen where this player may act (its
     * turn, a Coup Fourre it holds, an Extension offer it decides), sends
     * `chooseCommand(view)`, once per distinct view.
     */
    autoPlay(): void;

    /** Ends the subscription. */
    close(): void;
}


function clientFor(baseUrl: string, authorization: string | null): TRPCClient<AppRouter> {
    const url = new URL("trpc", baseUrl).toString();
    const auth = authorization === null ? {} : { authorization };
    // EventSource cannot set headers, so a subscription sends the credential
    // as a connection parameter.
    const subscriptions = httpSubscriptionLink({
        url,
        // eslint-disable-next-line @typescript-eslint/naming-convention -- tRPC's option name
        EventSource,
        connectionParams: () => auth
    });
    return createTRPCClient<AppRouter>({
        links: [splitLink({
            condition: (op) => op.type === "subscription",
            true:      subscriptions,
            false:     httpBatchLink({ url, headers: () => auth })
        })]
    });
}


/**
 * Signs up a new player and connects it.
 * @param baseUrl - The server, for example `http://127.0.0.1:3000/`
 * @param name - The player's name, or null for a whimsical one
 * @param rand - Breaks ties in `chooseCommand()` (default: its own)
 * @returns The connected player, once its first screen has arrived
 */
export async function createScriptedPlayer(
    baseUrl: string,
    name:    string | null,
    rand?:   () => number
): Promise<ScriptedPlayer> {
    const wire = await clientFor(baseUrl, null).session.create.mutate({ name });
    const { playerId, token } = credentialResultSchema.parse(wire).throwIfFailed();
    return connectScriptedPlayer(baseUrl, `Bearer ${playerId}.${token}`, rand);
}


/**
 * Connects an existing player, as a phone does after a restart or when it
 * wakes up.
 * @param baseUrl - The server, for example `http://127.0.0.1:3000/`
 * @param authorization - The player's `Authorization` header value
 * @param rand - Breaks ties in `chooseCommand()` (default: its own)
 * @returns The connected player, once its first screen has arrived
 */
export async function connectScriptedPlayer(
    baseUrl:       string,
    authorization: string,
    rand?:         () => number
): Promise<ScriptedPlayer> {
    const client = clientFor(baseUrl, authorization);
    const me = await client.session.me.query();
    const playerId = PlayerId.tryCreate(me.playerId).throwIfFailed();
    const name = PlayerName.tryCreate(me.name).throwIfFailed();

    const screens: Array<Screen> = [];
    const problems: Array<string> = [];
    const listeners = new Set<() => void>();
    let playing = false;
    let lastPlayed: string | null = null;

    const act = (screen: Screen): void => {
        if (!playing || screen.kind !== "Playing") {
            return;
        }
        const key = JSON.stringify(screen.view);
        const cmd = key === lastPlayed ? null : chooseCommand(screen.view, rand);
        if (cmd === null) {
            return;
        }
        lastPlayed = key;
        client.game.play.mutate(cmd)
        .then((wire) => {
            const played = voidResultSchema.parse(wire);
            if (played.failed) {
                problems.push(`play ${JSON.stringify(cmd)} refused: ${played.error}`);
            }
        })
        .catch((err: unknown) => { problems.push(`play threw: ${String(err)}`); });
    };

    const subscription = client.watch.subscribe(undefined, {
        onData: (screen) => {
            screens.push(screen);
            act(screen);
            listeners.forEach((l) => { l(); });
        },
        onError: (err) => { problems.push(`watch failed: ${err.message}`); }
    });

    const call = async (p: Promise<unknown>): Promise<Result<void, string>> => {
        return voidResultSchema.parse(await p);
    };

    const waitFor = (
        pred:      (s: Screen) => boolean,
        timeoutMs: number = defaultTimeoutMs
    ): Promise<Screen> => {
        let from = Math.max(0, screens.length - 1);
        return new Promise((resolve, reject) => {
            const check = (): void => {
                const found = screens.slice(from).find(pred);
                from = Math.max(from, screens.length);
                if (found) {
                    done();
                    resolve(found);
                }
            };
            const timer = setTimeout(() => {
                done();
                reject(new Error(
                    `${name} timed out after ${timeoutMs.toString()} ms.  ` +
                    `Last screen: ${JSON.stringify(screens.at(-1) ?? null)}  ` +
                    `Problems: ${JSON.stringify(problems)}`
                ));
            }, timeoutMs);
            const done = (): void => {
                clearTimeout(timer);
                listeners.delete(check);
            };
            listeners.add(check);
            check();
        });
    };

    const player: ScriptedPlayer = {
        playerId,
        name,
        authorization,
        screens,
        createGame: async () => call(client.lobby.createGame.mutate()),
        join:       async (gameId) => call(client.lobby.join.mutate({ gameId })),
        addRobot:   async () => call(client.pending.addRobot.mutate()),
        start:      async () => call(client.pending.start.mutate()),
        endGame:    async () => call(client.game.end.mutate()),
        leave:      async () => call(client.game.leave.mutate()),
        waitFor,
        autoPlay:   () => {
            playing = true;
            const current = screens.at(-1);
            if (current) {
                act(current);
            }
        },
        close: () => { subscription.unsubscribe(); }
    };

    try {
        await waitFor(() => true);
    }
    catch (err) {
        player.close();
        throw err;
    }
    return player;
}
