import * as path from "node:path";
import { GameId } from "@repo/mille-bornes-core/ids";
import * as trpcExpress from "@trpc/server/adapters/express";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import qrcode from "qrcode";
import { type ServerConfig } from "./config.mjs";
import { contextFromRequest } from "./context.mjs";
import { type Hub } from "./hub.mjs";
import { renderHostPage } from "./hostPage.mjs";
import { type Logger } from "./logger.mjs";
import { appRouter } from "./router.mjs";
import { type SessionRegistry } from "./sessions.mjs";


const maxTrpcBodyBytes = 16 * 1024;
const placeholder = "Mille Bornes server is running. The web app has not been built yet.";
const hostOnlyMessage = "This page is only available on the computer that runs the server.";
const hostPageSecurityPolicy =
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'";


/**
 * Tells whether a connection came from this computer.
 * @param remoteAddress - The socket's remote address (not a header, so it
 * cannot be spoofed by the client)
 * @returns True for `127.0.0.1`, `::1` and `::ffff:127.0.0.1`
 */
export function isLoopbackAddress(remoteAddress: string | undefined): boolean {
    return remoteAddress === "127.0.0.1" ||
        remoteAddress === "::1" ||
        remoteAddress === "::ffff:127.0.0.1";
}


/** What the host page handlers need. */
export interface HostHandlerDeps {
    hub:       Hub;
    /** The URLs players can use; may change between calls. */
    addresses: () => ReadonlyArray<string>;
    /** The port, for the fallback URL when `addresses()` is empty. */
    port:      number;
}


/**
 * Makes the handlers of the host page.  Both answer 403 unless the request's
 * socket is on this computer.
 * @param deps - The hub, the player URLs and the port
 * @returns The handler that shows the page and the one that ends a game
 */
export function createHostHandlers(deps: HostHandlerDeps): {
    showHost: (req: Request, res: Response) => Promise<void>;
    endGame:  (req: Request, res: Response) => Promise<void>;
} {
    const refuse = (res: Response): void => {
        res.status(403).type("text/plain").send(hostOnlyMessage);
    };

    return {
        showHost: async (req, res) => {
            if (!isLoopbackAddress(req.socket.remoteAddress)) {
                refuse(res);
                return;
            }
            const urls = deps.addresses();
            const shown = urls.length > 0 ? urls : [`http://localhost:${deps.port.toString()}/`];
            const qrSvg = await Promise.all(shown.map(async (u) => qrcode.toString(u, { type: "svg" })));
            res.set("Content-Security-Policy", hostPageSecurityPolicy)
            .type("html")
            .send(renderHostPage({ urls: shown, qrSvg, games: deps.hub.adminList() }));
        },

        endGame: async (req, res) => {
            if (!isLoopbackAddress(req.socket.remoteAddress)) {
                refuse(res);
                return;
            }
            const raw = req.params.gameId;
            const id = GameId.tryCreate(typeof raw === "string" ? raw : "");
            if (id.failed) {
                res.status(400).type("text/plain").send("That is not a game id.");
                return;
            }
            // A game that is already gone is not an error worth showing.
            await deps.hub.adminEnd(id.value);
            res.redirect(303, "/host");
        }
    };
}


/** What `createApp()` needs. */
export interface AppDeps {
    hub:       Hub;
    sessions:  SessionRegistry;
    config:    ServerConfig;
    logger:    Logger;
    /** The URLs players can use. */
    addresses: () => ReadonlyArray<string>;
    port:      number;
}


/**
 * Makes the Express app: tRPC at `/trpc`, the loopback-only host page at
 * `/host`, and the web app's static files for everything else.  Nothing logs a
 * request URL, because a subscription's URL carries the credential.
 * @param deps - What the app needs
 * @returns The app
 */
export function createApp(deps: AppDeps): Express {
    const app = express();
    app.disable("x-powered-by");

    // tRPC reads its own body, so no body parser is mounted before it.
    app.use("/trpc", trpcExpress.createExpressMiddleware({
        router:        appRouter,
        maxBodySize:   maxTrpcBodyBytes,
        createContext: ({ req, info }) => contextFromRequest(deps, req.headers, info.connectionParams)
    }));

    const host = createHostHandlers(deps);
    app.get("/host", host.showHost);
    app.post("/host/end/:gameId", host.endGame);

    const webRoot = deps.config.webRoot === null ? null : path.resolve(deps.config.webRoot);
    if (webRoot === null) {
        app.get("/", (_req, res) => { res.type("text/plain").send(placeholder); });
    }
    else {
        app.use(express.static(webRoot, { dotfiles: "ignore" }));
        app.get(/^(?!\/(?:trpc|host)(?:\/|$))/u, (_req, res) => {
            res.sendFile("index.html", { root: webRoot });
        });
    }

    // Express 4 arity is what marks this as the error handler.
    app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
        // The message only: never the stack, the URL or the headers.
        deps.logger.error(err instanceof Error ? err.message : "Unknown error");
        if (res.headersSent) {
            next(err);
            return;
        }
        res.status(500).json({ error: "Something went wrong on the server." });
    });

    return app;
}
