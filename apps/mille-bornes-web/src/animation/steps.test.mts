import { NoneOption, SomeOption } from "@repo/depot/option";
import { Card } from "@repo/mille-bornes-core/card";
import { newZone } from "@repo/mille-bornes-core/drivingZone";
import { applyPlayerCommand, applySystemCommand } from "@repo/mille-bornes-core/engine";
import type { GameEvent } from "@repo/mille-bornes-core/events";
import type { Game } from "@repo/mille-bornes-core/game";
import { shuffleDeck } from "@repo/mille-bornes-core/deck";
import { seededRandom } from "@repo/mille-bornes-core/simulation";
import { variantForSeatCount } from "@repo/mille-bornes-core/variant";
import { eventsFor, viewFor, type PlayerView } from "@repo/mille-bornes-core/view";
import { describe, expect, it } from "vitest";
import {
    annId, bobId, extensionOffer, midRace, play, setUp
} from "../testing/engineBatches.mjs";
import { team } from "../testing/viewFixtures.mjs";
import { rollingZone } from "../testing/zoneFixtures.mjs";
import {
    flightMs, releaseAt, rushSteps, stepsFor, stepsForBatch, type Anchor, type Step
} from "./steps.mjs";


// Every event is taken from a batch the real engine emits, redacted for Ann
// (team 1, index 0) as the server would send it to her.
function annsEvents(before: Game, run: (g: Game) => { events: ReadonlyArray<GameEvent> }) {
    return eventsFor(annId, run(before).events);
}


function eventOf(events: ReadonlyArray<GameEvent>, type: GameEvent["type"], nth = 0): GameEvent {
    const found = events.filter((e) => e.type === type)[nth];
    if (found === undefined) {
        throw new Error(`No ${type} in the batch.`);
    }
    return found;
}


const drive = annsEvents(
    midRace, (g) => applyPlayerCommand(g, annId, { type: "Drive", card: "50" }).throwIfFailed()
);
const afterDrive = play(midRace, "Ann", { type: "Drive", card: "50" });
const bobDrives = annsEvents(
    afterDrive, (g) => applyPlayerCommand(g, bobId, { type: "Drive", card: "75" }).throwIfFailed()
);
const attack = applyPlayerCommand(
    midRace, annId, { type: "Attack", card: "Stop", targetTeam: team(1) }
).throwIfFailed();
const landed = annsEvents(
    attack.game, (g) => applySystemCommand(g, { type: "CloseHazardWindow" }).throwIfFailed()
);
const coupFourre = annsEvents(
    attack.game,
    (g) => applyPlayerCommand(g, bobId, { type: "CoupFourre", card: "Right of Way" })
    .throwIfFailed()
);
const needsRoll = setUp([Card.roll, Card.dist25], [Card.dist50], [newZone(), rollingZone()]);
const remedy = annsEvents(
    needsRoll, (g) => applyPlayerCommand(g, annId, { type: "Remedy", card: "Roll" }).throwIfFailed()
);
const safety = annsEvents(
    midRace,
    (g) => applyPlayerCommand(g, annId, { type: "PlaySafety", card: "Driving Ace" }).throwIfFailed()
);
const discard = annsEvents(
    midRace, (g) => applyPlayerCommand(g, annId, { type: "Discard", card: "25" }).throwIfFailed()
);
const offered = annsEvents(
    setUp(
        ["25", "50", "Stop"],
        ["Right of Way", "75", "50", "25", "25", "100"],
        [rollingZone(["200", "200", "100", "100", "50", "25"]), rollingZone()]
    ),
    (g) => applyPlayerCommand(g, annId, { type: "Drive", card: "25" }).throwIfFailed()
);
const called = annsEvents(
    extensionOffer,
    (g) => applyPlayerCommand(g, annId, { type: "CallExtension" }).throwIfFailed()
);
const declined = applyPlayerCommand(extensionOffer, annId, { type: "DeclineExtension" })
.throwIfFailed();
const quick: Game = { ...extensionOffer, config: { ...extensionOffer.config, length: "Quick" } };
const gameEnded = annsEvents(
    quick, (g) => applyPlayerCommand(g, annId, { type: "DeclineExtension" }).throwIfFailed()
);
const deck = shuffleDeck(variantForSeatCount(2).throwIfFailed().deck, seededRandom(2));
const dealt = annsEvents(
    declined.game,
    (g) => applySystemCommand(g, { type: "StartNextRace", deck }).throwIfFailed()
);

