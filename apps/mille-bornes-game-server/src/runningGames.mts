import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { type PlayerCommand } from "@repo/mille-bornes-core/commands";
import { type GameEvent } from "@repo/mille-bornes-core/events";
import { type Game } from "@repo/mille-bornes-core/game";
import { type GameId, type PlayerId } from "@repo/mille-bornes-core/ids";
import { type PlayerName } from "@repo/mille-bornes-core/playerName";
import { describeRejection } from "@repo/mille-bornes-core/rejection";
import { type Clock } from "./clock.mjs";
import { type Timings } from "./config.mjs";
import { type Logger } from "./logger.mjs";
import { type GameRecord } from "./records.mjs";
import { playingScreens, type Screen } from "./screens.mjs";
import { type SnapshotStore } from "./snapshotStore.mjs";
import { type Table, type TableOptions, type TableUpdate } from "./table.mjs";


/** One game as the host page lists it. */
export interface AdminEntry {
    readonly id:            GameId;
    /** A running game whose phase is GameOver is Finished. */
    readonly state:         "Pending" | "Running" | "Finished";
    readonly organizerName: PlayerName;
    readonly seatNames:     ReadonlyArray<PlayerName>;
    /** "Waiting" for a pending game, otherwise the game's phase. */
    readonly phase:         string;
}


/** A started game and what the server keeps beside it. */
export interface RunningGame {
    readonly table:     Table;
    readonly organizer: PlayerId;
    /** Humans who pressed "Back to lobby" after GameOver. */
    readonly left:      Array<PlayerId>;
    /** The newest update shown and saved; an older one is ignored. */
    game:               Game;
    seq:                number;
    /** The save of the newest update. */
    saved:              Promise<Result<void, string>>;
}


/** What `RunningGames` needs; the callbacks lead back to the Hub. */
export interface RunningGamesOptions {
    readonly store:        SnapshotStore;
    readonly clock:        Clock;
    readonly rand:         () => number;
    readonly timings:      Timings;
    readonly logger:       Logger;
    readonly tableFactory: (opts: TableOptions) => Table;
    readonly isConnected:  (player: PlayerId) => boolean;
    /** Runs a store call; a failure is logged and never returned. */
    readonly persist:      (
        write: () => Promise<void>,
        id:    GameId
    ) => Promise<Result<void, string>>;
    /** Shows players new screens: the ones given, or freshly built ones. */
    readonly publish:      (
        players:  ReadonlyArray<PlayerId>,
        screens?: ReadonlyMap<PlayerId, Screen>
    ) => void;
    /** Leaves a one-time notice for a player's next Lobby screen. */
    readonly notify:       (player: PlayerId, notice: string) => void;
}


/** The notice the stuck guard leaves. */
export const stuckNotice = "Something went wrong with the game, so it was ended.";


/**
 * Gets the humans still in a running game.
 * @param r - The game
 * @returns The human seats that have not left, in turn order
 */
export function humansOf(r: { game: Game; left: ReadonlyArray<PlayerId> }): Array<PlayerId> {
    return r.game.players
    .filter((p) => p.seat.kind === "Human" && !r.left.includes(p.seat.id))
    .map((p) => p.seat.id);
}


const ok = new SucceededResult<void>(undefined);


/**
 * The started games: each one's Table, saves, screens and stuck guard.  If
 * the server's own command fails or a screen cannot be built, the game is
 * ended, its snapshot quarantined, and its humans get `stuckNotice`.  No
 * method throws.
 */
export class RunningGames {

    private readonly _games = new Map<GameId, RunningGame>();


    /**
     * Creates the collection, empty.
     * @param _opts - The dependencies and the callbacks to the Hub
     */
    public constructor(private readonly _opts: RunningGamesOptions) {
    }


    /**
     * Gets a game by id.
     * @param id - The game's id
     * @returns The game, if it is running
     */
    public get(id: GameId): RunningGame | undefined {
        return this._games.get(id);
    }


