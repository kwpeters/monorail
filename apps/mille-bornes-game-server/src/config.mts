import path from "node:path";
import { fileURLToPath } from "node:url";
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


/**
 * The package's own `data` directory.  This file sits in `src/` or `dist/`, so
 * both resolve to the same place, wherever the server is started from.
 */
export const packageDataDir = fileURLToPath(new URL("../data", import.meta.url));


/** Treats an empty environment variable as unset. */
function nonEmpty(value: string | undefined): string | undefined {
    return value === "" ? undefined : value;
}


/**
 * Reads the server configuration from environment variables.
 * `PORT` (1-65535, default 3000), `MB_DATA_DIR` (default the package's
 * `data` directory; a relative path is taken from `cwd`), `MB_WEB_ROOT`
 * (default none).
 * @param env - The environment variables
 * @param cwd - The working directory a relative `MB_DATA_DIR` is resolved from
 * @param defaultDataDir - The data directory when `MB_DATA_DIR` is unset
 * @returns The configuration, or a plain-English error message
 */
export function loadConfig(
    env:            NodeJS.ProcessEnv,
    cwd:            string,
    defaultDataDir: string = packageDataDir
): Result<ServerConfig, string> {
    let port = 3000;
    if (env.PORT !== undefined && env.PORT !== "") {
        port = /^\d+$/.test(env.PORT) ? Number(env.PORT) : NaN;
        if (!(port >= 1 && port <= 65535)) {
            return new FailedResult(`PORT must be a whole number from 1 to 65535, but was "${env.PORT}".`);
        }
    }

    return new SucceededResult({
        port,
        dataDir: path.resolve(cwd, nonEmpty(env.MB_DATA_DIR) ?? defaultDataDir),
        webRoot: nonEmpty(env.MB_WEB_ROOT) ?? null,
        timings: defaultTimings
    });
}
