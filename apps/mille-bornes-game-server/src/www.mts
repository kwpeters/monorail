#!/usr/bin/env node
import qrcode from "qrcode";
import { getExternalIpv4Addresses } from "@repo/depot-node/networkHelpers";
import { realClock } from "./clock.mjs";
import { loadConfig } from "./config.mjs";
import { consoleLogger } from "./logger.mjs";
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

let stopping = false;
async function shutdown(): Promise<void> {
    if (stopping) {
        return;
    }
    stopping = true;
    logger.info("Shutting down.");
    await running.close();
    process.exit(0);
}

process.on("SIGINT", () => { void shutdown(); });
process.on("SIGTERM", () => { void shutdown(); });