    /**
     * Finds the game a player is in.
     * @param player - The player
     * @returns The game, unless the player is in none or has left it
     */
    public of(player: PlayerId): RunningGame | undefined {
        return [...this._games.values()].find((r) => humansOf(r).includes(player));
    }


    /**
     * Creates and starts a just-dealt game's Table.
     * @param game - The game, at seq 0
     * @param organizer - The organizer
     * @returns The game, or a plain message if its Table could not be made
     */
    public start(game: Game, organizer: PlayerId): Result<RunningGame, string> {
        try {
            return new SucceededResult(this.run(game, 0, organizer, []));
        }
        catch (e) {
            this.forget(game.config.id);
            this._opts.logger.error(`Starting game ${game.config.id} threw: ${String(e)}`);
            return new FailedResult("The game could not be started.");
        }
    }


    /**
     * Brings back a saved game; its timers restart in full.  One that cannot
     * be restored is quarantined.
     * @param r - The saved record
     */
    public restore(r: Extract<GameRecord, { state: "Running" }>): void {
        try {
            this.run(r.game, r.seq, r.organizer, r.left);
        }
        catch (e) {
            this.quarantine(r.game.config.id, humansOf(r), `restoring it threw: ${String(e)}`);
        }
    }


    /**
     * Saves a game's newest state and shows it to its humans.
     * @param r - The game
     * @param events - The change's events, unredacted
     * @returns The save's outcome
     */
    public accepted(
        r:      RunningGame,
        events: ReadonlyArray<GameEvent>
    ): Promise<Result<void, string>> {
        r.saved = this.save(r);
        const screens = this.screensOf(r, events);
        if (screens) {
            this._opts.publish(humansOf(r), screens);
        }
        return r.saved;
    }


    /**
     * Builds a player's Playing screen; it carries no events.
     * @param player - The player
     * @returns The screen, or null if the player is in no running game
     */
    public screenFor(player: PlayerId): Screen | null {
        const r = this.of(player);
        return (r && this.screensOf(r, [])?.get(player)) ?? null;
    }


    /**
     * Plays a human's move.
     * @param r - The player's game
     * @param player - The player
     * @param cmd - The move (untrusted)
     * @returns Success, or a plain-English reason
     */
    public play(
        r:      RunningGame,
        player: PlayerId,
        cmd:    PlayerCommand
    ): Promise<Result<void, string>> {
        let played: Result<void, string>;
        try {
            played = r.table.submit(player, cmd);
        }
        catch (e) {
            this._opts.logger.error(`A command from ${player} threw: ${String(e)}`);
            return Promise.resolve(new FailedResult("That command could not be played."));
        }
        if (played.failed) {
            return Promise.resolve(played);
        }
        // Showing the change may have tripped the stuck guard.
        return this._games.get(r.game.config.id) === r ?
            r.saved :
            Promise.resolve(new FailedResult(stuckNotice));
    }


    /**
     * Records that a player left a finished game; the game is deleted once
     * every human has left.
     * @param r - The game, at GameOver
     * @param player - The player leaving
     * @returns The outcome of the save or delete
     */
    public leave(r: RunningGame, player: PlayerId): Promise<Result<void, string>> {
        r.left.push(player);
        if (humansOf(r).length > 0) {
            this._opts.publish([player]);
            return this.save(r);
        }
        return this.end(r, null, [player]);
    }


    /**
     * Ends a game and deletes its snapshot.  The Table is disposed first, so
     * no timer fires afterwards.  Its humans return to the Lobby, each but
     * `except` with the notice.
     * @param r - The game
     * @param notice - The notice, or null for none
     * @param humans - Who returns to the Lobby (default: the game's humans)
     * @param except - Who gets no notice
     * @returns The delete's outcome
     */
    public end(
        r:      RunningGame,
        notice: string | null,
        humans: ReadonlyArray<PlayerId> = humansOf(r),
        except: PlayerId | null = null
    ): Promise<Result<void, string>> {
        const id = r.game.config.id;
        return this.finish(id, humans, () => this._opts.store.deleteGame(id), notice, except);
    }


