import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { GameId } from "@repo/mille-bornes-core/ids";
import { type Logger } from "./logger.mjs";
import {
    decodeRecord, decodeSessions, encodeRecord, recordGameId, type GameRecord, type SessionRecord
} from "./records.mjs";


/** The games and sessions read back from storage. */
export interface LoadedSnapshots {
    games:    ReadonlyArray<{ id: GameId; record: GameRecord }>;
    sessions: ReadonlyArray<SessionRecord>;
}


/**
 * Persists game records and player sessions.  Operations on one game run in
 * call order.  A save queued behind another waiting save replaces it (the
 * latest state wins); a delete or quarantine is never dropped or replaced, and
 * a later save queues behind it.  A failed write rejects without logging; the
 * caller logs it once, with its own context.
 */
export interface SnapshotStore {

    /**
     * Stores a game's record, replacing any earlier one.  Rejects when `id` is
     * not a canonical `GameId` or the write fails.
     * @param id - The game's id
     * @param record - The record
     * @returns Resolves when the record (or a newer one) is stored
     */
    saveGame(id: GameId, record: GameRecord): Promise<void>;

    /**
     * Removes a game's record; removing a missing one is not an error.
     * @param id - The game's id
     * @returns Resolves when the record is gone
     */
    deleteGame(id: GameId): Promise<void>;

    /**
     * Moves a game's record aside for debugging so it is not loaded again.
     * @param id - The game's id
     * @returns Resolves when the record has been moved
     */
    quarantineGame(id: GameId): Promise<void>;

    /**
     * Stores every session, replacing the earlier list.
     * @param records - The sessions
     * @returns Resolves when the sessions (or a newer list) are stored
     */
    saveSessions(records: ReadonlyArray<SessionRecord>): Promise<void>;

    /**
     * Reads everything back.  Never rejects: damaged records are logged and
     * skipped.
     * @returns The good games and sessions
     */
    loadAll(): Promise<LoadedSnapshots>;

    /**
     * Waits for every queued write.
     * @returns Resolves when everything queued so far has been stored
     */
    flush(): Promise<void>;

}


// The ids reach file names, so only canonical UUIDs may pass.
function checkId(id: string): void {
    GameId.tryCreate(id).throwIfFailed();
}


interface Job {
    kind:    "save" | "other";
    label:   string;
    op:      () => Promise<void>;
    waiters: Array<{ resolve: () => void; reject: (e: unknown) => void }>;
}


interface Slot {
    running: boolean;
    queue:   Array<Job>;
}


/**
 * Runs jobs per key, one at a time and in call order.  Only a "save" queued
 * right behind another waiting "save" replaces it (the replaced job's callers
 * settle with the job that replaced it); any other job, such as a delete or a
 * quarantine, is never dropped or replaced and later jobs queue behind it.
 * A failed job rejects its callers; the next job still runs.
 */
class CoalescingQueue {

    private readonly _slots = new Map<string, Slot>();
    private readonly _outstanding = new Set<Promise<void>>();


    public enqueue(key: string, label: "save" | "delete" | "quarantine", op: () => Promise<void>): Promise<void> {
        const done = new Promise<void>((resolve, reject) => {
            let slot = this._slots.get(key);
            if (!slot) {
                slot = { running: false, queue: [] };
                this._slots.set(key, slot);
            }
            const last = slot.queue[slot.queue.length - 1];
            const kind = label === "save" ? "save" : "other";
            const replaces = kind === "save" && last?.kind === "save";
            const waiters = replaces ? last.waiters : [];
            waiters.push({ resolve, reject });
            const job: Job = { kind, label, op, waiters };
            if (replaces) {
                slot.queue[slot.queue.length - 1] = job;
            }
            else {
                slot.queue.push(job);
            }
            if (!slot.running) {
                void this.drain(key, slot);
            }
        });
        const forget = (): void => { this._outstanding.delete(done); };
        this._outstanding.add(done);
        done.then(forget, forget);
        return done;
    }


    public async idle(): Promise<void> {
        await Promise.allSettled([...this._outstanding]);
    }


    private async drain(key: string, slot: Slot): Promise<void> {
        slot.running = true;
        for (let job = slot.queue.shift(); job; job = slot.queue.shift()) {
            try {
                await job.op();
                job.waiters.forEach((w) => { w.resolve(); });
            }
            catch (err) {
                job.waiters.forEach((w) => { w.reject(err); });
            }
        }
        this._slots.delete(key);
    }

}


