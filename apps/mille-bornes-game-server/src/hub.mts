import { EventEmitter, on } from "node:events";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { type Seat } from "@repo/mille-bornes-core/game";
import { GameId, PlayerId } from "@repo/mille-bornes-core/ids";
import {
    applyPendingCommand, createPending, type PendingCommand, type PendingGame
} from "@repo/mille-bornes-core/pendingGame";
import { describeRejection } from "@repo/mille-bornes-core/rejection";
import { type GameLength } from "@repo/mille-bornes-core/scoring";
import { pickWhimsicalName } from "@repo/mille-bornes-core/whimsicalNames";
import { type Clock } from "./clock.mjs";
import { type Timings } from "./config.mjs";
import { type Logger } from "./logger.mjs";
import { lobbyScreen, waitingScreen, type Screen } from "./screens.mjs";
import { type SessionRegistry } from "./sessions.mjs";
import { type SnapshotStore } from "./snapshotStore.mjs";


/** What a `Hub` needs. */
export interface HubOptions {
    store:    SnapshotStore;
    sessions: SessionRegistry;
    clock:    Clock;
    /** Returns a number in [0, 1); picks robot names. */
    rand:     () => number;
    timings:  Timings;
    logger:   Logger;
}


const saveFailed = "Something went wrong saving the game. Please try again.";
const notInGame = "You are not in a game.";


function fail(message: string): Result<never, string> {
    return new FailedResult(message);
}


const ok = new SucceededResult<void>(undefined);


/**
 * Holds every game and decides what each player's screen shows.  A player is
 * in at most one game.  Every change is applied at once, shown to the players
 * it affects, and then saved; if the save fails the change stays in memory
 * and the next change saves it again.  No method throws.
 *
 * A one-time notice (for example "You were removed from the game.") goes on
 * the next Lobby screen a `watch()` delivers to that player, and is then
 * cleared.  A player with no open watch keeps it until their next `watch()`.
 * `screenFor()` shows a notice but never clears it.
 */
export class Hub {

    /**
     * Opens a hub holding the pending games saved earlier.  Saved games have no
     * creation time, so they are listed in `GameId` order: arbitrary, but the
     * same after every restart.  (Running games are not restored yet.)
     * @param opts - What the hub needs
     * @returns The hub
     */
    public static async open(opts: HubOptions): Promise<Hub> {
        const { games } = await opts.store.loadAll();
        const pending = games
        .flatMap(({ record }) => record.state === "Pending" ? [record.pending] : [])
        .sort((a, b) => a.id.localeCompare(b.id));
        return new Hub(opts, pending);
    }


    // Insertion order is creation order.
    private readonly _pending = new Map<GameId, PendingGame>();
    private readonly _notices = new Map<PlayerId, string>();
    private readonly _emitter = new EventEmitter();
    private readonly _stop = new AbortController();
    private readonly _store:    SnapshotStore;
    private readonly _sessions: SessionRegistry;
    private readonly _rand:     () => number;
    private readonly _logger:   Logger;


    private constructor(opts: HubOptions, pending: ReadonlyArray<PendingGame>) {
        this._store = opts.store;
        this._sessions = opts.sessions;
        this._rand = opts.rand;
        this._logger = opts.logger;
        pending.forEach((p) => this._pending.set(p.id, p));
        // One listener per open watch, however many there are.
        this._emitter.setMaxListeners(0);
    }


    /**
     * Gets what a player's screen shows now.  Does not clear a notice.
     * @param player - The player
     * @returns The waiting room if the player is seated in a game, otherwise
     * the Lobby
     */
    public screenFor(player: PlayerId): Screen {
        return this.build(player, false);
    }


