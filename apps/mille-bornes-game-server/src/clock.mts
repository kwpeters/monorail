/** Source of time for server code; lets tests control time. */
export interface Clock {
    /** @returns The current time in milliseconds since the epoch. */
    now(): number;

    /**
     * Schedules a function to run once after a delay.
     * @param fn - The function to run
     * @param ms - The delay in milliseconds
     * @returns A function that cancels the timer
     */
    setTimeout(fn: () => void, ms: number): () => void;
}


/** The clock backed by the system time and Node timers. */
export const realClock: Clock = {
    now:        () => Date.now(),
    setTimeout: (fn, ms) => {
        const handle = setTimeout(fn, ms);
        return () => clearTimeout(handle);
    }
};
