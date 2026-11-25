import { EventEmitter, on } from "node:events";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { type PlayerCommand } from "@repo/mille-bornes-core/commands";
import { shuffleDeck } from "@repo/mille-bornes-core/deck";
import { type Seat } from "@repo/mille-bornes-core/game";
import { GameId, PlayerId } from "@repo/mille-bornes-core/ids";
import {
    applyPendingCommand, beginGame, createPending, type PendingCommand, type PendingGame
} from "@repo/mille-bornes-core/pendingGame";
import { pendingSummary } from "@repo/mille-bornes-core/pendingView";
import { describeRejection } from "@repo/mille-bornes-core/rejection";
import { type GameLength } from "@repo/mille-bornes-core/scoring";
import { variantForSeatCount } from "@repo/mille-bornes-core/variant";
import { pickWhimsicalName } from "@repo/mille-bornes-core/whimsicalNames";
import { type Clock } from "./clock.mjs";
import { type Timings } from "./config.mjs";
import { type Logger } from "./logger.mjs";
import { Presence } from "./presence.mjs";
import { recordGameId } from "./records.mjs";
import {
    humansOf, RunningGames, stuckNotice, type AdminEntry, type RunningGame
} from "./runningGames.mjs";
import { lobbyScreen, waitingScreen, type Screen } from "./screens.mjs";
import { type SessionRegistry } from "./sessions.mjs";
import { type LoadedSnapshots, type SnapshotStore } from "./snapshotStore.mjs";
import { Table, type TableOptions } from "./table.mjs";


/** What a `Hub` needs. */
export interface HubOptions {
    store:         SnapshotStore;
    sessions:      SessionRegistry;
    clock:         Clock;
    /** Returns a number in [0, 1); robot names, decks and robot moves. */
    rand:          () => number;
    timings:       Timings;
    logger:        Logger;
    /**
     * Test hook: builds each game's Table (default `new Table(opts)`), so a
     * test can drive the stuck guard with a faulty one.
     */
    tableFactory?: (opts: TableOptions) => Table;
    /** The games already read with `store.loadAll()`; default: read them now. */
    saved?:        LoadedSnapshots["games"];
}


export { type AdminEntry } from "./runningGames.mjs";


const notInGame = "You are not in a game.";


function fail(message: string): Result<never, string> {
    return new FailedResult(message);
}


const ok = new SucceededResult<void>(undefined);


/**
 * Holds every game and decides what each player's screen shows.  A player is
 * in at most one game.  Every change is applied at once, shown to the players
 * it affects, and then saved.  If a save fails the change stays in memory, the
 * failure is logged, and the method still succeeds, because the change has
 * happened.  The next change to that game saves its whole state again, but a
 * failed `deleteGame` is not retried: the game is gone from memory and its
 * snapshot comes back after a restart.  No method throws.
 *
 * A one-time notice (for example "You were removed from the game.") is cleared
 * when a Lobby screen carrying it is yielded to a watcher, so a watch that
 * ends first leaves it for the next `watch()`.  With several watches of one
 * player only the first to read it shows it.  `screenFor()` shows a notice
 * but never clears it.
 *
 * A started game runs on a `Table` (see `RunningGames`).  A player counts as
 * connected while a watch is open, and for `disconnectGraceMs` after the last
 * one closes; the others in a running game see each change.
 */
export class Hub {

    /**
     * Opens a hub holding the games saved earlier.  Saved games have no
     * creation time, so pending games are listed in `GameId` order: arbitrary,
     * but the same after every restart.  Each running game's timers restart in
     * full; one that cannot be restored is quarantined.
     * @param opts - What the hub needs
     * @returns The hub
     */
    public static async open(opts: HubOptions): Promise<Hub> {
        const games = opts.saved ?? (await opts.store.loadAll()).games;
        const records = games
        .map(({ record }) => record)
        .sort((a, b) => recordGameId(a).localeCompare(recordGameId(b)));
        const hub = new Hub(opts, records.flatMap((r) => r.state === "Pending" ? [r.pending] : []));
        for (const r of records) {
            if (r.state === "Running") {
                hub._running.restore(r);
            }
        }
        return hub;
    }