function isMissing(err: unknown): boolean {
    return (err as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}


/** Options for a `FileSnapshotStore`. */
export interface FileSnapshotStoreOptions {
    /**
     * Test hook: replaces `fs.rename` for the rename that completes each
     * write, so a test can make it fail.
     */
    readonly rename?: (from: string, to: string) => Promise<void>;
}


// Waits before the second and third rename attempts.  Windows antivirus and
// indexers briefly lock a file that was just written.
const renameRetryDelaysMs = [10, 30];
const lockedCodes = new Set(["EPERM", "EBUSY", "EACCES"]);


/**
 * Stores records as JSON files: `<dataDir>/games/<gameId>.json`,
 * `<dataDir>/failed/` and `<dataDir>/sessions.json`.  Each write goes to a
 * `.tmp` file that is then renamed over the target.
 */
export class FileSnapshotStore implements SnapshotStore {

    private readonly _gamesDir:     string;
    private readonly _failedDir:    string;
    private readonly _sessionsFile: string;
    private readonly _queue:        CoalescingQueue;
    private readonly _rename:       NonNullable<FileSnapshotStoreOptions["rename"]>;
    private _writeCount = 0;


    /**
     * Creates a store.  Directories are created by `loadAll()` and as needed.
     * @param dataDir - The directory that holds all stored data
     * @param _logger - Receives a warning for each damaged file
     * @param options - Test hooks
     */
    public constructor(
        dataDir:                  string,
        private readonly _logger: Logger,
        options:                  FileSnapshotStoreOptions = {}
    ) {
        this._queue = new CoalescingQueue();
        this._rename = options.rename ?? fs.rename;
        this._gamesDir = path.join(dataDir, "games");
        this._failedDir = path.join(dataDir, "failed");
        this._sessionsFile = path.join(dataDir, "sessions.json");
    }


    /** The number of files written so far; lets tests check that writes coalesce. */
    public get writeCount(): number {
        return this._writeCount;
    }


    public saveGame(id: GameId, record: GameRecord): Promise<void> {
        return this.guard(id, () => {
            const json = JSON.stringify(encodeRecord(record));
            return this._queue.enqueue(this.gameFile(id), "save", () => this.writeFile(this.gameFile(id), json));
        });
    }


    public deleteGame(id: GameId): Promise<void> {
        return this.guard(id, () => {
            return this._queue.enqueue(this.gameFile(id), "delete", () => fs.rm(this.gameFile(id), { force: true }));
        });
    }


    public quarantineGame(id: GameId): Promise<void> {
        return this.guard(id, () => {
            return this._queue.enqueue(this.gameFile(id), "quarantine", async () => {
                await fs.mkdir(this._failedDir, { recursive: true });
                try {
                    await fs.rename(this.gameFile(id), path.join(this._failedDir, `${id}.json`));
                }
                catch (err) {
                    if (!isMissing(err)) {
                        throw err;
                    }
                }
            });
        });
    }


    public saveSessions(records: ReadonlyArray<SessionRecord>): Promise<void> {
        const json = JSON.stringify(records);
        return this._queue.enqueue(this._sessionsFile, "save", () => this.writeFile(this._sessionsFile, json));
    }


    public async loadAll(): Promise<LoadedSnapshots> {
        const games: Array<{ id: GameId; record: GameRecord }> = [];
        let names: Array<string> = [];
        try {
            await fs.mkdir(this._gamesDir, { recursive: true });
            await fs.mkdir(this._failedDir, { recursive: true });
            names = (await fs.readdir(this._gamesDir)).sort();
        }
        catch (err) {
            this._logger.warn(`Could not read the games directory: ${String(err)}`);
        }
        // One bad entry must never keep the later ones from loading.
        for (const name of names) {
            try {
                const loaded = await this.loadGame(name);
                if (loaded) {
                    games.push(loaded);
                }
            }
            catch (err) {
                this._logger.warn(`Skipping ${name}: ${String(err)}`);
            }
        }
        return { games, sessions: await this.loadSessions() };
    }


    public flush(): Promise<void> {
        return this._queue.idle();
    }


    private gameFile(id: GameId): string {
        return path.join(this._gamesDir, `${id}.json`);
    }


    // Refuses a bad id before anything touches the file system.
    private async guard(id: GameId, start: () => Promise<void>): Promise<void> {
        checkId(id);
        await start();
    }


    private async writeFile(file: string, json: string): Promise<void> {
        await fs.mkdir(path.dirname(file), { recursive: true });
        const tmp = `${file}.tmp`;
        const handle = await fs.open(tmp, "w");
        try {
            await handle.writeFile(json, "utf8");
            // On disk before the rename, so a power cut cannot leave it empty.
            await handle.sync();
        }
        finally {
            await handle.close();
        }
        await this.renameOver(tmp, file);
        this._writeCount++;
    }


    // Renames, retrying while the file is locked; other errors fail at once.
    private async renameOver(tmp: string, file: string): Promise<void> {
        for (let attempt = 0; ; attempt++) {
            try {
                await this._rename(tmp, file);
                return;
            }
            catch (err) {
                const delay = renameRetryDelaysMs[attempt];
                const code = (err as NodeJS.ErrnoException | undefined)?.code ?? "";
                if (delay === undefined || !lockedCodes.has(code)) {
                    throw err;
                }
                await sleep(delay);
            }
        }
    }


    private async loadGame(name: string): Promise<{ id: GameId; record: GameRecord } | undefined> {
        const file = path.join(this._gamesDir, name);
        if (name.endsWith(".tmp")) {
            this._logger.info(`Removing the unfinished write ${name}.`);
            await fs.rm(file, { force: true }).catch((err: unknown) => {
                this._logger.warn(`Could not remove ${name}: ${String(err)}`);
            });
            return undefined;
        }
        const id = name.endsWith(".json") ? GameId.tryCreate(name.slice(0, -".json".length)) : undefined;
        if (!id || id.failed) {
            this._logger.warn(`Skipping ${name}: the file name is not a game id.`);
            return undefined;
        }

        let json: unknown;
        try {
            json = JSON.parse(await fs.readFile(file, "utf8"));
        }
        catch (err) {
            this._logger.warn(`Skipping ${name}: it cannot be read (${String(err)}).`);
            return undefined;
        }
        const record = decodeRecord(json);
        if (record.failed) {
            this._logger.warn(`Skipping ${name}: ${record.error}`);
            return undefined;
        }
        if (recordGameId(record.value) !== id.value) {
            this._logger.warn(`Skipping ${name}: it holds game ${recordGameId(record.value)}.`);
            return undefined;
        }
        return { id: id.value, record: record.value };
    }


    private async loadSessions(): Promise<ReadonlyArray<SessionRecord>> {
        let text: string;
        try {
            text = await fs.readFile(this._sessionsFile, "utf8");
        }
        catch (err) {
            return isMissing(err) ?
                [] :
                this.setAsideSessions(`it cannot be read (${String(err)}).`);
        }
        let json: unknown;
        try {
            json = JSON.parse(text);
        }
        catch {
            // The parser's message quotes the text, which holds tokens.
            return this.setAsideSessions("it is not valid JSON.");
        }
        const decoded = decodeSessions(json);
        if (decoded.failed) {
            return this.setAsideSessions(decoded.error);
        }
        decoded.value.problems.forEach((p) => {
            this._logger.warn(`Skipping a session in sessions.json: ${p}`);
        });
        return decoded.value.sessions;
    }


    // Moves an unusable sessions.json to sessions.json.bad (replacing an older
    // one), so the next save does not destroy the evidence.  Best effort.
    private async setAsideSessions(reason: string): Promise<Array<SessionRecord>> {
        this._logger.warn(`Ignoring sessions.json, moved to sessions.json.bad: ${reason}`);
        await fs.rename(this._sessionsFile, `${this._sessionsFile}.bad`).catch((err: unknown) => {
            this._logger.warn(`Could not move sessions.json to sessions.json.bad: ${String(err)}`);
        });
        return [];
    }

}


/**
 * Keeps records in memory with the same contract as `FileSnapshotStore`; for
 * tests and for running without persistence.  Records are stored as JSON, so
 * they come back as copies.
 */
export class MemorySnapshotStore implements SnapshotStore {

    private readonly _games = new Map<GameId, string>();
    private _sessions = "[]";


    public saveGame(id: GameId, record: GameRecord): Promise<void> {
        return this.guard(id, () => { this._games.set(id, JSON.stringify(encodeRecord(record))); });
    }


    public deleteGame(id: GameId): Promise<void> {
        return this.guard(id, () => { this._games.delete(id); });
    }


    public quarantineGame(id: GameId): Promise<void> {
        return this.deleteGame(id);
    }


    public saveSessions(records: ReadonlyArray<SessionRecord>): Promise<void> {
        this._sessions = JSON.stringify(records);
        return Promise.resolve();
    }


    public loadAll(): Promise<LoadedSnapshots> {
        const games = [...this._games].map(([id, json]) => ({
            id,
            record: decodeRecord(JSON.parse(json)).throwIfFailed()
        }));
        const { sessions } = decodeSessions(JSON.parse(this._sessions)).throwIfFailed();
        return Promise.resolve({ games, sessions });
    }


    public flush(): Promise<void> {
        return Promise.resolve();
    }


    private guard(id: GameId, act: () => void): Promise<void> {
        return new Promise((resolve) => {
            checkId(id);
            act();
            resolve();
        });
    }

}
