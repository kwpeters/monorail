import { type Clock } from "./clock.mjs";
import { type Logger } from "./logger.mjs";


/** The default time a shutdown may take before the process exits anyway. */
export const defaultForceExitMs = 5000;


/** What `createShutdown()` needs; the caller supplies the process and timer. */
export interface ShutdownDeps {

    /** Stops the server; may reject or never settle. */
    close:        () => Promise<void>;

    /** Ends the process (`process.exit`). */
    exit:         (code: number) => void;

    /** Schedules the force-exit timer; it should not keep the process alive. */
    clock:  Clock;
    logger: Logger;

    /** Default `defaultForceExitMs`. */
    forceExitMs?: number;
}


/**
 * Makes the function that runs when the process is told to stop.  It always
 * ends in `exit`: 0 after a clean close, 1 if `close` threw or took longer than
 * `forceExitMs`.  `exit` is called at most once, and a later call of the
 * returned function is ignored.
 * @param deps - What the shutdown needs
 * @returns The shutdown function
 */
export function createShutdown(deps: ShutdownDeps): () => Promise<void> {
    const { close, exit, clock, logger } = deps;
    let stopping = false;
    let exited = false;
    const exitOnce = (code: number): void => {
        if (!exited) {
            exited = true;
            exit(code);
        }
    };

    return async () => {
        if (stopping) {
            return;
        }
        stopping = true;
        logger.info("Shutting down.");

        const cancelForce = clock.setTimeout(() => {
            logger.error("Shutdown took too long; exiting now.");
            exitOnce(1);
        }, deps.forceExitMs ?? defaultForceExitMs);

        let code = 0;
        try {
            await close();
        }
        catch (err) {
            logger.error(`Shutdown failed: ${err instanceof Error ? err.message : String(err)}`);
            code = 1;
        }
        finally {
            cancelForce();
            exitOnce(code);
        }
    };
}