    // Insertion order is creation order.
    private readonly _pending = new Map<GameId, PendingGame>();
    private readonly _notices = new Map<PlayerId, string>();
    private readonly _emitter = new EventEmitter();
    private readonly _stop = new AbortController();
    private readonly _presence: Presence;
    private readonly _running:  RunningGames;
    private readonly _store:    SnapshotStore;
    private readonly _sessions: SessionRegistry;
    private readonly _rand:     () => number;
    private readonly _logger:   Logger;


    private constructor(opts: HubOptions, pending: ReadonlyArray<PendingGame>) {
        this._store = opts.store;
        this._sessions = opts.sessions;
        this._rand = opts.rand;
        this._logger = opts.logger;
        this._presence = new Presence(opts.clock, opts.timings.disconnectGraceMs, (p) => {
            this.presenceChanged(p);
        });
        this._running = new RunningGames({
            ...opts,
            tableFactory: opts.tableFactory ?? ((o): Table => new Table(o)),
            isConnected:  (p) => this._presence.isConnected(p),
            persist:      (write, id) => this.persist(write, id),
            publish:      (players, screens) => { this.publish(players, screens); },
            notify:       (p, notice) => { this._notices.set(p, notice); }
        });
        pending.forEach((p) => this._pending.set(p.id, p));
        // One listener per open watch, however many there are.
        this._emitter.setMaxListeners(0);
    }


    /**
     * Gets what a player's screen shows now.  Does not clear a notice.
     * @param player - The player
     * @returns The game if the player is in a running game, the waiting room
     * if they are seated in a pending one, otherwise the Lobby
     */
    public screenFor(player: PlayerId): Screen {
        return this.build(player);
    }


    /**
     * Follows a player's screen: the current one first, then each later one.
     * Ends quietly when `signal` aborts or the hub is disposed.  The current
     * screen is taken now, so no change after this call is missed.  The
     * player counts as connected from the first read until the watch ends.
     * @param player - The player
     * @param signal - Stops the watch
     * @returns The screens, in order
     */
    public watch(player: PlayerId, signal: AbortSignal): AsyncIterable<Screen> {
        const stop = AbortSignal.any([signal, this._stop.signal]);
        if (stop.aborted) {
            return (async function* () { /* nothing to show */ })();
        }
        // Listen before building the first screen; the iterator queues any
        // screen emitted until it is read.
        const later = on(this._emitter, player, { signal: stop });
        return this.stream(player, this.build(player), later, stop);
    }


    /**
     * Number of open watches for a player.  A test accessor.
     * @param player - The player
     * @returns The number of listeners
     */
    public watcherCount(player: PlayerId): number {
        return this._emitter.listenerCount(player);
    }


    /**
     * Starts a game with the player as organizer and first seat.
     * @param player - The organizer
     * @returns Success, or a plain-English reason
     */
    public async createGame(player: PlayerId): Promise<Result<void, string>> {
        const seated = this.seatFor(player);
        if (seated.failed) {
            return seated;
        }
        const game = createPending(GameId.create(), seated.value);
        this._pending.set(game.id, game);
        this._notices.delete(player);
        this.publish([player, ...this.lobbyWatchers()]);
        return this.save(game);
    }


    /**
     * Seats the player in an open game.
     * @param player - The joining player
     * @param gameId - The game
     * @returns Success, or a plain-English reason
     */
    public async join(player: PlayerId, gameId: GameId): Promise<Result<void, string>> {
        const seated = this.seatFor(player);
        if (seated.failed) {
            return seated;
        }
        const game = this._pending.get(gameId);
        if (!game) {
            return fail("That game is no longer open.");
        }
        return this.change(player, game, { type: "AddHuman", seat: seated.value }, () => {
            this._notices.delete(player);
        });
    }


    /**
     * Takes the player out of the game they are waiting in.
     * @param player - The player leaving; not the organizer
     * @returns Success, or a plain-English reason
     */
    public async leavePending(player: PlayerId): Promise<Result<void, string>> {
        return this.inGame(player, (game) => {
            return this.change(player, game, { type: "RemoveSeat", id: player });
        });
    }