    /**
     * Follows a player's screen: the current one first, then each later one.
     * Ends quietly when `signal` aborts or the hub is disposed.  The current
     * screen is taken now, so no change after this call is missed.
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
        return this.stream(this.build(player, true), later, stop);
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
        this.publish([player]);
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
            this._pending.delete(game.id);
            const others = game.seats.map((s) => s.id).filter((id) => id !== player);
            others.forEach((id) => this._notices.set(id, "The organizer cancelled the game."));
            this.publish(game.seats.map((s) => s.id));
            return this.persist(() => this._store.deleteGame(game.id), game.id);
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
    public async swapSeats(player: PlayerId, a: PlayerId, b: PlayerId): Promise<Result<void, string>> {
        return this.inGame(player, (game) => this.change(player, game, { type: "SwapSeats", a, b }));
    }


    /**
     * Sets how long the game is.
     * @param player - The organizer
     * @param length - The length
     * @returns Success, or a plain-English reason
     */
    public async setLength(player: PlayerId, length: GameLength): Promise<Result<void, string>> {
        return this.inGame(player, (game) => this.change(player, game, { type: "SetLength", length }));
    }


    /**
     * Waits for every save queued so far.
     * @returns Resolves when they are done
     */
    public async flush(): Promise<void> {
        await this._store.flush();
    }


    /**
     * Ends every watch and forgets every game.  Nothing is deleted from the store.
     */
    public dispose(): void {
        this._stop.abort();
        this._pending.clear();
        this._notices.clear();
    }


    // Where a player is: the id of their game, or null.  Running games are
    // added here later.
    private gameOf(player: PlayerId): GameId | null {
        for (const game of this._pending.values()) {
            if (game.seats.some((s) => s.id === player)) {
                return game.id;
            }
        }
        return null;
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
        return Promise.resolve(game ? act(game) : fail(notInGame));
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
        this.publish([...game.seats, ...applied.value.seats].map((s) => s.id));
        return this.save(applied.value);
    }


    private save(game: PendingGame): Promise<Result<void, string>> {
        return this.persist(
            () => this._store.saveGame(game.id, { format: 1, state: "Pending", pending: game }),
            game.id
        );
    }


    // The store call has been made before the first await, so saves go out in
    // the order the changes were made.
    private async persist(write: () => Promise<void>, id: GameId): Promise<Result<void, string>> {
        try {
            await write();
            return ok;
        }
        catch (e) {
            this._logger.error(`Saving game ${id} failed: ${e instanceof Error ? e.message : String(e)}`);
            return fail(saveFailed);
        }
    }


    // Builds a player's screen.  With `consume`, a notice is cleared.
    private build(player: PlayerId, consume: boolean): Screen {
        const gameId = this.gameOf(player);
        const game = gameId === null ? undefined : this._pending.get(gameId);
        if (game) {
            return waitingScreen(game, player);
        }
        const notice = this._notices.get(player) ?? null;
        if (consume) {
            this._notices.delete(player);
        }
        return lobbyScreen(this._pending.values(), notice);
    }


    // Sends the new screen to every watcher of the affected players and of
    // everyone in the Lobby, whose game list may have changed.  A player with
    // no watcher is skipped so that their notice is kept.
    private publish(affected: ReadonlyArray<PlayerId>): void {
        // `events.on` also listens for "error", which is not a player.
        const watched = (this._emitter.eventNames() as Array<string>)
        .filter((name) => PlayerId.tryCreate(name).succeeded) as Array<PlayerId>;
        const audience = new Set([...affected, ...watched.filter((p) => this.gameOf(p) === null)]);
        for (const player of audience) {
            if (this._emitter.listenerCount(player) > 0) {
                this._emitter.emit(player, this.build(player, true));
            }
        }
    }


    private async *stream(
        first: Screen,
        later: AsyncIterable<Array<unknown>>,
        stop:  AbortSignal
    ): AsyncGenerator<Screen> {
        try {
            // Task 8 starts presence here, and ends it in the finally.
            yield first;
            for await (const [screen] of later) {
                if (stop.aborted) {
                    return;
                }
                yield screen as Screen;
            }
        }
        catch (e) {
            if (!(e instanceof Error && e.name === "AbortError")) {
                throw e;
            }
        }
    }

}
