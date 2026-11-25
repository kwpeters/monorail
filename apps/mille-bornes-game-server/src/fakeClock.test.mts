import { FakeClock } from "./fakeClock.mjs";


describe("FakeClock", () => {

    describe("instance", () => {

        describe("now()", () => {

            it("starts at 0 and equals the advanced total", () => {
                const clock = new FakeClock();
                expect(clock.now()).toBe(0);
                clock.advance(100);
                clock.advance(50);
                expect(clock.now()).toBe(150);
            });

        });


        describe("setTimeout()", () => {

            it("fires timers in time order", () => {
                const clock = new FakeClock();
                const fired: Array<string> = [];
                clock.setTimeout(() => fired.push("b"), 20);
                clock.setTimeout(() => fired.push("a"), 10);
                clock.setTimeout(() => fired.push("c"), 30);
                clock.advance(30);
                expect(fired).toEqual(["a", "b", "c"]);
            });


            it("does not fire a timer that is not yet due", () => {
                const clock = new FakeClock();
                let count = 0;
                clock.setTimeout(() => count++, 10);
                clock.advance(9);
                expect(count).toBe(0);
                expect(clock.pendingCount()).toBe(1);
            });


            it("runs a +0 timer scheduled by a firing timer in the same advance", () => {
                const clock = new FakeClock();
                const fired: Array<string> = [];
                clock.setTimeout(() => {
                    fired.push("outer");
                    clock.setTimeout(() => fired.push("inner"), 0);
                }, 10);
                clock.advance(10);
                expect(fired).toEqual(["outer", "inner"]);
            });


            it("reports the due time as now() while a timer runs", () => {
                const clock = new FakeClock();
                let seen = -1;
                clock.setTimeout(() => { seen = clock.now(); }, 10);
                clock.advance(100);
                expect(seen).toBe(10);
                expect(clock.now()).toBe(100);
            });


            it("never fires a cancelled timer", () => {
                const clock = new FakeClock();
                let count = 0;
                const cancel = clock.setTimeout(() => count++, 10);
                cancel();
                clock.advance(100);
                expect(count).toBe(0);
                expect(clock.pendingCount()).toBe(0);
            });


            it("fires each timer exactly once when advancing past several", () => {
                const clock = new FakeClock();
                const counts = [0, 0, 0];
                clock.setTimeout(() => counts[0]!++, 5);
                clock.setTimeout(() => counts[1]!++, 10);
                clock.setTimeout(() => counts[2]!++, 15);
                clock.advance(1000);
                clock.advance(1000);
                expect(counts).toEqual([1, 1, 1]);
            });

        });


        describe("pendingCount()", () => {

            it("counts timers that have neither fired nor been cancelled", () => {
                const clock = new FakeClock();
                clock.setTimeout(() => undefined, 10);
                const cancel = clock.setTimeout(() => undefined, 20);
                clock.setTimeout(() => undefined, 30);
                expect(clock.pendingCount()).toBe(3);
                cancel();
                clock.advance(10);
                expect(clock.pendingCount()).toBe(1);
            });

        });

    });

});