    /**
     * Ends a game that has not started.
     * @param player - The organizer
     * @returns Success, or a plain-English reason
     */
    public async cancelPending(player: PlayerId): Promise<Result<void, string>> {
        return this.inGame(player, (game) => {
            if (game.organizer !== player) {
                return fail(describeRejection({ reason: "NotOrganizer" }));
            }
            const others = game.seats.map((s) => s.id).filter((id) => id !== player);
            return this.endPending(game, "The organizer cancelled the game.", others);
        });
    }


    /**
     * Adds a robot to the game.
     * @param player - The organizer
     * @returns Success, or a plain-English reason
     */
    public async addRobot(player: PlayerId): Promise<Result<void, string>> {
        return this.inGame(player, (game) => {
            const name = pickWhimsicalName(game.seats.map((s) => s.name), this._rand);
            if (name.failed) {
                return fail("There are no robot names left.");
            }
            const seat = { id: PlayerId.create(), name: name.value, kind: "Robot" } as const;
            return this.change(player, game, { type: "AddRobot", seat });
        });
    }


    /**
     * Takes a seat out of the game.
     * @param player - The organizer, or the player in that seat
     * @param seat - The seat's player id
     * @returns Success, or a plain-English reason
     */
    public async removeSeat(player: PlayerId, seat: PlayerId): Promise<Result<void, string>> {
        return this.inGame(player, (game) => {
            const removed = game.seats.find((s) => s.id === seat);
            return this.change(player, game, { type: "RemoveSeat", id: seat }, () => {
                if (removed?.kind === "Human" && seat !== player) {
                    this._notices.set(seat, "You were removed from the game.");
                }
            });
        });
    }


    /**
     * Swaps two seats.
     * @param player - The organizer
     * @param a - One seat's player id
     * @param b - The other seat's player id
     * @returns Success, or a plain-English reason
     */
    public async swapSeats(
        player: PlayerId,
        a:      PlayerId,
        b:      PlayerId
    ): Promise<Result<void, string>> {
        return this.inGame(player, (game) => {
            return this.change(player, game, { type: "SwapSeats", a, b });
        });
    }


    /**
     * Sets how long the game is.
     * @param player - The organizer
     * @param length - The length
     * @returns Success, or a plain-English reason
     */
    public async setLength(
        player: PlayerId,
        length: GameLength
    ): Promise<Result<void, string>> {
        return this.inGame(player, (game) => {
            return this.change(player, game, { type: "SetLength", length });
        });
    }


    /**
     * Starts the pending game: deals race 1 from a deck shuffled for the seat
     * count, and every seat's screen becomes Playing.
     * @param player - The organizer
     * @returns Success, or a plain-English reason
     */
    public async startGame(player: PlayerId): Promise<Result<void, string>> {
        return this.inGame(player, (pending) => {
            if (pending.organizer !== player) {
                return fail(describeRejection({ reason: "NotOrganizer" }));
            }
            const begun = variantForSeatCount(pending.seats.length)
            .bind((v) => beginGame(pending, player, shuffleDeck(v.deck, this._rand)));
            if (begun.failed) {
                return fail(describeRejection(begun.error));
            }
            const running = this._running.start(begun.value.game, player);
            if (running.failed) {
                return running;
            }
            this._pending.delete(pending.id);
            this.publish(this.lobbyWatchers());
            const saved = this._running.accepted(running.value, begun.value.events);
            // Showing the first screens may have tripped the stuck guard.
            return this._running.get(pending.id) === running.value ?
                saved :
                fail(stuckNotice);
        });
    }


    /**
     * Plays a move in the player's running game.
     * @param player - The player
     * @param cmd - The move (untrusted)
     * @returns Success, or a plain-English reason
     */
    public async play(player: PlayerId, cmd: PlayerCommand): Promise<Result<void, string>> {
        return this.inRunning(player, (r) => this._running.play(r, player, cmd));
    }


    /**
     * Ends the player's running game at any time; everyone else returns to
     * the Lobby with a notice.
     * @param player - The organizer
     * @returns Success, or a plain-English reason
     */
    public async endGame(player: PlayerId): Promise<Result<void, string>> {
        return this.inRunning(player, (r) => {
            if (r.organizer !== player) {
                return Promise.resolve(fail(describeRejection({ reason: "NotOrganizer" })));
            }
            return this._running.end(r, "The organizer ended the game.", humansOf(r), player);
        });
    }


