import * as http from "node:http";
import { type AddressInfo } from "node:net";
import { createApp } from "./app.mjs";
import { type Clock } from "./clock.mjs";
import { type ServerConfig } from "./config.mjs";
import { Hub } from "./hub.mjs";
import { type Logger } from "./logger.mjs";
import { lanUrls } from "./network.mjs";
import { SessionRegistry } from "./sessions.mjs";
import { FileSnapshotStore } from "./snapshotStore.mjs";


/** What `startServer()` needs; the caller supplies every outside influence. */
export interface StartServerDeps {
    config:    ServerConfig;
    clock:     Clock;
    /** Returns a number in [0, 1). */
    rand:      () => number;
    logger:    Logger;
    /** Network interface names mapped to their external IPv4 addresses. */
    addresses: () => Map<string, string>;
}


/** A server that is listening. */
export interface RunningServer {
    readonly server: http.Server;
    readonly hub:    Hub;

    /** The port actually bound (differs from the configured port when that is 0). */
    readonly port:   number;

    /** The URLs a phone on the local network can use. */
    readonly urls:   ReadonlyArray<string>;

    /**
     * Stops the games' timers, waits for every save, and closes the server,
     * ending any open connection.
     * @returns Resolves when the server has closed
     */
    close(): Promise<void>;
}


/**
 * Opens the stored games and sessions, then listens on all interfaces.
 * @param deps - The configuration and everything outside influence
 * @returns The running server; rejects with the listen error (for example
 * `EADDRINUSE`) when the port cannot be bound
 */
export async function startServer(deps: StartServerDeps): Promise<RunningServer> {
    const { config, clock, rand, logger } = deps;
    const store = new FileSnapshotStore(config.dataDir, logger);
    const sessions = await SessionRegistry.load(store, rand);
    const hub = await Hub.open({ store, sessions, clock, rand, timings: config.timings, logger });

    const server = http.createServer();
    try {
        await new Promise<void>((resolve, reject) => {
            server.once("error", reject);
            server.listen(config.port, () => {
                server.off("error", reject);
                resolve();
            });
        });
    }
    catch (err) {
        hub.dispose();
        throw err;
    }

    // The app needs the bound port, which is known only once listening.
    const port = (server.address() as AddressInfo).port;
    const urlsNow = (): ReadonlyArray<string> => lanUrls(deps.addresses(), port);
    server.on("request", createApp({ hub, sessions, config, logger, addresses: urlsNow, port }));

    return {
        server,
        hub,
        port,
        urls:  urlsNow(),
        close: async () => {
            hub.dispose();
            await hub.flush();
            await new Promise<void>((resolve) => {
                server.close(() => { resolve(); });
                server.closeAllConnections();
            });
        }
    };
}
