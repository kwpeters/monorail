import type { ReactElement } from "react";
import { type TopBarTone } from "../text/phaseHint.mjs";


/** What `TopBar` shows. */
export interface TopBarProps {
    text: string;
    tone: TopBarTone;
}


// Green for the viewer's own turn, red for an alert, blue for the rest.  The
// text is always there, so color is never the only signal.
function toneClass(tone: TopBarTone): string {
    switch (tone) {
        case "MyTurn":
            return "tone-green";
        case "Alert":
            return "tone-red";
        case "Waiting":
        case "Info":
            return "tone-blue";
    }
}


/**
 * The message under the page title, in a polite live region that is always
 * mounted so that changes are announced.
 * @param props - The text and its tone
 * @returns The message bar
 */
export function TopBar(props: TopBarProps): ReactElement {
    return (
        <p className={`top-bar ${toneClass(props.tone)}`} aria-live="polite">
            {props.text}
        </p>
    );
}
