import { useState, type ReactElement, type ReactNode } from "react";
import { createBrowserAudioEngine, type AudioEngine } from "./audioEngine.mjs";
import { AudioEngineContext, useUnlockOnGesture } from "./useSound.js";


/** What `SoundProvider` needs. */
export interface SoundProviderProps {
    /** Replaces the browser's engine; for tests. */
    engine?:  AudioEngine;
    children: ReactNode;
}


/**
 * Provides the one audio engine of the session to every screen and unlocks it
 * on the first tap or key press.
 * @param props - The test engine, if any, and the app
 * @returns The app with the engine in its context
 */
export function SoundProvider(props: SoundProviderProps): ReactElement {
    const [engine] = useState(() => props.engine ?? createBrowserAudioEngine());
    useUnlockOnGesture(engine);
    return (
        <AudioEngineContext.Provider value={engine}>{props.children}</AudioEngineContext.Provider>
    );
}
