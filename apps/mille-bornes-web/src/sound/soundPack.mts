import { NoneOption, SomeOption, type Option } from "@repo/depot/option";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { PlayerId } from "@repo/mille-bornes-core/ids";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { z } from "zod";
import { raceWinner } from "../text/describeEvent.mjs";


/** Every sound the game can make. */
export const soundNameSchema = z.enum([
    "roll", "drive", "hazard", "remedy", "safety", "coupFourre", "discard", "draw",
    "yourTurn", "windowAlert", "raceWon", "gameOver", "honk"
]);


/** The name of one sound (see `soundNameSchema`). */
export type SoundName = z.infer<typeof soundNameSchema>;


/**
 * One note of a sound: an oscillator that starts `delayMs` after the sound,
 * swells quickly to `peak`, and fades away over `ms`.  Its pitch glides from
 * `hz` to `slideToHz` when that is given.
 */
export interface Tone {
    readonly wave:       "sine" | "square" | "sawtooth" | "triangle";
    readonly hz:         number;
    readonly slideToHz?: number;
    /** The loudest it gets, from 0 to 1; a sound's tones add up. */
    readonly peak:       number;
    readonly ms:         number;
    readonly delayMs:    number;
}


// A note of an equal-tempered scale.
const note = {
    c4: 262, g4: 392, c5: 523, e5: 659, g5: 784, a5: 880, c6: 1047, e6: 1319
} as const;


// One note; the pitch glides to `slideToHz` when that is given.
function tone(
    wave: Tone["wave"],
    hz: number,
    ms: number,
    delayMs: number,
    peak: number,
    slideToHz?: number
): Tone {
    return { wave, hz, ms, delayMs, peak, ...(slideToHz === undefined ? {} : { slideToHz }) };
}


/**
 * The synthesized sounds: small recipes of oscillators and gain envelopes
 * that the audio engine plays with the Web Audio API.  No audio files, so
 * any recipe can be swapped for a recorded clip later.
 */
export const soundPack: Readonly<Record<SoundName, ReadonlyArray<Tone>>> = {
    // A goofy rising "boing", with a wobbly overtone.
    roll: [
        tone("sine", 180, 280, 0, 0.3, 700),
        tone("triangle", 360, 280, 0, 0.12, 1400)
    ],

    // A little engine "vroom": a sawtooth that climbs and fades.
    drive: [
        tone("sawtooth", 90, 260, 0, 0.14, 240),
        tone("square", 45, 260, 0, 0.1, 120)
    ],

    // A descending "wah-wah-waaah" sad trombone.
    hazard: [
        tone("sawtooth", 392, 150, 0, 0.16, 349),
        tone("sawtooth", 370, 150, 170, 0.16, 330),
        tone("sawtooth", 349, 520, 340, 0.18, 220)
    ],

    // A relieved two-note "ta-da".
    remedy: [
        tone("triangle", note.c5, 120, 0, 0.25),
        tone("triangle", note.g5, 260, 110, 0.25)
    ],

    // A bright, shimmering chime.
    safety: [
        tone("sine", note.a5, 520, 0, 0.22),
        tone("sine", note.a5 * 1.5, 520, 60, 0.14),
        tone("sine", note.a5 * 2, 480, 120, 0.1)
    ],

    // A brassy "ta-ta-ta-TAAA" fanfare of layered sawtooth and square waves.
    coupFourre: [
        tone("sawtooth", note.g4, 130, 0, 0.16),
        tone("square", note.g4, 130, 0, 0.06),
        tone("sawtooth", note.c5, 130, 140, 0.16),
        tone("square", note.c5, 130, 140, 0.06),
        tone("sawtooth", note.e5, 130, 280, 0.16),
        tone("square", note.e5, 130, 280, 0.06),
        tone("sawtooth", note.g5, 600, 420, 0.2),
        tone("square", note.g5 * 1.006, 600, 420, 0.08),
        tone("sawtooth", note.c6, 600, 420, 0.1)
    ],

    // A quick "bwip" down into the pile.
    discard: [tone("triangle", 420, 140, 0, 0.22, 130)],

    // A tiny card-flip "tick-tick".
    draw: [
        tone("square", 1200, 35, 0, 0.08, 800),
        tone("square", 1000, 35, 70, 0.08, 700)
    ],

    // A friendly two-note "ding-dong" that rises.
    yourTurn: [
        tone("sine", note.e5, 160, 0, 0.28),
        tone("sine", note.a5, 320, 170, 0.28)
    ],

    // An urgent warble, four short bleeps alternating high and low.
    windowAlert: [
        tone("square", 880, 90, 0, 0.14),
        tone("square", 660, 90, 110, 0.14),
        tone("square", 880, 90, 220, 0.14),
        tone("square", 660, 120, 330, 0.14)
    ],

    // A trip-completed arpeggio that ends on a long, high note.
    raceWon: [
        tone("triangle", note.c5, 130, 0, 0.25),
        tone("triangle", note.e5, 130, 120, 0.25),
        tone("triangle", note.g5, 130, 240, 0.25),
        tone("triangle", note.c6, 650, 360, 0.28),
        tone("sine", note.e6, 650, 360, 0.1)
    ],

    // A grand closing cadence that settles down to a low C.
    gameOver: [
        tone("triangle", note.g4, 200, 0, 0.26),
        tone("triangle", 330, 200, 220, 0.26),
        tone("triangle", note.c4, 800, 440, 0.3),
        tone("sine", note.c4 * 2, 800, 440, 0.12)
    ],

    // Two slightly detuned square waves beating against each other: a honk.
    honk: [
        tone("square", 349, 160, 0, 0.12, 330),
        tone("square", 356, 160, 0, 0.12, 337),
        tone("square", 349, 300, 200, 0.14, 310),
        tone("square", 357, 300, 200, 0.14, 318)
    ]
};


