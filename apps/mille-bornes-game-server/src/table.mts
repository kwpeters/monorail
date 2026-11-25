import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import {
    type Applied, type PlayerCommand, type SystemCommand
} from "@repo/mille-bornes-core/commands";
import { shuffleDeck } from "@repo/mille-bornes-core/deck";
import { deciders, robotMoves } from "@repo/mille-bornes-core/driver";
import { applyPlayerCommand, applySystemCommand } from "@repo/mille-bornes-core/engine";
import { type GameEvent } from "@repo/mille-bornes-core/events";
import { type Game } from "@repo/mille-bornes-core/game";
import { type PlayerId } from "@repo/mille-bornes-core/ids";
import { describeRejection, type Rejection } from "@repo/mille-bornes-core/rejection";
import { variantForSeatCount } from "@repo/mille-bornes-core/variant";
import { type Clock } from "./clock.mjs";
import { type Timings } from "./config.mjs";
import { type Logger } from "./logger.mjs";


/** An accepted change to a running game. */
export interface TableUpdate {
    readonly game:   Game;
    /** One more than the previous update's (or the starting) `seq`. */
    readonly seq:    number;
    /** Unredacted: the Hub redacts them with `broadcast()`. */
    readonly events: ReadonlyArray<GameEvent>;
}


/** What a Table's timer is for. */
export type TimerKind = "HazardWindow" | "ExtensionOffer" | "NextRace" | "Robot";


/** A countdown the players can see. */
export interface VisibleTimer {
    readonly kind:        Exclude<TimerKind, "Robot">;
    readonly remainingMs: number;
}


/** What a Table needs. */
export interface TableOptions {
    /** The game to run (new, or restored from a snapshot). */
    readonly game:         Game;
    /** The sequence number of `game`; the first update gets `seq + 1`. */
    readonly seq:          number;
    readonly clock:        Clock;
    /** Returns a number in [0, 1); robot delays, robot choices and decks. */
    readonly rand:         () => number;
    readonly timings:      Timings;
    readonly logger:       Logger;
    /**
     * Called after every accepted change, once the new phase's timers are
     * scheduled.  It may call `submit()` or `dispose()`; a nested update is
     * delivered before this call returns.  An exception is logged and ignored.
     */
    readonly onUpdate:     (u: TableUpdate) => void;
    /** The stuck guard fired; the Table has already disposed itself. */
    readonly onStuck:      (reason: string) => void;
    /**
     * Test hook: replaces core's `applySystemCommand()`, so a test can make
     * the engine fail a timer's command.
     */
    readonly applySystem?: (g: Game, cmd: SystemCommand) => Result<Applied, Rejection>;
}


interface Scheduled {
    readonly kind:   TimerKind;
    readonly due:    number;
    readonly cancel: () => void;
}


/**
 * Runs one game: applies players' commands and derives every timer and robot
 * move from `game.phase`.  Every accepted change cancels all timers and
 * schedules the new phase's, so no timer survives a change.
 */
export class Table {
    private readonly _opts:        TableOptions;
    private readonly _applySystem: NonNullable<TableOptions["applySystem"]>;
    private _game:                 Game;
    private _seq:                  number;
    private _timers:               Array<Scheduled> = [];
    private _started = false;
    private _disposed = false;


    /**
     * Creates a table; nothing is scheduled until `start()`.
     * @param opts - The game, its seq and the table's dependencies
     */
    public constructor(opts: TableOptions) {
        this._opts = opts;
        this._applySystem = opts.applySystem ?? applySystemCommand;
        this._game = opts.game;
        this._seq = opts.seq;
    }


    /** @returns The current game. */
    public get game(): Game {
        return this._game;
    }


    /** @returns The sequence number of the current game. */
    public get seq(): number {
        return this._seq;
    }


    /**
     * Gets the countdown the players can see.
     * @returns The hazard window, Extension offer or pause after a race and
     * the milliseconds left, or null when none is running (a robot's delay is
     * never reported)
     */
    public timer(): VisibleTimer | null {
        for (const { kind, due } of this._timers) {
            if (kind !== "Robot") {
                return { kind, remainingMs: Math.max(0, due - this._opts.clock.now()) };
            }
        }
        return null;
    }


    /**
     * Schedules what the phase needs.  Call once after construction (also
     * after a restore, which restarts the phase's timers from zero); later
     * calls do nothing, so a running window is never restarted.
     */
    public start(): void {
        if (this._started || this._disposed) {
            return;
        }
        this._started = true;
        this.schedule();
    }