const view: PlayerView = viewFor(midRace, annId).throwIfFailed();

const hand: Anchor = { kind: "Hand" };
const drawPile: Anchor = { kind: "DrawPile" };
const discardPile: Anchor = { kind: "DiscardPile" };
const ours: Anchor = { kind: "Team", team: team(0) };
const theirs: Anchor = { kind: "Team", team: team(1) };
// Bob's name chip: where his cards leave from and go.
const bobsSeat: Anchor = { kind: "Seat", player: bobId, team: team(1) };

const fly = (card: Card | undefined, from: Anchor, to: Anchor, lingers = false): Step => ({
    kind: "Fly",
    card: card === undefined ? NoneOption.get() : new SomeOption(card),
    from,
    to,
    ms:   450,
    ...(lingers ? { lingers } : {})
});
const pulse = (target: Anchor, tone: "Good" | "Bad" | "Gold" | "Info"): Step => (
    { kind: "Pulse", target, tone, big: false, ms: 450 }
);
const pause: Step = { kind: "Pause", ms: 150 };


// A Record over every event type, so a new event is a compile error here.
/* eslint-disable @typescript-eslint/naming-convention */
const table: Record<GameEvent["type"], readonly [GameEvent, ReadonlyArray<Step>]> = {
    RaceDealt:      [eventOf(dealt, "RaceDealt"), [pause]],
    TurnStarted:    [eventOf(drive, "TurnStarted"), [pause]],
    CardDrawn:      [eventOf(drive, "CardDrawn"), [fly(undefined, drawPile, bobsSeat)]],
    DistancePlayed: [eventOf(drive, "DistancePlayed"), [fly("50", hand, ours)]],
    HazardPlayed:   [
        eventOf(attack.events, "HazardPlayed"),
        [
            // The card stays visible from the flight into the hold, where
            // the red pulse plays beside it.
            fly("Stop", hand, theirs, true),
            { kind: "Hold", card: "Stop", at: theirs, tone: "Bad", ms: 10000 }
        ]
    ],
    HazardLanded: [eventOf(landed, "HazardLanded"), [pulse(theirs, "Bad")]],
    RemedyPlayed: [eventOf(remedy, "RemedyPlayed"), [fly("Roll", hand, ours), pulse(ours, "Good")]],
    SafetyPlayed: [
        eventOf(safety, "SafetyPlayed"),
        [fly("Driving Ace", hand, ours), pulse(ours, "Gold")]
    ],
    CoupFourrePlayed: [
        eventOf(coupFourre, "CoupFourrePlayed"),
        [
            fly("Right of Way", bobsSeat, theirs),
            { kind: "Pulse", target: theirs, tone: "Gold", big: true, ms: 900 }
        ]
    ],
    CardDiscarded:     [eventOf(discard, "CardDiscarded"), [fly("25", hand, discardPile)]],
    ExtensionOffered:  [eventOf(offered, "ExtensionOffered"), [pulse(ours, "Info")]],
    ExtensionCalled:   [eventOf(called, "ExtensionCalled"), [pulse(ours, "Info")]],
    ExtensionDeclined: [eventOf(declined.events, "ExtensionDeclined"), [pulse(ours, "Info")]],
    RaceEnded:         [eventOf(declined.events, "RaceEnded"), [pause]],
    GameEnded:         [eventOf(gameEnded, "GameEnded"), [pause]]
};
/* eslint-enable @typescript-eslint/naming-convention */


