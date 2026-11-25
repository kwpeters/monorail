import { type Seat } from "./game.mjs";
import { GameId, PlayerId, type TeamIndex } from "./ids.mjs";
import { applyPendingCommand, createPending, type PendingGame } from "./pendingGame.mjs";
import { pendingSummary, pendingViewFor } from "./pendingView.mjs";
import { seatFor } from "./testHelpers.mjs";


const gameId = GameId.tryCreate("00000000-0000-4000-8000-0000000000aa").throwIfFailed();
const [a, b, c, d, e, f, g] = ["Ann", "Bob", "Cy", "Di", "Ed", "Flo", "Gus"].map((n) => seatFor(n)) as
    [Seat, Seat, Seat, Seat, Seat, Seat, Seat];
const robo = seatFor("Robo", "Robot");
const outsider = PlayerId.create();


// The organizer plus the given seats, added in order (robots by the organizer).
function build(...others: ReadonlyArray<Seat>): PendingGame {
    return others.reduce((p, seat) => {
        const by = seat.kind === "Robot" ? p.organizer : seat.id;
        return applyPendingCommand(p, by, { type: seat.kind === "Robot" ? "AddRobot" : "AddHuman", seat })
        .throwIfFailed();
    }, createPending(gameId, a));
}


describe("pendingView", () => {

    describe("pendingViewFor()", () => {

        it("hides every seat kind from a viewer who is not the organizer", () => {
            const view = pendingViewFor(build(b, robo), b.id);
            expect(view.seats.map((s) => s.kind)).toEqual([null, null, null]);
            expect(JSON.stringify(view)).not.toContain("Robot");
            expect(JSON.stringify(view)).not.toContain("Human");
        });


        it("shows every seat kind to the organizer and marks their own seat", () => {
            const view = pendingViewFor(build(b, robo), a.id);
            expect(view.isOrganizer).toBeTrue();
            expect(view.seats.map((s) => s.kind)).toEqual(["Human", "Human", "Robot"]);
            expect(view.seats.map((s) => s.isOrganizer)).toEqual([true, false, false]);
        });


        it("tells a non-organizer they are not the organizer and marks their own seat", () => {
            const view = pendingViewFor(build(b), b.id);
            expect(view.isOrganizer).toBeFalse();
            expect(view.seats.map((s) => s.isMe)).toEqual([false, true]);
        });


        it("carries the game id, the length and the seats in order", () => {
            const view = pendingViewFor(build(b), a.id);
            expect(view.id).toBe(gameId);
            expect(view.length).toBe("Quick");
            expect(view.seats.map((s) => [s.id, s.name])).toEqual([[a.id, a.name], [b.id, b.name]]);
        });


        it("gives a viewer with no seat isMe false everywhere", () => {
            const view = pendingViewFor(build(b), outsider);
            expect(view.isOrganizer).toBeFalse();
            expect(view.seats.every((s) => !s.isMe)).toBeTrue();
        });


        it("allows Start for 2 seats", () => {
            expect(pendingViewFor(build(b), a.id).start).toEqual({ ok: true });
        });


        it("refuses Start with 'add a robot' advice for 1 or 5 seats", () => {
            for (const p of [build(), build(b, c, d, e)]) {
                const { start } = pendingViewFor(p, a.id);
                expect(start.ok).toBeFalse();
                expect(start.ok ? "" : start.reason).toContain("add a robot");
            }
        });


        it("refuses Start with 'remove someone' advice for 7 seats", () => {
            const p: PendingGame = { ...build(b, c, d, e, f), seats: [a, b, c, d, e, f, g] };
            const { start } = pendingViewFor(p, a.id);
            expect(start.ok).toBeFalse();
            expect(start.ok ? "" : start.reason).toContain("remove someone");
        });


        it("assigns teams by seat order for 4 seats", () => {
            const view = pendingViewFor(build(b, c, d), a.id);
            expect(view.seats.map((s) => s.team)).toEqual([0, 1, 0, 1] as Array<TeamIndex | null>);
        });


        it("leaves teams null when the seat count has no variant", () => {
            const view = pendingViewFor(build(b, c, d, e), a.id);
            expect(view.seats.map((s) => s.team)).toEqual([null, null, null, null, null]);
        });

    });


    describe("pendingSummary()", () => {

        it("lists names in seat order, robots included, and names the organizer", () => {
            const summary = pendingSummary(build(robo, b));
            expect(summary.id).toBe(gameId);
            expect(summary.length).toBe("Quick");
            expect(summary.organizerName).toBe(a.name);
            expect(summary.seatNames).toEqual([a.name, robo.name, b.name]);
        });


        it("is full at 6 seats and not before", () => {
            expect(pendingSummary(build(b, c, d, e)).isFull).toBeFalse();
            expect(pendingSummary(build(b, c, d, e, f)).isFull).toBeTrue();
        });


        it("never carries a seat kind", () => {
            expect(JSON.stringify(pendingSummary(build(robo)))).not.toMatch(/Robot|Human|kind/u);
        });

    });

});
