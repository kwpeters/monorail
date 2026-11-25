import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { useEffect, useState } from "react";
import type { PlayingData } from "../screens/GameScreen.js";


/** The kinds of countdown a Playing screen can carry. */
export type TimerKind = NonNullable<PlayingData["timer"]>["kind"];


interface Tick {
    readonly screen:  PlayingData;
    readonly seconds: number;
}


// Four ticks a second, so the display changes within 250 ms of the second.
const tickMs = 250;


function timerOf(screen: PlayingData, kind: TimerKind): Option<number> {
    return Option.fromNullable(screen.timer?.kind === kind ? screen.timer : null)
    .mapSome((t) => t.remainingMs);
}


function wholeSeconds(ms: number): number {
    return Math.max(0, Math.ceil(ms / 1000));
}


/**
 * Gets the time a screen's timer of one kind has left.  The server measures
 * `remainingMs` when it sends the screen, so the deadline is taken when the
 * screen arrives and the display ticks locally from there; a new screen
 * object (a reconnect snapshot, say) starts it again from its own value.
 * @param screen - The Playing screen
 * @param kind - The kind of timer wanted
 * @returns The whole seconds left, or None when the screen has no such timer
 */
export function useCountdown(screen: PlayingData, kind: TimerKind): Option<number> {
    const remaining = timerOf(screen, kind);
    // The last tick, and the screen it counted for.
    const [tick, setTick] = useState<Option<Tick>>(NoneOption.get());

    useEffect(() => {
        const ms = timerOf(screen, kind);
        // A timer that has run out shows 0 and needs no clock.
        if (ms.isNone || ms.value <= 0) {
            return undefined;
        }
        const deadline = Date.now() + ms.value;
        const id = window.setInterval(() => {
            const seconds = wholeSeconds(deadline - Date.now());
            setTick(new SomeOption({ screen, seconds }));
            if (seconds === 0) {
                window.clearInterval(id);
            }
        }, tickMs);
        return () => window.clearInterval(id);
    }, [screen, kind]);

    // Until a screen's first tick, show its own value, not an older screen's.
    return remaining.mapSome((ms) => tick.isSome && tick.value.screen === screen ?
        tick.value.seconds :
        wholeSeconds(ms));
}
