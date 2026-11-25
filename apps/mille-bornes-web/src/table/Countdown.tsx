import type { ReactElement } from "react";
import type { PlayingData } from "../screens/GameScreen.js";
import { useCountdown, type TimerKind } from "./useCountdown.js";


/** What `Countdown` needs. */
export interface CountdownProps {
    screen: PlayingData;
    kind:   TimerKind;
}


/**
 * The seconds left on a screen's timer, in a `timer` element.  A timer is
 * not a live region, so screen readers are not told every second; the top
 * bar announces the start.
 * @param props - The screen and the kind of timer
 * @returns The countdown, or nothing when the screen has no such timer
 */
export function Countdown(props: CountdownProps): ReactElement | null {
    const seconds = useCountdown(props.screen, props.kind);
    return seconds.match(
        (n) => (
            <p className="countdown" role="timer">
                {`${n} ${n === 1 ? "second" : "seconds"} left`}
            </p>
        ),
        () => null
    );
}
