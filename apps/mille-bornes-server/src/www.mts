#!/usr/bin/env node
import * as http from "node:http";
import { Server } from "socket.io";
import type { ISystemError } from "@repo/depot-node/nodeTypes";
import { getExternalIpv4Addresses } from "@repo/depot-node/networkHelpers";
import { app } from "./app.mjs";
import { logger } from "./logger.mjs";


/**
 * Get port from environment and store in Express.
 */
const port = normalizePort(process.env.PORT || "3000");
app.set("port", port);

/**
 * Create HTTP server.
 */
const server = http.createServer(app);

//
// Create the socket.io server.
//
const io = new Server(server);

io.on("connection", (socket) => {
    logger.info("A client has connected.");

    socket.on("disconnect", () => {
        logger.info("A client has disconnected.");
    });
});


/**
 * Listen on provided port, on all network interfaces.
 */
server.listen(port);
server.on("error", onError);
server.on("listening", onListening);


/**
 * Normalize a port into a number, string, or false.
 */
function normalizePort(val: string): string | number | false {
    const port = parseInt(val, 10);

    if (isNaN(port)) {
        // named pipe
        return val;
    }

    if (port >= 0) {
        // port number
        return port;
    }

    return false;
}


/**
 * Event listener for HTTP server "error" event.
 */
function onError(error: ISystemError) {
    if (error.syscall !== "listen") {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw error;
    }

    const portStr = typeof port === "string" ? "pipe " + port : "port " + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case "EACCES":
            console.error(portStr + " requires elevated privileges");
            process.exit(1);
            break;
        case "EADDRINUSE":
            console.error(portStr + " is already in use");
            process.exit(1);
            break;
        default:
            // eslint-disable-next-line @typescript-eslint/only-throw-error
            throw error;
    }
}


/**
 * Event listener for HTTP server "listening" event.
 */
function onListening() {
    const addr = server.address();
    const portStr = typeof addr === "string" ? `pipe ${addr}` : `port ${addr?.port}`;

    const addresses = getExternalIpv4Addresses();
    const urls = Array.from(addresses.entries()).map(([name, addr]) => `[${name}] http://${addr}:${port}/`);

    logger.info(`Listening on ${portStr}.`);
    logger.info(`Accessible at: ${urls.join(", ")}`);
}
