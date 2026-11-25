import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { type TopBarMessage, type TopBarTone } from "../text/phaseHint.mjs";


/**
 * Shows a message in the top bar in place of the phase's own message, then
 * puts the phase's message back.
 * @param text - What to say
 * @param tone - How it should look (default `Info`)
 * @param ms - How long to show it, in milliseconds (default 4,000)
 */
export type SetOverride = (text: string, tone?: TopBarTone, ms?: number) => void;


const defaultOverrideMs = 4000;


/**
 * The way for any component inside the game table to say something in the
 * top bar for a moment (for example why a card cannot be played).  Outside a
 * `GameScreen` it does nothing.
 */
export const OverrideContext = createContext<SetOverride>(() => undefined);


/**
 * Gets the function that shows a transient top bar message.
 * @returns The function provided by the enclosing game table
 */
export function useSetOverride(): SetOverride {
    return useContext(OverrideContext);
}


/** What `useOverrideMessage` returns. */
export interface OverrideMessage {
    /** The transient message, while there is one. */
    override:    Option<TopBarMessage>;
    setOverride: SetOverride;
}


/**
 * Owns the transient top bar message: it is shown for a while, a newer one
 * replaces it and restarts the clock, and the timer is cleared on unmount.
 * @returns The current override and the function that sets one
 */
export function useOverrideMessage(): OverrideMessage {
    const [override, setMessage] = useState<Option<TopBarMessage>>(NoneOption.get());
    const timer = useRef<number | undefined>(undefined);

    const clearTimer = useCallback((): void => {
        window.clearTimeout(timer.current);
        timer.current = undefined;
    }, []);

    const setOverride = useCallback<SetOverride>((text, tone = "Info", ms = defaultOverrideMs) => {
        clearTimer();
        setMessage(new SomeOption({ text, tone }));
        timer.current = window.setTimeout(() => {
            timer.current = undefined;
            setMessage(NoneOption.get());
        }, ms);
    }, [clearTimer]);

    useEffect(() => clearTimer, [clearTimer]);

    return { override, setOverride };
}