    /**
     * Leaves a finished game.  The game is deleted once every human has left.
     * @param player - The player
     * @returns Success, or a plain-English reason
     */
    public async leaveFinished(player: PlayerId): Promise<Result<void, string>> {
        return this.inRunning(player, (r) => {
            return r.game.phase.kind === "GameOver" ?
                this._running.leave(r, player) :
                Promise.resolve(fail("The game is not over yet."));
        });
    }


    /**
     * Ends any game, pending or running, for the host page; every human in it
     * returns to the Lobby with a notice.
     * @param gameId - The game
     * @returns Success, or a plain-English reason
     */
    public async adminEnd(gameId: GameId): Promise<Result<void, string>> {
        const notice = "The game was ended on the host computer.";
        const running = this._running.get(gameId);
        if (running) {
            return this._running.end(running, notice);
        }
        const pending = this._pending.get(gameId);
        if (!pending) {
            return fail("There is no such game.");
        }
        const humans = pending.seats.filter((s) => s.kind === "Human").map((s) => s.id);
        return this.endPending(pending, notice, humans);
    }


    /**
     * Lists every game for the host page.
     * @returns The pending games (oldest first), then the running and finished
     * ones
     */
    public adminList(): ReadonlyArray<AdminEntry> {
        const pending = [...this._pending.values()].map((p): AdminEntry => {
            const { id, organizerName, seatNames } = pendingSummary(p);
            return { id, state: "Pending", organizerName, seatNames, phase: "Waiting" };
        });
        return [...pending, ...this._running.list()];
    }


    /**
     * Waits for every save queued so far.
     * @returns Resolves when they are done
     */
    public async flush(): Promise<void> {
        await this._store.flush();
    }


    /**
     * Ends every watch, stops every game's timers and forgets every game.
     * Nothing is deleted from the store.
     */
    public dispose(): void {
        this._stop.abort();
        this._presence.dispose();
        this._running.dispose();
        this._pending.clear();
        this._notices.clear();
    }


    // Where a player is: the id of their game, or null.  A player who left a
    // finished game is in none.
    private gameOf(player: PlayerId): GameId | null {
        for (const game of this._pending.values()) {
            if (game.seats.some((s) => s.id === player)) {
                return game.id;
            }
        }
        return this._running.of(player)?.game.config.id ?? null;
    }


    private seatFor(player: PlayerId): Result<Seat, string> {
        const name = this._sessions.nameOf(player);
        if (name === null) {
            return fail("You need to enter your name first.");
        }
        if (this.gameOf(player) !== null) {
            return fail("You are already in a game.");
        }
        return new SucceededResult({ id: player, name, kind: "Human" });
    }


    private inGame(
        player: PlayerId,
        act:    (game: PendingGame) => Promise<Result<void, string>> | Result<void, string>
    ): Promise<Result<void, string>> {
        const gameId = this.gameOf(player);
        const game = gameId === null ? undefined : this._pending.get(gameId);
        if (game) {
            return Promise.resolve(act(game));
        }
        return Promise.resolve(fail(gameId === null ? notInGame : "The game has already started."));
    }


    private inRunning(
        player: PlayerId,
        act:    (r: RunningGame) => Promise<Result<void, string>>
    ): Promise<Result<void, string>> {
        const r = this._running.of(player);
        if (r) {
            return act(r);
        }
        const why = this.gameOf(player) === null ? notInGame : "The game has not started yet.";
        return Promise.resolve(fail(why));
    }


    // Applies a command, shows the result to everyone affected, and saves.
    private change(
        player:    PlayerId,
        game:      PendingGame,
        command:   PendingCommand,
        onApplied: () => void = () => undefined
    ): Promise<Result<void, string>> {
        const applied = applyPendingCommand(game, player, command);
        if (applied.failed) {
            return Promise.resolve(fail(describeRejection(applied.error)));
        }
        this._pending.set(game.id, applied.value);
        onApplied();
        const seats = [...game.seats, ...applied.value.seats].map((s) => s.id);
        this.publish([...seats, ...this.lobbyWatchers()]);
        return this.save(applied.value);
    }


