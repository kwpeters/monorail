import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NoneOption, Option, SomeOption } from "@repo/depot/option";
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
    webRoot: Option<string>;
    timings: Timings;
}


/**
 * The package's own `data` directory.  This file sits in `src/` or `dist/`, so
 * both resolve to the same place, wherever the server is started from.
 */
export const packageDataDir = fileURLToPath(new URL("../data", import.meta.url));


/**
 * The web app's built directory, `apps/mille-bornes-web/dist`.  Like
 * `packageDataDir`, it resolves the same from `src/` and `dist/`.
 */
export const packageWebRoot =
    fileURLToPath(new URL("../../mille-bornes-web/dist", import.meta.url));


/** Each timing's environment variable and its smallest allowed value. */
const timingVariables: ReadonlyArray<[keyof Timings, string, number]> = [
    ["hazardWindowMs",    "MB_HAZARD_WINDOW_MS",    1],
    ["extensionOfferMs",  "MB_EXTENSION_OFFER_MS",  1],
    ["raceOverPauseMs",   "MB_RACE_OVER_PAUSE_MS",  1],
    ["robotDelayMinMs",   "MB_ROBOT_DELAY_MIN_MS",  0],
    ["robotDelayMaxMs",   "MB_ROBOT_DELAY_MAX_MS",  0],
    ["disconnectGraceMs", "MB_DISCONNECT_GRACE_MS", 0]
];


/** Treats an empty environment variable as unset. */
function nonEmpty(value: string | undefined): Option<string> {
    return value === "" ? NoneOption.get() : Option.fromNullable(value);
}


/**
 * Reads the server configuration from environment variables.
 * `PORT` (1-65535, default 3000), `MB_DATA_DIR` (default the package's
 * `data` directory; a relative path is taken from `cwd`), `MB_WEB_ROOT`
 * (default the built web app when it exists, otherwise none), and the
 * timings `MB_HAZARD_WINDOW_MS`, `MB_EXTENSION_OFFER_MS`,
 * `MB_RACE_OVER_PAUSE_MS`, `MB_ROBOT_DELAY_MIN_MS`, `MB_ROBOT_DELAY_MAX_MS`
 * and `MB_DISCONNECT_GRACE_MS` (default `defaultTimings`).
 * @param env - The environment variables
 * @param cwd - The working directory a relative `MB_DATA_DIR` is resolved from
 * @param defaultDataDir - The data directory when `MB_DATA_DIR` is unset
 * @param exists - Tells whether a path exists (checks for the built web app)
 * @returns The configuration, or a plain-English error message
 */
export function loadConfig(
    env:            NodeJS.ProcessEnv,
    cwd:            string,
    defaultDataDir: string = packageDataDir,
    exists:         (p: string) => boolean = fs.existsSync
): Result<ServerConfig, string> {
    let port = 3000;
    const portText = nonEmpty(env.PORT);
    if (portText.isSome) {
        port = /^\d+$/.test(portText.value) ? Number(portText.value) : NaN;
        if (!(port >= 1 && port <= 65535)) {
            return new FailedResult(
                `PORT must be a whole number from 1 to 65535, but was "${portText.value}".`
            );
        }
    }

    const timings: Timings = { ...defaultTimings };
    for (const [key, name, min] of timingVariables) {
        const text = nonEmpty(env[name]);
        if (text.isSome) {
            const ms = /^\d+$/.test(text.value) ? Number(text.value) : NaN;
            if (!(ms >= min && Number.isSafeInteger(ms))) {
                return new FailedResult(
                    `${name} must be a whole number of at least ${min.toString()}, ` +
                    `but was "${text.value}".`
                );
            }
            timings[key] = ms;
        }
    }
    if (timings.robotDelayMinMs > timings.robotDelayMaxMs) {
        return new FailedResult(
            "MB_ROBOT_DELAY_MIN_MS must not be more than MB_ROBOT_DELAY_MAX_MS " +
            `(${timings.robotDelayMinMs.toString()} > ${timings.robotDelayMaxMs.toString()}).`
        );
    }

    const webRoot = nonEmpty(env.MB_WEB_ROOT).bindNone(() => {
        return exists(packageWebRoot) ? new SomeOption(packageWebRoot) : NoneOption.get();
    });

    return new SucceededResult({
        port,
        dataDir: path.resolve(cwd, nonEmpty(env.MB_DATA_DIR).defaultValue(defaultDataDir)),
        webRoot,
        timings
    });
}
