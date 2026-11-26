import { useState, type ReactElement } from "react";
import type { AudioEngine } from "./audioEngine.mjs";


/** What `MuteButton` needs. */
export interface MuteButtonProps {
    engine:   AudioEngine;

    /**
     * `icon` (the default) is an icon button for the shell's header;
     * `menuitem` is a row of a menu, with the name written out beside the icon.
     */
    variant?: "icon" | "menuitem";
}


/**
 * The switch for sound and vibration.  Its name says what a press does
 * ("Mute sounds" or "Unmute sounds"); it has no `aria-pressed`, because a
 * pressed button whose name also flips is announced as "Unmute sounds,
 * pressed", which reads as the opposite of the truth.  The emoji is
 * decoration.  A press also counts as the first user gesture that unlocks
 * audio.
 * @param props - The engine, and whether it is an icon or a menu item
 * @returns The button
 */
export function MuteButton(props: MuteButtonProps): ReactElement {
    const { engine } = props;
    const [muted, setMuted] = useState(engine.muted);
    const name = muted ? "Unmute sounds" : "Mute sounds";
    const icon = <span aria-hidden="true">{muted ? "\u{1F507}" : "\u{1F50A}"}</span>;
    const toggle = (): void => {
        engine.unlock();
        engine.setMuted(!muted);
        setMuted(!muted);
    };
    if (props.variant === "menuitem") {
        // Not in the tab order: a menu is one stop, and arrow keys move in it.
        return (
            <button
                type="button"
                role="menuitem"
                tabIndex={-1}
                className="menu-item"
                onClick={toggle}
            >
                {icon}
                {name}
            </button>
        );
    }
    return (
        <button
            type="button"
            className="button mute-button"
            aria-label={name}
            title={name}
            onClick={toggle}
        >
            {icon}
        </button>
    );
}
