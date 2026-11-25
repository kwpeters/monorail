import { Option } from "@repo/depot/option";
import { type Clock } from "./clock.mjs";


interface FakeTimer {
    readonly id:  number;
    readonly due: number;
    readonly fn:  () => void;
}


/** A manually advanced clock for tests.  Starts at time 0. */
export class FakeClock implements Clock {
    private _now = 0;
    private _nextId = 0;
    private _timers: Array<FakeTimer> = [];


    /** @returns The fake current time in milliseconds. */
    public now(): number {
        return this._now;
    }


    /**
     * Schedules a function to run once after a delay.
     * @param fn - The function to run
     * @param ms - The delay in milliseconds
     * @returns A function that cancels the timer
     */
    public setTimeout(fn: () => void, ms: number): () => void {
        const timer: FakeTimer = { id: this._nextId++, due: this._now + ms, fn };
        this._timers.push(timer);
        return () => {
            this._timers = this._timers.filter((t) => t !== timer);
        };
    }


    /**
     * Moves time forward, running every timer that comes due in time order
     * (ties in scheduling order), including timers scheduled by a running
     * timer that also come due within the window.
     * @param ms - The number of milliseconds to advance
     */
    public advance(ms: number): void {
        const target = this._now + ms;
        for (;;) {
            const found = Option.fromNullable(this._timers
            .filter((t) => t.due <= target)
            .sort((a, b) => a.due - b.due || a.id - b.id)[0]);
            if (found.isNone) {
                break;
            }
            const next = found.value;
            this._timers = this._timers.filter((t) => t !== next);
            this._now = Math.max(this._now, next.due);
            next.fn();
        }
        this._now = target;
    }


    /** @returns The number of timers that have not fired or been cancelled. */
    public pendingCount(): number {
        return this._timers.length;
    }
}
