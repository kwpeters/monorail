/** The part of Safari's Audio Session API that `startPlaybackSession` uses. */
export interface AudioSessionLike {
    type: string;
}


/** The part of `HTMLAudioElement` that `startPlaybackSession` uses. */
export interface AudioElementLike {
    src:         string;
    loop:        boolean;
    playsInline: boolean;
    preload:     string;
    setAttribute(name: string, value: string): void;
    play(): unknown;
}


/** The browser globals `startPlaybackSession` uses, so a test can pass fakes. */
export interface PlaybackSessionEnv {
    // Partial<Navigator> keeps this from being a "weak type" that
    // `Navigator` shares no property with.
    navigator: Partial<Navigator> & { audioSession?: AudioSessionLike };
    document:  { createElement(tag: "audio"): AudioElementLike };
}


// A silent mono 8-bit PCM WAV, 0.1 s at 8 kHz, as a data URI.
function makeSilentWavDataUri(): string {
    const sampleRate = 8000;
    const samples = sampleRate / 10;
    const bytes = new Uint8Array(44 + samples);
    const view = new DataView(bytes.buffer);
    const text = (at: number, s: string): void => {
        for (let i = 0; i < s.length; i++) {
            bytes[at + i] = s.charCodeAt(i);
        }
    };
    text(0, "RIFF");
    view.setUint32(4, bytes.length - 8, true);
    text(8, "WAVE");
    text(12, "fmt ");
    view.setUint32(16, 16, true);
    // PCM, mono.
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    // Byte rate, block align, bits per sample.
    view.setUint32(28, sampleRate, true);
    view.setUint16(32, 1, true);
    view.setUint16(34, 8, true);
    text(36, "data");
    view.setUint32(40, samples, true);
    // 8-bit PCM is unsigned: silence is the midpoint.
    bytes.fill(0x80, 44);
    return `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
}


/** A tiny silent WAV, as a data URI, that the fallback element loops. */
export const silentWavDataUri = makeSilentWavDataUri();


// The documents already given a playback session, so it starts once per page.
const started = new WeakSet();

// Keeps the silent element reachable so it is never garbage-collected.
const keepAlive: AudioElementLike[] = [];


/**
 * Asks iOS to treat the page's audio as media playback, so Web Audio is
 * audible even with the ring/silent switch on silent (otherwise it uses the
 * "ambient" session, which obeys the switch).  Call it from a user gesture.
 *
 * With Safari's Audio Session API it sets `navigator.audioSession.type`.
 * Older iOS has no such API, but starting a media element switches the page
 * to a playback session, so a hidden element loops a silent clip.
 *
 * The session is deliberately left running when the game is muted: mute only
 * silences the game's own sounds, and unmuting then works at once.
 *
 * Trade-off, left as is: a playing media element can make iOS show lock-screen
 * Now Playing controls.  `navigator.mediaSession` could hide them, but how that
 * behaves across iOS versions is unverified, so it is not touched.
 *
 * Nothing here throws, and calling it again for the same document does nothing.
 * @param env - The `navigator` and `document` to use
 */
export function startPlaybackSession(env: PlaybackSessionEnv): void {
    if (started.has(env.document)) {
        return;
    }
    started.add(env.document);
    try {
        if (env.navigator.audioSession !== undefined) {
            env.navigator.audioSession.type = "playback";
            return;
        }
        const audio = env.document.createElement("audio");
        audio.src = silentWavDataUri;
        audio.loop = true;
        audio.playsInline = true;
        audio.setAttribute("playsinline", "");
        audio.preload = "auto";
        keepAlive.push(audio);
        // A rejection only means the browser refused; sound still plays.
        Promise.resolve(audio.play()).catch(() => undefined);
    }
    catch {
        // No playback session: sounds still play where the switch allows.
    }
}
