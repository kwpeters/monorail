import { useId, useLayoutEffect, type ReactElement } from "react";
import type { PlayingData } from "../screens/GameScreen.js";
import { cardFace } from "../text/cardFace.mjs";
import { Countdown } from "./Countdown.js";


/** What `HazardBanner` needs. */
export interface HazardBannerProps {
    screen: PlayingData;
    /**
     * What to tell the team: the phase's alert (`topBarMessage()`), or the
     * transient message that has replaced it in the top bar, which the banner
     * covers, while there is one.
     */
    alert:  string;
}


/**
 * The red banner the hit team sees while a hazard is in flight: the hazard,
 * what to do and the time left to answer it.  Every member of the hit team
 * sees the same banner, whatever they hold, and everyone else sees nothing,
 * so it gives nothing away.  It is laid over the top bar (see
 * `.hazard-banner`), so showing and hiding it moves nothing on the table, and
 * its countdown is at the top of the screen: when it shows, the page scrolls
 * to its top (once, so the player can still scroll while it lasts).
 * @param props - The Playing screen and what to tell the team
 * @returns The banner, or nothing outside a hazard window on the viewer's team
 */
export function HazardBanner(props: HazardBannerProps): ReactElement | null {
    const { screen, alert } = props;
    const { phase, me } = screen.view;
    const titleId = useId();
    const shown = phase.kind === "HazardIncoming" && phase.target === me.team;
    // A pick-up may have scrolled a short screen down, and the banner is at
    // the top.  Instant, and before paint, as for a new screen (see App).
    useLayoutEffect(() => {
        if (shown) {
            window.scrollTo(0, 0);
        }
    }, [shown]);
    if (phase.kind !== "HazardIncoming" || !shown) {
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
