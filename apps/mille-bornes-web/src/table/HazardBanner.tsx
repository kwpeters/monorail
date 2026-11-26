import { useId, type ReactElement } from "react";
import type { PlayingData } from "../screens/GameScreen.js";
import { cardFace } from "../text/cardFace.mjs";
import { Countdown } from "./Countdown.js";


/** What `HazardBanner` needs. */
export interface HazardBannerProps {
    screen: PlayingData;
    /**
     * The phase's alert (`topBarMessage()`), kept here because a transient
     * message can replace it in the top bar.
     */
    alert:  string;
}


/**
 * The red banner the hit team sees while a hazard is in flight: the hazard,
 * what to do and the time left to answer it.  Every member of the hit team
 * sees the same banner, whatever they hold, and everyone else sees nothing,
 * so it gives nothing away.  It is laid over the top bar (see
 * `.hazard-banner`), so showing and hiding it moves nothing on the table, and
 * its countdown is at the top of the screen.
 * @param props - The Playing screen and the phase's alert
 * @returns The banner, or nothing outside a hazard window on the viewer's team
 */
export function HazardBanner(props: HazardBannerProps): ReactElement | null {
    const { screen, alert } = props;
    const { phase, me } = screen.view;
    const titleId = useId();
    if (phase.kind !== "HazardIncoming" || phase.target !== me.team) {
        return null;
    }
    const face = cardFace(phase.hazard);
    return (
        <section className="hazard-banner" aria-labelledby={titleId}>
            <h2 id={titleId} className="hazard-title">
                <span aria-hidden="true">{`${face.emoji} `}</span>
                {`${face.label}!`}
            </h2>
            <Countdown screen={screen} kind="HazardWindow" />
            <p className="hazard-alert">{alert}</p>
        </section>
    );
}