describe("stepsFor", () => {

    it.each(Object.entries(table))("animates %s", (type, [event, expected]) => {
        expect(event.type).toBe(type);
        expect(stepsFor(event, view)).toEqual(expected);
    });


    it("shows nothing for an event of a kind this page does not know", () => {
        const unknown = { type: "PitStop", team: 0 } as unknown as GameEvent;
        expect(stepsFor(unknown, view)).toEqual([]);
    });


    it("flies another player's card from their own name chip to their lane", () => {
        expect(stepsFor(eventOf(bobDrives, "DistancePlayed"), view))
        .toEqual([fly("75", bobsSeat, theirs)]);
    });


    it("falls back to the lane for a player who is not in the view", () => {
        const stranger = { ...view, seats: view.seats.filter((s) => s.id !== bobId) };
        expect(stepsFor(eventOf(bobDrives, "DistancePlayed"), stranger))
        .toEqual([fly("75", theirs, theirs)]);
    });


    it("shows the face of the viewer's own draw, into the hand", () => {
        const drawn = eventOf(bobDrives, "CardDrawn");
        if (drawn.type !== "CardDrawn") {
            throw new Error("Not a CardDrawn.");
        }
        expect(drawn.card).not.toBeNull();
        const steps = stepsFor(drawn, view);
        expect(steps).toHaveLength(1);
        expect(steps[0]).toMatchObject({ kind: "Fly", from: drawPile, to: hand });
        expect(steps[0]!.kind === "Fly" && steps[0]!.card.isSome).toBe(true);
    });


    it("keeps another player's draw face down", () => {
        const [step] = stepsFor(eventOf(drive, "CardDrawn"), view);
        expect(step!.kind === "Fly" && step!.card.isNone).toBe(true);
    });


    it("never fades a hazard's card out between its flight and its hold", () => {
        const steps = stepsFor(eventOf(attack.events, "HazardPlayed"), view);
        expect(steps.map((s) => s.kind)).toEqual(["Fly", "Hold"]);
        expect(steps[0]).toMatchObject({ lingers: true });
        expect(steps[1]).toMatchObject({ tone: "Bad", at: theirs });
    });


    it("keeps a typical play under a second", () => {
        const total = stepsForBatch(drive, view).reduce((ms, s) => ms + s.ms, 0);
        expect(total).toBeLessThan(1000);
    });

});


describe("stepsForBatch", () => {

    it("leaves out the pause of an event without motion when the batch has motion", () => {
        expect(drive.map((e) => e.type)).toContain("TurnStarted");
        expect(stepsForBatch(drive, view).map((s) => s.kind)).toEqual(["Fly", "Fly"]);
    });


    it("keeps the pause when nothing else in the batch shows anything", () => {
        const turnOnly = [eventOf(drive, "TurnStarted")];
        expect(stepsForBatch(turnOnly, view)).toEqual([pause]);
    });


    it("lists the steps of every event, in order", () => {
        expect(stepsForBatch(drive, view)).toEqual([
            fly("50", hand, ours),
            fly(undefined, drawPile, bobsSeat)
        ]);
    });

});


describe("rushSteps", () => {

    it("halves each flight and drops the pulses and pauses", () => {
        const steps = stepsForBatch(remedy, view);
        expect(steps.map((s) => s.kind)).toEqual(["Fly", "Pulse", "Fly"]);
        expect(rushSteps(steps)).toEqual(steps
        .filter((s) => s.kind === "Fly")
        .map((s) => ({ ...s, ms: 225, rushed: true })));
        expect(rushSteps([{ kind: "Pause", ms: 150 }])).toEqual([]);
    });


    it("keeps a hold, which the waiting batch ends anyway", () => {
        const held = stepsForBatch(eventsFor(annId, attack.events), view);
        expect(rushSteps(held).map((s) => s.kind)).toEqual(["Fly", "Hold"]);
    });

});


describe("flightMs", () => {

    it("takes 450 ms for a short way and grows with the distance", () => {
        expect(flightMs(0)).toBe(450);
        expect(flightMs(100)).toBe(450);
        expect(flightMs(170)).toBeCloseTo(499);
        expect(flightMs(400)).toBeGreaterThan(flightMs(300));
    });


    it("takes at most 750 ms, however far", () => {
        expect(flightMs(550)).toBe(750);
        expect(flightMs(5000)).toBe(750);
    });

});


describe("releaseAt", () => {

    const flight = fly("50", hand, ours);
    const glow = pulse(ours, "Good");
    const hold: Step = { kind: "Hold", card: "Stop", at: theirs, tone: "Bad", ms: 10000 };


    it("lets a flight leave when the one before it is 70% through", () => {
        expect(releaseAt(flight, flight)).toBe(0.7);
    });


    it("lets a flight leave when a pulse is 60% through", () => {
        expect(releaseAt(glow, flight)).toBe(0.6);
    });


    it("starts a pulse, a hold or a pause only when the step before has ended", () => {
        expect(releaseAt(flight, glow)).toBe(1);
        expect(releaseAt(glow, glow)).toBe(1);
        expect(releaseAt(flight, hold)).toBe(1);
        expect(releaseAt(pause, flight)).toBe(1);
        expect(releaseAt(flight, pause)).toBe(1);
    });

});
