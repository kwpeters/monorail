/**
 * A handle returned by {@link createDebouncer} that lets callers schedule or
 * cancel the debounced action.
 */
export interface IDebouncer {
    schedule: () => void;
    cancel:   () => void;
}


/**
 * Creates a debouncer that runs `action` once activity has been quiet for
 * `delayMs` milliseconds. Rapid-fire calls to `schedule()` reset the timer;
 * only the final call's delay actually elapses.
 *
 * @param delayMs - Quiet-period duration in milliseconds.
 * @param action  - Function to call once the quiet period elapses.
 * @returns An {@link IDebouncer} with `schedule` and `cancel` methods.
 */
export function createDebouncer(delayMs: number, action: () => void): IDebouncer {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const cancel = (): void => {
        if (timer) {
            clearTimeout(timer);
            timer = undefined;
        }
    };

    const schedule = (): void => {
        cancel();
        timer = setTimeout(() => {
            timer = undefined;
            action();
        }, delayMs);
    };

    return { schedule, cancel };
}
