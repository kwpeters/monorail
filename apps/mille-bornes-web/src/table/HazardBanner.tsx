import { useId, type ReactElement } from "react";
import type { PlayingData } from "../screens/GameScreen.js";
import { cardFace } from "../text/cardFace.mjs";
import { Countdown } from "./Countdown.js";


/** What `HazardBanner` needs. */
export interface HazardBannerProps {
    screen: PlayingData;
}


/**
 * The red banner the hit team sees while a hazard is in flight: the hazard
 * and the time left to answer it.  The top bar above it says what to do.
 * Every member of the hit team sees the same banner, whatever they hold, and
 * everyone else sees nothing, so it gives nothing away.
 * @param props - The Playing screen
 * @returns The banner, or nothing outside a hazard window on the viewer's team
 */
export function HazardBanner(props: HazardBannerProps): ReactElement | null {
    const { screen } = props;
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
        </section>
    );
}
