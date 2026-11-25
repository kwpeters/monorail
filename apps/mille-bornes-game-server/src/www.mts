#!/usr/bin/env node
import qrcode from "qrcode";
import { getExternalIpv4Addresses } from "@repo/depot-node/networkHelpers";
import { realClock, type Clock } from "./clock.mjs";
import { loadConfig } from "./config.mjs";
import { consoleLogger } from "./logger.mjs";
import { createShutdown } from "./shutdown.mjs";
import { startServer, type RunningServer } from "./startServer.mjs";


const logger = consoleLogger;

const config = loadConfig(process.env, process.cwd());
if (config.failed) {
    console.error(config.error);
    process.exit(1);
}

// Unexpected failures are logged; one bad request must not stop a game night.
process.on("uncaughtException", (err) => { logger.error(`Uncaught exception: ${err.message}`); });
process.on("unhandledRejection", (reason) => {
    logger.error(`Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`);
});

let running: RunningServer;
try {
    running = await startServer({
        config:    config.value,
        clock:     realClock,
        rand:      Math.random,
        logger,
        addresses: getExternalIpv4Addresses
    });
}
catch (err) {
    if ((err as NodeJS.ErrnoException).code === "EADDRINUSE") {
        console.error(`Port ${config.value.port.toString()} is already in use.`);
    }
    else {
        console.error(`The server could not start: ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exit(1);
}

const urls = running.urls.length > 0 ? running.urls : [`http://localhost:${running.port.toString()}/`];
console.log("Mille Bornes is running.  Players can open:");
urls.forEach((u) => { console.log(`  ${u}`); });
console.log(`Host page (on this computer only): http://localhost:${running.port.toString()}/host`);
console.log(await qrcode.toString(urls[0]!, { type: "terminal", small: true }));

// The force-exit timer must not keep the process alive.
const unrefClock: Clock = {
    now:        () => realClock.now(),
    setTimeout: (fn, ms) => {
        const handle = setTimeout(fn, ms);
        handle.unref();
        return () => { clearTimeout(handle); };
    }
};

const shutdown = createShutdown({
    close: async () => running.close(),
    exit:  (code) => process.exit(code),
    clock: unrefClock,
    logger
});

process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });

// Windows sends SIGBREAK when the console window is closed; elsewhere the
// signal is not supported, so it is registered on Windows only.
if (process.platform === "win32") {
    process.on("SIGBREAK", () => { void shutdown(); });
}
