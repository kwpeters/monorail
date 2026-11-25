import net from "node:net";


/**
 * A TCP relay in front of the game server, standing in for a phone's
 * network.  `context.setOffline()` fails new requests but leaves an open
 * event stream flowing, so a dropped network also needs the relay: it can
 * stall every open connection the way a lost Wi-Fi link does (no data and no
 * close), which the client notices only by its inactivity timeout.
 */
export class Relay {

    /**
     * Opens a relay to a local port.
     * @param targetPort - The game server's port
     * @returns The relay, listening on a free port
     */
    public static async open(targetPort: number): Promise<Relay> {
        const relay = new Relay(targetPort);
        await new Promise<void>((resolve) => {
            relay._server.listen(0, resolve);
        });
        return relay;
    }


    private readonly _server: net.Server;
    private readonly _sockets = new Set<net.Socket>();
    private _stalled = false;


    private constructor(targetPort: number) {
        this._server = net.createServer((client) => {
            if (this._stalled) {
                client.destroy();
                return;
            }
            const upstream = net.connect(targetPort, "localhost");
            for (const [from, to] of [[client, upstream], [upstream, client]] as const) {
                this._sockets.add(from);
                from.pipe(to);
                from.on("error", () => to.destroy());
                from.on("close", () => {
                    this._sockets.delete(from);
                    to.destroy();
                });
            }
        });
    }


    /** The address to open instead of the server's. */
    public get url(): string {
        const address = this._server.address();
        const port = typeof address === "object" && address !== null ? address.port : 0;
        return `http://localhost:${port.toString()}/`;
    }


    /** Stops every byte on the open connections and refuses new ones. */
    public stall(): void {
        this._stalled = true;
        for (const socket of this._sockets) {
            socket.unpipe();
            socket.pause();
        }
    }


    /** Lets new connections through again; the stalled ones are dropped. */
    public restore(): void {
        for (const socket of this._sockets) {
            socket.destroy();
        }
        this._stalled = false;
    }


    /**
     * Closes the relay and every connection through it.
     * @returns Once it is closed
     */
    public async close(): Promise<void> {
        this.restore();
        await new Promise((resolve) => {
            this._server.close(resolve);
        });
    }

}
