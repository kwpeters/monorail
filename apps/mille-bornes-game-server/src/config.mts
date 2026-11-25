import path from "node:path";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";


/** Durations that govern game flow, in milliseconds. */
export interface Timings {
    hazardWindowMs:    number;
    extensionOfferMs:  number;
    raceOverPauseMs:   number;
    robotDelayMinMs:   number;
    robotDelayMaxMs:   number;
    disconnectGraceMs: number;
}


/** The default timings. */
export const defaultTimings: Timings = {
    hazardWindowMs:    5000,
    extensionOfferMs:  30000,
    raceOverPauseMs:   20000,
    robotDelayMinMs:   1000,
    robotDelayMaxMs:   3000,
    disconnectGraceMs: 3000
};


/** Server settings read from the environment at startup. */
export interface ServerConfig {
    port:    number;
    dataDir: string;
    webRoot: string | null;
    timings: Timings;
}


/** Treats an empty environment variable as unset. */
function nonEmpty(value: string | undefined): string | undefined {
    return value === "" ? undefined : value;
}


/**
 * Reads the server configuration from environment variables.
 * `PORT` (1-65535, default 3000), `MB_DATA_DIR` (default `<cwd>/data`),
 * `MB_WEB_ROOT` (default none).
 * @param env - The environment variables
 * @param cwd - The working directory used for the default data directory
 * @returns The configuration, or a plain-English error message
 */
export function loadConfig(env: NodeJS.ProcessEnv, cwd: string): Result<ServerConfig, string> {
    let port = 3000;
    if (env.PORT !== undefined && env.PORT !== "") {
        port = /^\d+$/.test(env.PORT) ? Number(env.PORT) : NaN;
        if (!(port >= 1 && port <= 65535)) {
            return new FailedResult(`PORT must be a whole number from 1 to 65535, but was "${env.PORT}".`);
        }
    }

    return new SucceededResult({
        port,
        dataDir: nonEmpty(env.MB_DATA_DIR) ?? path.join(cwd, "data"),
        webRoot: nonEmpty(env.MB_WEB_ROOT) ?? null,
        timings: defaultTimings
    });
}
