import { createDebouncer } from "./debounce.mjs";


describe("createDebouncer()", () => {

    beforeEach(() => {
        jasmine.clock().install();
    });


    afterEach(() => {
        jasmine.clock().uninstall();
    });


    it("runs the action once after the quiet period elapses", () => {
        let calls = 0;
        const debouncer = createDebouncer(500, () => { calls++; });

        debouncer.schedule();
        jasmine.clock().tick(499);
        expect(calls).toBe(0);

        jasmine.clock().tick(1);
        expect(calls).toBe(1);
    });


    it("coalesces a burst of schedules into a single invocation", () => {
        let calls = 0;
        const debouncer = createDebouncer(500, () => { calls++; });

        debouncer.schedule();
        jasmine.clock().tick(300);
        debouncer.schedule();
        jasmine.clock().tick(300);
        debouncer.schedule();

        // 600 ms of wall time has passed, but never 500 ms of quiet.
        jasmine.clock().tick(499);
        expect(calls).toBe(0);

        jasmine.clock().tick(1);
        expect(calls).toBe(1);
    });


    it("does not run the action when cancelled before firing", () => {
        let calls = 0;
        const debouncer = createDebouncer(500, () => { calls++; });

        debouncer.schedule();
        debouncer.cancel();
        jasmine.clock().tick(1000);

        expect(calls).toBe(0);
    });


    it("can be scheduled again after it has fired", () => {
        let calls = 0;
        const debouncer = createDebouncer(500, () => { calls++; });

        debouncer.schedule();
        jasmine.clock().tick(500);
        expect(calls).toBe(1);

        debouncer.schedule();
        jasmine.clock().tick(500);
        expect(calls).toBe(2);
    });


    it("tolerates cancel() when nothing is scheduled", () => {
        const debouncer = createDebouncer(500, () => { /* no-op */ });

        expect(() => { debouncer.cancel(); }).not.toThrow();
    });

});