    /**
     * Applies a player's command.  A refused command changes nothing and
     * never fires the stuck guard.
     * @param by - The player issuing the command
     * @param cmd - The command (untrusted)
     * @returns Success, or a plain-English reason the command was refused
     */
    public submit(by: PlayerId, cmd: PlayerCommand): Result<void, string> {
        if (this._disposed) {
            return new FailedResult("This game has ended.");
        }
        let applied: Result<Applied, Rejection>;
        try {
            applied = applyPlayerCommand(this._game, by, cmd);
        }
        catch (err) {
            this._opts.logger.error(`A command from ${by} threw: ${String(err)}`);
            return new FailedResult("That command could not be played.");
        }
        if (applied.failed) {
            return new FailedResult(describeRejection(applied.error));
        }
        this.commit(applied.value);
        return new SucceededResult(undefined);
    }


    /** Cancels every timer; later calls to any method do nothing. */
    public dispose(): void {
        this._disposed = true;
        this.cancelAll();
    }


    // The one way the game changes.  Timers are scheduled before onUpdate so
    // that a dispose() or submit() made from onUpdate has the last word.
    private commit(applied: Applied): void {
        this._game = applied.game;
        this._seq += 1;
        this.cancelAll();
        this.schedule();
        try {
            this._opts.onUpdate({ game: this._game, seq: this._seq, events: applied.events });
        }
        catch (err) {
            this._opts.logger.error(`onUpdate threw at seq ${this._seq}: ${String(err)}`);
        }
    }


    private cancelAll(): void {
        this._timers.forEach((t) => t.cancel());
        this._timers = [];
    }


    private schedule(): void {
        const { timings } = this._opts;
        const g = this._game;
        switch (g.phase.kind) {
            case "HazardIncoming":
                // The window always runs in full, so its length reveals nothing.
                this.after("HazardWindow", timings.hazardWindowMs, () => {
                    return this.system(g, { type: "CloseHazardWindow" });
                });
                for (const move of robotMoves(g, this._opts.rand)) {
                    this.after("Robot", 0, () => this.player(g, move.by, move.cmd));
                }
                break;
            case "ExtensionOffer":
                this.after("ExtensionOffer", timings.extensionOfferMs, () => {
                    return this.system(g, { type: "CloseExtensionOffer" });
                });
                this.robotTurn(g);
                break;
            case "Turn":
                this.robotTurn(g);
                break;
            case "RaceOver":
                this.after("NextRace", timings.raceOverPauseMs, () => {
                    return variantForSeatCount(g.players.length)
                    .mapError(describeRejection)
                    .bind((v) => this.system(g, {
                        type: "StartNextRace",
                        deck: shuffleDeck(v.deck, this._opts.rand),
                    }));
                });
                break;
            case "GameOver":
                break;
        }
    }


    // The robot deciding the turn or Extension offer, if any, plays after a
    // random delay.
    private robotTurn(g: Game): void {
        const robot = deciders(g).find((p) => p.seat.kind === "Robot");
        if (robot === undefined) {
            return;
        }
        this.after("Robot", this.robotDelay(), () => {
            const move = robotMoves(g, this._opts.rand)[0];
            return move ?
                this.player(g, move.by, move.cmd) :
                new FailedResult(`The robot ${robot.seat.name} has no move (${g.phase.kind}).`);
        });
    }


    // A whole number of ms from robotDelayMinMs to robotDelayMaxMs, each
    // equally likely.  A rand() of NaN or below 0 gives the minimum and 1 or
    // more the maximum.
    private robotDelay(): number {
        const { robotDelayMinMs: min, robotDelayMaxMs: max } = this._opts.timings;
        const span = max - min;
        const r = this._opts.rand();
        return min + (r >= 0 ? Math.min(span, Math.floor(r * (span + 1))) : 0);
    }


    private system(g: Game, cmd: SystemCommand): Result<Applied, string> {
        return this._applySystem(g, cmd).mapError(describeRejection);
    }


    private player(g: Game, by: PlayerId, cmd: PlayerCommand): Result<Applied, string> {
        return applyPlayerCommand(g, by, cmd).mapError(describeRejection);
    }


    // Schedules `run`; what it returns is committed, and a failure or an
    // exception fires the stuck guard.  Nothing escapes into the clock.
    private after(kind: TimerKind, ms: number, run: () => Result<Applied, string>): void {
        const fire = (): void => {
            if (this._disposed) {
                return;
            }
            try {
                const outcome = run();
                if (outcome.failed) {
                    this.stuck(`${kind} timer: ${outcome.error}`);
                    return;
                }
                this.commit(outcome.value);
            }
            catch (err) {
                this.stuck(`${kind} timer threw: ${String(err)}`);
            }
        };
        const due = this._opts.clock.now() + ms;
        this._timers.push({ kind, due, cancel: this._opts.clock.setTimeout(fire, ms) });
    }


    private stuck(reason: string): void {
        this._opts.logger.error(`Game ${this._game.config.id} is stuck: ${reason}`);
        this.dispose();
        try {
            this._opts.onStuck(reason);
        }
        catch (err) {
            this._opts.logger.error(`onStuck threw: ${String(err)}`);
        }
    }
}
