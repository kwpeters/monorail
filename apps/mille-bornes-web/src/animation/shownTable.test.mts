import { Card } from "@repo/mille-bornes-core/card";
import { zoneMiles } from "@repo/mille-bornes-core/drivingZone";
import type { PlayerView } from "@repo/mille-bornes-core/view";
import { describe, expect, it } from "vitest";
import type { EventBatch } from "../state/screenStore.mjs";
import { annPlays, bobDrivesToAnn, midRace, viewOf } from "../testing/engineBatches.mjs";
import { team, withPhase } from "../testing/viewFixtures.mjs";
import {
    arrive, drawnSlots, land, reveal, revealStep, shownTable, snapAll, startBatch, stillDrawing,
    type ShownTable
} from "./shownTable.mjs";
import { stepsForBatch, type Step } from "./steps.mjs";


// Real engine screens: Ann drives 50 (her play, Bob's turn and his draw),
// then Bob drives 75 (his play, Ann's turn and her draw of a Spare Tire).
const start = viewOf(midRace, "Ann");
const drove = annPlays({ type: "Drive", card: "50" });
const bob = bobDrivesToAnn;
const b1: EventBatch = { id: 1, events: drove.events };
const b2: EventBatch = { id: 2, events: bob.events };
const [bobFlies, annDraws] = stepsForBatch(bob.events, bob.view) as [Step, Step];


function milesOf(view: PlayerView): ReadonlyArray<number> {
    return view.teams.map((t) => zoneMiles(t.zone));
}


// Bob's batch arrives on the table that shows Ann's drive, and starts.
function bobPlaying(): ShownTable {
    const t = arrive(shownTable(bob.before, []), [b2], bob.view, false);
    return startBatch(t, 2);
}


describe("shownTable", () => {

    it("shows the live view, waiting for no batch already pending", () => {
        const t = shownTable(start, [b1]);
        expect(t.view).toBe(start);
        expect(arrive(t, [b1], start, false).view).toBe(start);
    });


    describe("arrive", () => {

        it("keeps the table from before a new batch", () => {
            const t = arrive(shownTable(start, []), [b1], drove.view, false);
            expect(t.view).toBe(start);
            expect(t.live).toBe(drove.view);
        });


        it("keeps the first batch's table while a second one queues", () => {
            let t = arrive(shownTable(start, []), [b1], drove.view, false);
            t = arrive(t, [b1, b2], bob.view, false);
            expect(t.view).toBe(start);
            expect(land(t, 1).view).toBe(drove.view);
            expect(land(land(t, 1), 2).view).toBe(bob.view);
        });


        it("follows a screen that brings no batch while nothing is waiting", () => {
            const t = arrive(shownTable(start, []), [], drove.view, false);
            expect(t.view).toBe(drove.view);
        });


        it("shows the live view when the store drops a batch that has not landed", () => {
            const queued = arrive(shownTable(start, []), [b1], drove.view, false);
            const t = arrive(queued, [], drove.view, false);
            expect(t.view).toBe(drove.view);
            expect(t.queue).toEqual([]);
        });


        it("does not wait for a batch that landed when the store drops it", () => {
            let t = arrive(shownTable(start, []), [b1], drove.view, false);
            t = arrive(t, [b1, b2], bob.view, false);
            t = arrive(land(t, 1), [b2], bob.view, false);
            expect(t.view).toBe(drove.view);
            expect(t.queue.map((a) => a.id)).toEqual([2]);
        });


        it("does not queue a batch again once it was seen", () => {
            let t = arrive(shownTable(start, []), [b1], drove.view, false);
            t = land(t, 1);
            t = arrive(t, [{ ...b1 }], drove.view, false);
            expect(t.queue).toEqual([]);
        });


        it("shows the live view under reduced motion", () => {
            const t = arrive(shownTable(start, []), [b1], drove.view, true);
            expect(t.view).toBe(drove.view);
            expect(t.queue).toEqual([]);
        });


        it("shows a new race, and the end of one, at once", () => {
            const nextRace: PlayerView = { ...drove.view, raceNumber: start.raceNumber + 1 };
            expect(arrive(shownTable(start, []), [b1], nextRace, false).view).toBe(nextRace);
            const result = {
                outcome: {
                    kind: "TripCompleted", team: team(0), delayedAction: false, extensionCaller: null
                },
                scores: []
            } as const;
            const over = withPhase(drove.view, { kind: "RaceOver", result });
            expect(arrive(shownTable(start, []), [b1], over, false).view).toBe(over);
        });

    });


    describe("revealStep", () => {

        it("shows a lane when its card lands, and the turn when the batch lands", () => {
            let t = revealStep(bobPlaying(), bobFlies);
            expect(milesOf(t.view)).toEqual(milesOf(bob.view));
            expect(t.view.drawPileCount).toBe(bob.before.drawPileCount);
            expect(t.view.phase).toEqual(bob.before.phase);
            t = revealStep(t, annDraws);
            expect(t.view.drawPileCount).toBe(bob.view.drawPileCount);
            expect(t.view.phase).toEqual(bob.before.phase);
            expect(land(t, 2).view).toBe(bob.view);
        });


        it("stops hiding the viewer's drawn card when it lands", () => {
            const t = bobPlaying();
            expect(stillDrawing(t)).toEqual([Card.spareTire]);
            expect(stillDrawing(revealStep(t, bobFlies))).toEqual([Card.spareTire]);
            expect(stillDrawing(revealStep(t, annDraws))).toEqual([]);
            expect(stillDrawing(land(t, 2))).toEqual([]);
            expect(stillDrawing(snapAll(t))).toEqual([]);
        });


        it("changes nothing for a batch that is not playing", () => {
            const t = arrive(shownTable(bob.before, []), [b2], bob.view, false);
            expect(revealStep(t, bobFlies)).toBe(t);
            expect(revealStep(land(startBatch(t, 2), 2), bobFlies).view).toBe(bob.view);
        });

    });


    describe("reveal", () => {

        it("shows the discard pile's top when a card lands on it", () => {
            const discarded = annPlays({ type: "Discard", card: "25" });
            const [toPile] = stepsForBatch(discarded.events, discarded.view);
            const shown = reveal(start, discarded.view, toPile!);
            expect(shown.discardTop).toBe(discarded.view.discardTop);
            expect(shown.teams).toEqual(start.teams);
        });


        it("shows a lane when a pulse starts on it, and nothing for a hold", () => {
            const bobs = { kind: "Team", team: team(1) } as const;
            const pulse: Step = { kind: "Pulse", target: bobs, tone: "Good", big: false, ms: 450 };
            expect(milesOf(reveal(bob.before, bob.view, pulse))).toEqual(milesOf(bob.view));
            const hold: Step = { kind: "Hold", card: "Stop", at: bobs, tone: "Bad", ms: 1 };
            expect(reveal(bob.before, bob.view, hold)).toBe(bob.before);
        });

    });


    describe("drawnSlots", () => {

        it("finds a drawn card at the last place that holds it", () => {
            expect([...drawnSlots(["25", "Stop", "25"], ["25"])]).toEqual([2]);
            expect([...drawnSlots(["25", "Stop", "25"], ["25", "25"])]).toEqual([2, 0]);
            expect([...drawnSlots(["Roll", "Stop"], ["Stop", "Roll"])]).toEqual([0, 1]);
        });


        it("finds nothing for a card that is not in the hand", () => {
            expect(drawnSlots(["25"], ["Stop"]).size).toBe(0);
            expect(drawnSlots(["25"], []).size).toBe(0);
        });

    });

});
