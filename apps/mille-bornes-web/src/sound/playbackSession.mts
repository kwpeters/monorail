/** The part of Safari's Audio Session API that `startPlaybackSession` uses. */
export interface AudioSessionLike {
    type: string;
}


/** The part of `HTMLAudioElement` that `startPlaybackSession` uses. */
export interface AudioElementLike {
    src:             string;
    loop:            boolean;
    playsInline:     boolean;
    preload:         string;
    readonly paused: boolean;
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


// The silent element of each document: one per page, kept reachable so it is
// never garbage-collected, and found again to restart it.
const elements = new WeakMap<object, AudioElementLike>();


/**
 * Asks iOS to treat the page's audio as media playback, so Web Audio is
 * audible even with the ring/silent switch on silent (otherwise it uses the
 * "ambient" session, which obeys the switch).  Call it from a user gesture,
 * on every gesture until it returns true.
 *
 * With Safari's Audio Session API it sets `navigator.audioSession.type`,
 * which is permanent, and returns true.
 * Older iOS has no such API, but starting a media element switches the page
 * to a playback session, so one hidden element loops a silent clip.
 * A browser can refuse the first `play()` (it rejects asynchronously), and iOS
 * pauses the element when the app is backgrounded, the phone locks or audio is
 * interrupted.
 * So on this path every call starts the element if it is missing, restarts it
 * if it is paused, and does nothing if it is playing; it never returns true,
 * because the element can be paused again at any time.
 *
 * The session is deliberately left running when the game is muted: mute only
 * silences the game's own sounds, and unmuting then works at once.
 *
 * Side effects, left as they are and unverified on a device: a playing media
 * element can make iOS show lock-screen Now Playing controls
 * (`navigator.mediaSession` could hide them, but how that behaves across iOS
 * versions is unknown, so it is not touched), and a playback session can
 * interrupt the player's own music or podcast app on the first tap, even while
 * the game is muted.
 *
 * Nothing here throws.
 * @param env - The `navigator` and `document` to use
 * @returns True when the session is permanent, so the caller can stop calling
 */
export function startPlaybackSession(env: PlaybackSessionEnv): boolean {
    try {
        if (env.navigator.audioSession !== undefined) {
            env.navigator.audioSession.type = "playback";
            return true;
        }
        let audio = elements.get(env.document);
        if (audio === undefined) {
            audio = env.document.createElement("audio");
            audio.src = silentWavDataUri;
            audio.loop = true;
            audio.playsInline = true;
            audio.setAttribute("playsinline", "");
            audio.preload = "auto";
            elements.set(env.document, audio);
        }
        else if (!audio.paused) {
            return false;
        }
        // A rejection only means the browser refused; the next gesture retries.
        Promise.resolve(audio.play()).catch(() => undefined);
    }
    catch {
        // No playback session: sounds still play where the switch allows.
    }
    return false;
}