    // Removes a pending game, leaves `noticed` the notice, and deletes it.
    private endPending(
        game:    PendingGame,
        notice:  string,
        noticed: ReadonlyArray<PlayerId>
    ): Promise<Result<void, string>> {
        this._pending.delete(game.id);
        noticed.forEach((id) => this._notices.set(id, notice));
        this.publish([...game.seats.map((s) => s.id), ...this.lobbyWatchers()]);
        return this.persist(() => this._store.deleteGame(game.id), game.id);
    }


    private save(game: PendingGame): Promise<Result<void, string>> {
        return this.persist(
            () => this._store.saveGame(game.id, { format: 1, state: "Pending", pending: game }),
            game.id
        );
    }


    // The store call has been made before the first await, so saves go out in
    // the order the changes were made.  A failure is logged, not returned: the
    // change was applied and shown, so the player must not be told to retry.
    private async persist(write: () => Promise<void>, id: GameId): Promise<Result<void, string>> {
        try {
            await write();
        }
        catch (e) {
            const why = e instanceof Error ? e.message : String(e);
            this._logger.error(`Saving game ${id} failed: ${why}`);
        }
        return ok;
    }


    // Shows the organizer of the player's running game that the player
    // connected or disconnected; only the organizer's screen lists who is
    // connected.  Runs from a clock timer, so never throws.
    private presenceChanged(player: PlayerId): void {
        try {
            const r = this._running.of(player);
            if (r && r.organizer !== player && humansOf(r).includes(r.organizer)) {
                this.publish([r.organizer]);
            }
        }
        catch (e) {
            this._logger.error(`Showing presence of ${player} threw: ${String(e)}`);
        }
    }


    // Builds a player's screen.  A notice is shown but not cleared; see
    // `deliver()`.
    private build(player: PlayerId): Screen {
        const shown = this._running.screenFor(player);
        if (shown) {
            return shown;
        }
        const gameId = this.gameOf(player);
        const game = gameId === null ? undefined : this._pending.get(gameId);
        if (game) {
            return waitingScreen(game, player);
        }
        const notice = this._notices.get(player) ?? null;
        return lobbyScreen(this._pending.values(), notice);
    }


    // Watched players in the Lobby, whose game list changes with every
    // pending game.
    private lobbyWatchers(): Array<PlayerId> {
        // `events.on` also listens for "error", which is not a player.
        const watched = (this._emitter.eventNames() as Array<string>)
        .filter((name) => PlayerId.tryCreate(name).succeeded) as Array<PlayerId>;
        return watched.filter((p) => this.gameOf(p) === null);
    }


    // Sends each affected player's watchers their new screen: the one given in
    // `screens`, or else a freshly built one.  A player with no watcher is
    // skipped so that their notice is kept.
    private publish(
        affected: Iterable<PlayerId>,
        screens:  ReadonlyMap<PlayerId, Screen> = new Map()
    ): void {
        for (const player of new Set(affected)) {
            if (this._emitter.listenerCount(player) > 0) {
                this._emitter.emit(player, screens.get(player) ?? this.build(player));
            }
        }
    }


    // Clears a notice as its screen reaches a watcher.  A screen built earlier
    // may carry a notice that another screen has since delivered; it is not
    // shown twice.
    private deliver(player: PlayerId, screen: Screen): Screen {
        if (screen.kind !== "Lobby" || screen.notice === null) {
            return screen;
        }
        return this._notices.delete(player) ? screen : { ...screen, notice: null };
    }


    private async *stream(
        player: PlayerId,
        first:  Screen,
        later:  AsyncIterableIterator<Array<unknown>>,
        stop:   AbortSignal
    ): AsyncGenerator<Screen> {
        try {
            this._presence.open(player);
            if (!stop.aborted) {
                yield this.deliver(player, first);
            }
            for await (const [screen] of later) {
                if (stop.aborted) {
                    return;
                }
                yield this.deliver(player, screen as Screen);
            }
        }
        catch (e) {
            if (!(e instanceof Error && e.name === "AbortError")) {
                throw e;
            }
        }
        finally {
            this._presence.close(player);
            // A consumer that stops after the first screen never enters the
            // loop above, so close the listener here.
            await later.return?.();
        }
    }

}
