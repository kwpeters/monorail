/** Minimal logging interface; server code never uses the console directly. */
export interface Logger {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
}


/** Writes timestamped lines to the console. */
export const consoleLogger: Logger = {
    info:  (msg) => console.log(`${new Date().toISOString()} INFO ${msg}`),
    warn:  (msg) => console.warn(`${new Date().toISOString()} WARN ${msg}`),
    error: (msg) => console.error(`${new Date().toISOString()} ERROR ${msg}`)
};


/**
 * Creates a logger that records lines in memory, for tests.
 * @returns A logger whose `lines` hold `LEVEL message` for each call
 */
export function collectingLogger(): Logger & { readonly lines: ReadonlyArray<string> } {
    const lines: Array<string> = [];
    return {
        lines,
        info:  (msg) => { lines.push(`INFO ${msg}`); },
        warn:  (msg) => { lines.push(`WARN ${msg}`); },
        error: (msg) => { lines.push(`ERROR ${msg}`); }
    };
}