const honker = "sir honks-a-lot";


/**
 * Lists the sounds an event makes for one viewer.  Pure; depends only on the
 * event and the view, never on the viewer's hand, so every member of a hit
 * team hears the same thing whether or not they hold the counter.
 * @param event - The event, as redacted for the viewer
 * @param view - The view the event arrived with (it names the seats)
 * @returns The sounds, loudest news first; empty for events that are silent
 * to this viewer
 */
export function soundsFor(event: GameEvent, view: PlayerView): ReadonlyArray<SoundName> {
    // A play by the whimsical robot (or anyone who picked its name) honks.
    const withHonk = (player: PlayerId, ...sounds: SoundName[]): ReadonlyArray<SoundName> => {
        const seat = view.seats.find((s) => s.id === player);
        return seat?.name.normalize("NFKC").toLowerCase() === honker ?
            [...sounds, "honk"] :
            sounds;
    };
    switch (event.type) {
        case "RaceDealt":
        case "ExtensionCalled":
        case "ExtensionDeclined":
            return [];
        case "TurnStarted":
            return event.player === view.me.id ? ["yourTurn"] : [];
        case "CardDrawn":
            return event.player === view.me.id ? ["draw"] : [];
        case "DistancePlayed":
            return withHonk(event.player, "drive");
        case "HazardPlayed":
            // Only the hit team is warned that a window has opened.
            return withHonk(
                event.player,
                "hazard",
                ...(event.targetTeam === view.me.team ? ["windowAlert" as const] : [])
            );
        case "HazardLanded":
            return ["hazard"];
        case "RemedyPlayed":
            return withHonk(
                event.player,
                "remedy",
                ...(event.card === "Roll" ? ["roll" as const] : [])
            );
        case "SafetyPlayed":
            return withHonk(event.player, "safety");
        case "CoupFourrePlayed":
            return withHonk(event.player, "coupFourre");
        case "CardDiscarded":
            return withHonk(event.player, "discard");
        case "ExtensionOffered":
            return event.player === view.me.id ? ["yourTurn"] : [];
        case "RaceEnded":
            // The winners fanfare; everyone else gets no sound rather than a
            // sad one (a tie has no winner).
            return raceWinner(event.result).match(
                (winner) => winner === view.me.team ? ["raceWon"] : [],
                () => []
            );
        case "GameEnded":
            return ["gameOver"];
    }
}


// Buzzes are short and few: a phone in a pocket says "look at me", no more.
const yourTurnBuzz: ReadonlyArray<number> = [60];
const windowAlertBuzz: ReadonlyArray<number> = [120, 80, 120];


/**
 * Gets the vibration pattern for an event, for `navigator.vibrate`.  Only
 * your turn and a hazard window against your team buzz, and the hit team's
 * members all get the same pattern.
 * @param event - The event, as redacted for the viewer
 * @param view - The view the event arrived with
 * @returns Vibrate and pause durations in milliseconds, or none
 */
export function vibrationFor(
    event: GameEvent,
    view: PlayerView
): Option<ReadonlyArray<number>> {
    const sounds = soundsFor(event, view);
    if (sounds.includes("windowAlert")) {
        return new SomeOption(windowAlertBuzz);
    }
    return sounds.includes("yourTurn") ? new SomeOption(yourTurnBuzz) : NoneOption.get();
}
