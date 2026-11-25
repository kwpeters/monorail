import { FakeClock } from "./fakeClock.mjs";
import { collectingLogger } from "./logger.mjs";
import { createShutdown } from "./shutdown.mjs";


interface Harness {
    clock:    FakeClock;
    logger:   ReturnType<typeof collectingLogger>;
    exits:    Array<number>;
    shutdown: () => Promise<void>;
}


function harness(close: () => Promise<void>): Harness {
    const clock = new FakeClock();
    const logger = collectingLogger();
    const exits: Array<number> = [];
    const shutdown = createShutdown({
        close, exit: (code) => { exits.push(code); }, clock, logger, forceExitMs: 5000
    });
    return { clock, logger, exits, shutdown };
}


describe("shutdown", () => {

    describe("createShutdown()", () => {

        it("exits 0 after a clean close and clears the force-exit timer", async () => {
            const h = harness(async () => Promise.resolve());
            await h.shutdown();
            expect(h.exits).toEqual([0]);
            expect(h.clock.pendingCount()).toBe(0);
            h.clock.advance(10000);
            expect(h.exits).toEqual([0]);
        });


        it("exits 1 and logs the message when close throws", async () => {
            const h = harness(async () => Promise.reject(new Error("disk full")));
            await h.shutdown();
            expect(h.exits).toEqual([1]);
            expect(h.logger.lines).toContain("ERROR Shutdown failed: disk full");
            expect(h.clock.pendingCount()).toBe(0);
        });


        it("force-exits with 1, once, when close hangs", async () => {
            let finish: () => void = () => { /* replaced below */ };
            const h = harness(async () => new Promise<void>((resolve) => { finish = resolve; }));
            const pending = h.shutdown();
            h.clock.advance(4999);
            expect(h.exits).toEqual([]);
            h.clock.advance(1);
            expect(h.exits).toEqual([1]);
            expect(h.logger.lines).toContain("ERROR Shutdown took too long; exiting now.");

            // A close that finally finishes must not exit a second time.
            finish();
            await pending;
            expect(h.exits).toEqual([1]);
        });


        it("ignores a second call while stopping", async () => {
            let closes = 0;
            let finish: () => void = () => { /* replaced below */ };
            const h = harness(async () => new Promise<void>((resolve) => {
                closes += 1;
                finish = resolve;
            }));
            const first = h.shutdown();
            await h.shutdown();
            expect(closes).toBe(1);
            finish();
            await first;
            await h.shutdown();
            expect(closes).toBe(1);
            expect(h.exits).toEqual([0]);
        });

    });

});