    /**
     * Lists the games for the host page.
     * @returns The games, oldest first
     */
    public list(): Array<AdminEntry> {
        return [...this._games.values()].map(({ game, organizer }) => ({
            id:            game.config.id,
            state:         game.phase.kind === "GameOver" ? "Finished" : "Running",
            organizerName: game.players.find((p) => p.seat.id === organizer)!.seat.name,
            seatNames:     game.players.map((p) => p.seat.name),
            phase:         game.phase.kind
        }));
    }


    /** Stops every Table and forgets every game. */
    public dispose(): void {
        this._games.forEach((r) => { r.table.dispose(); });
        this._games.clear();
    }


    private run(
        game:      Game,
        seq:       number,
        organizer: PlayerId,
        left:      ReadonlyArray<PlayerId>
    ): RunningGame {
        const id = game.config.id;
        const { clock, rand, timings, logger } = this._opts;
        const table = this._opts.tableFactory({
            game,
            seq,
            clock,
            rand,
            timings,
            logger,
            onUpdate: (u) => { this.onUpdate(id, u); },
            onStuck:  (reason) => { this.stuck(id, reason); }
        });
        const r: RunningGame = {
            table, organizer, left: [...left], game, seq, saved: Promise.resolve(ok)
        };
        this._games.set(id, r);
        table.start();
        return r;
    }


    private forget(id: GameId): void {
        this._games.get(id)?.table.dispose();
        this._games.delete(id);
    }


    // The Table's onUpdate.  The Hub never submits from here, so updates come
    // in order unless a Table nests them; then the older one comes last and is
    // dropped.
    private onUpdate(id: GameId, u: TableUpdate): void {
        try {
            const r = this._games.get(id);
            if (r && u.seq > r.seq) {
                r.game = u.game;
                r.seq = u.seq;
                void this.accepted(r, u.events);
            }
        }
        catch (e) {
            this.stuck(id, `showing seq ${u.seq} threw: ${String(e)}`);
        }
    }


    private save(r: RunningGame): Promise<Result<void, string>> {
        const id = r.game.config.id;
        const { organizer, game, seq } = r;
        const record: GameRecord = {
            format: 1, state: "Running", organizer, game, seq, left: [...r.left]
        };
        return this._opts.persist(() => this._opts.store.saveGame(id, record), id);
    }


    // Builds every seat's Playing screen.  A failure trips the stuck guard and
    // gives null.
    private screensOf(
        r:      RunningGame,
        events: ReadonlyArray<GameEvent>
    ): ReadonlyMap<PlayerId, Screen> | null {
        const id = r.game.config.id;
        try {
            const built = playingScreens(r.game, events, {
                organizer:   r.organizer,
                timer:       r.table.timer(),
                isConnected: this._opts.isConnected
            });
            if (built.succeeded) {
                return built.value;
            }
            this.stuck(id, describeRejection(built.error));
        }
        catch (e) {
            this.stuck(id, `building a screen threw: ${String(e)}`);
        }
        return null;
    }


    private stuck(id: GameId, reason: string): void {
        const r = this._games.get(id);
        if (r) {
            this.quarantine(id, humansOf(r), reason);
        }
    }


    // Ends a broken game and keeps its snapshot for debugging.
    private quarantine(id: GameId, humans: ReadonlyArray<PlayerId>, reason: string): void {
        try {
            this._opts.logger.error(`Game ${id} is stuck and was ended: ${reason}`);
            const write = (): Promise<void> => this._opts.store.quarantineGame(id);
            void this.finish(id, humans, write, stuckNotice, null);
        }
        catch (e) {
            this._opts.logger.error(`Ending game ${id} threw: ${String(e)}`);
        }
    }


    private finish(
        id:     GameId,
        humans: ReadonlyArray<PlayerId>,
        write:  () => Promise<void>,
        notice: string | null,
        except: PlayerId | null
    ): Promise<Result<void, string>> {
        this.forget(id);
        if (notice !== null) {
            humans.filter((p) => p !== except).forEach((p) => { this._opts.notify(p, notice); });
        }
        this._opts.publish(humans);
        return this._opts.persist(write, id);
    }

}
