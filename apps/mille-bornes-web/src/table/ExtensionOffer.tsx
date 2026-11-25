import type { PlayerCommand } from "@repo/mille-bornes-core/commands";
import { useId, useLayoutEffect, useRef, type ReactElement } from "react";
import type { PlayingData } from "../screens/GameScreen.js";
import { extensionQuestion, extensionRisk } from "../text/phaseHint.mjs";
import { Countdown } from "./Countdown.js";


/** What `ExtensionOffer` needs. */
export interface ExtensionOfferProps {
    screen:   PlayingData;
    /** Sends the decision. */
    onDecide: (command: PlayerCommand) => void;
}


/**
 * The decider's choice when their team reaches 700 miles: call Extension and
 * race on to 1,000, or stop here.  The risk is said in one sentence, and the
 * offer's countdown is shown; no answer counts as stopping.  Everyone else
 * sees the top bar's "is deciding" line instead.  It sits at the top of the
 * table, which a short phone may have scrolled away, so it scrolls into view
 * (instantly, without moving the focus) when it appears.
 * @param props - The Playing screen and the way to send the decision
 * @returns The panel, or nothing for anyone but the decider
 */
export function ExtensionOffer(props: ExtensionOfferProps): ReactElement | null {
    const { screen, onDecide } = props;
    const { phase, me } = screen.view;
    const titleId = useId();
    const panel = useRef<HTMLElement>(null);
    const shown = phase.kind === "ExtensionOffer" && phase.decider === me.id;
    useLayoutEffect(() => {
        if (shown) {
            panel.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
        }
    }, [shown]);
    if (!shown) {
        return null;
    }
    return (
        <section ref={panel} className="extension-offer" aria-labelledby={titleId}>
            <h2 id={titleId}>{extensionQuestion}</h2>
            <p>{extensionRisk}</p>
            <Countdown screen={screen} kind="ExtensionOffer" />
            <div className="extension-actions">
                <button
                    type="button"
                    className="button primary"
                    onClick={() => onDecide({ type: "CallExtension" })}
                >
                    Call Extension
                </button>
                <button
                    type="button"
                    className="button"
                    onClick={() => onDecide({ type: "DeclineExtension" })}
                >
                    Stop here
                </button>
            </div>
        </section>
    );
}
