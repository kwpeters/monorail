import { useState, type ReactElement } from "react";
import type { AudioEngine } from "./audioEngine.mjs";


/** What `MuteButton` needs. */
export interface MuteButtonProps {
    engine: AudioEngine;
}


/**
 * The switch for sound and vibration, an icon button for the shell's
 * header.  Its name says what a press does ("Mute sounds" or "Unmute
 * sounds"); it has no `aria-pressed`, because a pressed button whose name
 * also flips is announced as "Unmute sounds, pressed", which reads as the
 * opposite of the truth.  The emoji is decoration.  A press also counts as
 * the first user gesture that unlocks audio.
 * @param props - The engine
 * @returns The button
 */
export function MuteButton(props: MuteButtonProps): ReactElement {
    const { engine } = props;
    const [muted, setMuted] = useState(engine.muted);
    const name = muted ? "Unmute sounds" : "Mute sounds";
    return (
        <button
            type="button"
            className="button mute-button"
            aria-label={name}
            title={name}
            onClick={() => {
                engine.unlock();
                engine.setMuted(!muted);
                setMuted(!muted);
            }}
        >
            <span aria-hidden="true">{muted ? "\u{1F507}" : "\u{1F50A}"}</span>
        </button>
    );
}
