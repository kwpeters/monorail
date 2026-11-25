import * as path from "node:path";
import { Option } from "@repo/depot/option";
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
    "default-src 'none'; style-src 'unsafe-inline'; img-src data:; form-action 'self'; " +
    "frame-ancestors 'none'";


/**
 * Tells whether a connection came from this computer.
 * @param remoteAddress - The socket's remote address (not a header, so it
 * cannot be spoofed by the client)
 * @returns True for `127.0.0.1`, `::1` and `::ffff:127.0.0.1`
 */
export function isLoopbackAddress(remoteAddress: Option<string>): boolean {
    return remoteAddress.match(
        (a) => a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1",
        () => false
    );
}


/**
 * Tells whether a `Host` header names this computer.  A web page that rebinds
 * its own name to 127.0.0.1 still sends its own name here.
 * @param host - The raw `Host` header value (may carry a port)
 * @returns True for `localhost`, `127.0.0.1` or `[::1]`, with or without a port
 */
export function isLocalHostHeader(host: Option<string>): boolean {
    return host.match(
        (h) => /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d{1,5})?$/iu.test(h),
        () => false
    );
}


/**
 * Tells whether a state-changing request was made by this server's own page.
 * A request with neither `Origin` nor `Sec-Fetch-Site` (curl, an address bar)
 * is allowed; otherwise the browser must say it is same-origin (or user
 * initiated), and `Origin` must name the same host as `Host`.
 * @param request - The request's `Host`, `Origin` and `Sec-Fetch-Site` headers
 * @returns True when the request is not cross-site
 */
export function isSameOriginRequest(request: {
    host:         Option<string>;
    origin:       Option<string>;
    secFetchSite: Option<string>;
}): boolean {
    const site = request.secFetchSite;
    if (site.isSome && site.value !== "same-origin" && site.value !== "none") {
        return false;
    }
    if (request.origin.isNone) {
        return true;
    }
    const origin = request.origin.value;
    try {
        // A missing Host header never matches an origin's host.
        return request.host.match(
            (h) => h.toLowerCase() === new URL(origin).host.toLowerCase(),
            () => false
        );
    }
    catch {
        // "null" and other unparseable origins.
        return false;
    }
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
 * socket is on this computer and its `Host` names this computer (against DNS
 * rebinding); ending a game also answers 403 to a cross-site request.
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
    const fromThisComputer = (req: Request): boolean => {
        return isLoopbackAddress(Option.fromNullable(req.socket.remoteAddress)) &&
            isLocalHostHeader(Option.fromNullable(req.headers.host));
    };

    return {
        showHost: async (req, res) => {
            if (!fromThisComputer(req)) {
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
            if (!fromThisComputer(req) || !isSameOriginRequest({
                host:         Option.fromNullable(req.headers.host),
                origin:       Option.fromNullable(req.headers.origin),
                secFetchSite: Option.fromNullable(req.headers["sec-fetch-site"])
            })) {
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

    const webRootOption = deps.config.webRoot.mapSome((r) => path.resolve(r));
    if (webRootOption.isNone) {
        app.get("/", (_req, res) => { res.type("text/plain").send(placeholder); });
    }
    else {
        const webRoot = webRootOption.value;
        // Static serving already stays inside the root; refusing these outright
        // keeps the index fallback from answering 200 to a traversal attempt.
        app.use((req, res, next) => {
            let decoded: string;
            try {
                decoded = decodeURIComponent(req.path);
            }
            catch {
                res.status(400).type("text/plain").send("Bad request.");
                return;
            }
            if (decoded.split("/").includes("..") ||
                decoded.includes("\\") || decoded.includes("\0")) {
                res.status(403).type("text/plain").send("Forbidden.");
                return;
            }
            next();
        });
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
