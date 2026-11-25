import { PlayerId } from "@repo/mille-bornes-core/ids";
import { FakeClock } from "./fakeClock.mjs";
import { Presence } from "./presence.mjs";


interface Harness {
    readonly presence: Presence;
    readonly clock:    FakeClock;
    readonly changes:  Array<PlayerId>;
}


function harness(): Harness {
    const clock = new FakeClock();
    const changes: Array<PlayerId> = [];
    const presence = new Presence(clock, 3000, (p) => { changes.push(p); });
    return { presence, clock, changes };
}


const ann = PlayerId.create();


describe("Presence", () => {

    describe("instance", () => {

        describe("open()", () => {

            it("connects the player and reports the first open only", () => {
                const h = harness();

                h.presence.open(ann);
                h.presence.open(ann);

                expect(h.presence.isConnected(ann)).toBeTrue();
                expect(h.changes).toEqual([ann]);
            });


            it("cancels a pending disconnect without reporting a change", () => {
                const h = harness();
                h.presence.open(ann);
                h.presence.close(ann);
                h.clock.advance(2999);

                h.presence.open(ann);
                h.clock.advance(10000);

                expect(h.presence.isConnected(ann)).toBeTrue();
                expect(h.changes).toEqual([ann]);
                expect(h.clock.pendingCount()).toBe(0);
            });

        });


        describe("close()", () => {

            it("disconnects only after the grace period once the last one closes", () => {
                const h = harness();
                h.presence.open(ann);
                h.presence.open(ann);

                h.presence.close(ann);
                h.clock.advance(5000);
                expect(h.presence.isConnected(ann)).toBeTrue();
                h.presence.close(ann);
                h.clock.advance(2999);
                expect(h.presence.isConnected(ann)).toBeTrue();
                h.clock.advance(1);

                expect(h.presence.isConnected(ann)).toBeFalse();
                expect(h.changes).toEqual([ann, ann]);
            });


            it("ignores a close with nothing open", () => {
                const h = harness();

                h.presence.close(ann);

                expect(h.clock.pendingCount()).toBe(0);
                expect(h.changes).toEqual([]);
            });

        });


        describe("dispose()", () => {

            it("cancels pending disconnects and ignores later calls", () => {
                const h = harness();
                h.presence.open(ann);
                h.presence.close(ann);

                h.presence.dispose();
                h.presence.open(ann);
                h.presence.close(ann);

                expect(h.clock.pendingCount()).toBe(0);
                expect(h.changes).toEqual([ann]);
            });

        });

    });

});
