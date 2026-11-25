import { type PlayerId } from "@repo/mille-bornes-core/ids";
import { type Clock } from "./clock.mjs";


/**
 * Tracks which players have a connection open.  Connections are counted, so a
 * player with two tabs stays connected until both close.  When the last one
 * closes, the player still counts as connected for a grace period; opening a
 * connection within it cancels the disconnect, which is never reported.
 */
export class Presence {

    private readonly _open = new Map<PlayerId, number>();
    // Players whose last connection closed, with the cancel of their timer.
    private readonly _leaving = new Map<PlayerId, () => void>();
    private _disposed = false;


    /**
     * Creates the tracker.
     * @param _clock - Runs the grace timers
     * @param _graceMs - How long a closed connection still counts as connected
     * @param _onChange - Called when a player becomes connected or
     * disconnected
     */
    public constructor(
        private readonly _clock:    Clock,
        private readonly _graceMs:  number,
        private readonly _onChange: (player: PlayerId) => void
    ) {
    }


    /**
     * Says whether a player is connected.
     * @param player - The player
     * @returns True while a connection is open or within the grace period
     */
    public isConnected(player: PlayerId): boolean {
        return this._open.has(player) || this._leaving.has(player);
    }


    /**
     * Records a connection opening.
     * @param player - The player
     */
    public open(player: PlayerId): void {
        if (this._disposed) {
            return;
        }
        const count = this._open.get(player) ?? 0;
        this._open.set(player, count + 1);
        const cancel = this._leaving.get(player);
        if (cancel) {
            cancel();
            this._leaving.delete(player);
        }
        else if (count === 0) {
            this._onChange(player);
        }
    }


    /**
     * Records a connection closing.  A close with none open is ignored.
     * @param player - The player
     */
    public close(player: PlayerId): void {
        const count = this._open.get(player) ?? 0;
        if (this._disposed || count === 0) {
            return;
        }
        if (count > 1) {
            this._open.set(player, count - 1);
            return;
        }
        this._open.delete(player);
        this._leaving.set(player, this._clock.setTimeout(() => {
            this._leaving.delete(player);
            this._onChange(player);
        }, this._graceMs));
    }


    /** Cancels every grace timer; later calls do nothing. */
    public dispose(): void {
        this._disposed = true;
        this._leaving.forEach((cancel) => { cancel(); });
        this._leaving.clear();
        this._open.clear();
    }

}
