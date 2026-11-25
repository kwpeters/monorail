import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import { PlayerId } from "@repo/mille-bornes-core/ids";
import { PlayerName } from "@repo/mille-bornes-core/playerName";
import { pickWhimsicalName } from "@repo/mille-bornes-core/whimsicalNames";
import { type SessionRecord } from "./records.mjs";
import { type SnapshotStore } from "./snapshotStore.mjs";


/** What a client presents to prove who it is. */
export interface Credential {
    playerId: PlayerId;
    token:    string;
}


/** Settings for a `SessionRegistry`. */
export interface SessionRegistryOptions {

    /** Makes a new token; the default is 24 random bytes, base64url (32 characters). */
    newToken?: () => string;

}


const maxHeaderLength = 200;
const bearerPattern = /^Bearer (?<id>[^. ]+)\.(?<token>[A-Za-z0-9_-]+)$/u;


/**
 * Reads a credential from an `Authorization` header or connection parameter.
 * @param header - The raw value, expected to be `Bearer <playerId>.<token>`
 * @returns The credential, or null when the value is missing or malformed
 */
export function parseBearer(header: string | undefined): Credential | null {
    if (header === undefined || header.length > maxHeaderLength) {
        return null;
    }
    const { id, token } = bearerPattern.exec(header)?.groups ?? {};
    const playerId = id === undefined ? undefined : PlayerId.tryCreate(id);
    return playerId?.succeeded && token !== undefined ? { playerId: playerId.value, token } : null;
}


// Digests have equal length, so timingSafeEqual never throws and the time does
// not depend on how much of the token matched.
function sameToken(a: string, b: string): boolean {
    const digest = (s: string): Buffer => createHash("sha256").update(s, "utf8").digest();
    return timingSafeEqual(digest(a), digest(b));
}


/**
 * Issues and checks player credentials, and keeps each player's name.  Every
 * change is saved through the store before it is reported as done.
 */
export class SessionRegistry {

    /**
     * Creates a registry holding the sessions saved earlier.
     * @param store - Where sessions are kept
     * @param rand - Returns a number from 0 (included) to 1 (excluded); used to
     * pick whimsical names
     * @param options - Optional settings
     * @returns The registry
     */
    public static async load(
        store:    SnapshotStore,
        rand:     () => number,
        options?: SessionRegistryOptions
    ): Promise<SessionRegistry> {
        const { sessions } = await store.loadAll();
        return new SessionRegistry(store, rand, options?.newToken ?? defaultToken, sessions);
    }


    private readonly _sessions = new Map<PlayerId, SessionRecord>();


    private constructor(
        private readonly _store:    SnapshotStore,
        private readonly _rand:     () => number,
        private readonly _newToken: () => string,
        sessions:                   ReadonlyArray<SessionRecord>
    ) {
        sessions.forEach((s) => { this._sessions.set(s.playerId, s); });
    }


    /**
     * Issues a new credential.  Nothing is issued when the name is invalid or
     * the session cannot be saved.
     * @param name - The player's name, or null to be given a whimsical one
     * @returns The credential and the player's name, or a plain-English reason
     */
    public async create(name: string | null): Promise<Result<Credential & { name: PlayerName }, string>> {
        const named = name === null ?
            pickWhimsicalName([...this._sessions.values()].map((s) => s.name), this._rand) :
            PlayerName.tryCreate(name);
        if (named.failed) {
            return named;
        }
        const record: SessionRecord = {
            playerId: PlayerId.create(),
            token:    this._newToken(),
            name:     named.value
        };
        this._sessions.set(record.playerId, record);
        if (!await this.save()) {
            this._sessions.delete(record.playerId);
            return new FailedResult("The session could not be saved.");
        }
        return new SucceededResult({ playerId: record.playerId, token: record.token, name: record.name });
    }


    /**
     * Changes a player's name.  Nothing changes when the name is invalid or
     * cannot be saved.
     * @param id - The player
     * @param name - The new name
     * @returns The new name, or a plain-English reason
     */
    public async rename(id: PlayerId, name: string): Promise<Result<PlayerName, string>> {
        const old = this._sessions.get(id);
        if (!old) {
            return new FailedResult("That player has no session.");
        }
        const named = PlayerName.tryCreate(name);
        if (named.failed) {
            return named;
        }
        this._sessions.set(id, { ...old, name: named.value });
        if (!await this.save()) {
            this._sessions.set(id, old);
            return new FailedResult("The new name could not be saved.");
        }
        return named;
    }


    /**
     * Gets a player's name.
     * @param id - The player
     * @returns The name, or null when the player has no session
     */
    public nameOf(id: PlayerId): PlayerName | null {
        return this._sessions.get(id)?.name ?? null;
    }


    /**
     * Checks a credential in constant time with respect to the token.
     * @param c - The credential presented
     * @returns Whether the token belongs to that player
     */
    public authenticate(c: Credential): boolean {
        const record = this._sessions.get(c.playerId);
        return record !== undefined && sameToken(record.token, c.token);
    }


    // The failure is logged by the store; callers only need to know it failed.
    private async save(): Promise<boolean> {
        try {
            await this._store.saveSessions([...this._sessions.values()]);
            return true;
        }
        catch {
            return false;
        }
    }

}


function defaultToken(): string {
    return randomBytes(24).toString("base64url");
}
