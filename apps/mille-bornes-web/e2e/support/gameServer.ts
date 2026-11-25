import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";


const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));


/** The built game server's entry point. */
export const serverEntry = path.join(repoRoot, "apps/mille-bornes-game-server/dist/www.mjs");


/** The built web app, which the game server serves. */
export const webRoot = path.join(repoRoot, "apps/mille-bornes-web/dist");


/**
 * Timings short enough that a whole game takes seconds.  The robots answer
 * a hazard window at once, because it is shorter than their usual lead.
 */
const fastTimings = {
    MB_HAZARD_WINDOW_MS:    "400",
    MB_EXTENSION_OFFER_MS:  "1500",
    MB_RACE_OVER_PAUSE_MS:  "800",
    MB_ROBOT_DELAY_MIN_MS:  "20",
    MB_ROBOT_DELAY_MAX_MS:  "60",
    MB_DISCONNECT_GRACE_MS: "300"
};


const startTimeoutMs = 15_000;


/**
 * Finds a port that is free now.
 * @returns The port
 */
async function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once("error", reject);
        probe.listen(0, () => {
            const address = probe.address();
            const port = typeof address === "object" && address !== null ? address.port : 0;
            probe.close(() => resolve(port));
        });
    });
}


/**
 * The real game server (`dist/www.mjs`) in a child process, on a free port
 * with its own data directory and fast timings.  It can be stopped and
 * started again on the same port and data directory.
 */
export class GameServer {

    /**
     * Starts a game server.
     * @param dataDir - Where it saves games and sessions
     * @param logFile - Where its output goes
     * @returns The running server
     */
    public static async start(dataDir: string, logFile: string): Promise<GameServer> {
        const server = new GameServer(await freePort(), dataDir, logFile);
        await server.start();
        return server;
    }


    private _child:        ChildProcess | undefined;
    private readonly _log: fs.WriteStream;


    private constructor(
        public readonly port:    number,
        public readonly dataDir: string,
        logFile:                 string
    ) {
        this._log = fs.createWriteStream(logFile, { flags: "a" });
    }


    /** The address the phones open. */
    public get url(): string {
        return `http://localhost:${this.port.toString()}/`;
    }


    /**
     * Starts the process and waits until it serves the web app.
     * @returns Once the lobby page is served
     */
    public async start(): Promise<void> {
        if (this._child !== undefined) {
            throw new Error("The game server is already running.");
        }
        const child = spawn(process.execPath, [serverEntry], {
            env: {
                ...process.env,
                PORT:        this.port.toString(),
                MB_DATA_DIR: this.dataDir,
                MB_WEB_ROOT: webRoot,
                ...fastTimings
            },
            stdio: ["ignore", "pipe", "pipe"]
        });
        this._child = child;
        let output = "";
        const collect = (chunk: Buffer): void => {
            output += chunk.toString();
            this._log.write(chunk);
        };
        child.stdout.on("data", collect);
        child.stderr.on("data", collect);

        const deadline = Date.now() + startTimeoutMs;
        for (;;) {
            if (child.exitCode !== null) {
                this._child = undefined;
                throw new Error(`The game server exited at startup:\n${output}`);
            }
            try {
                const response = await fetch(this.url);
                if (response.ok && (await response.text()).includes("<div id=\"root\">")) {
                    return;
                }
            }
            catch {
                // Not listening yet.
            }
            if (Date.now() > deadline) {
                await this.stop();
                throw new Error(`The game server did not serve the web app within ` +
                    `${startTimeoutMs.toString()} ms:\n${output}`);
            }
            await new Promise((resolve) => {
                setTimeout(resolve, 100);
            });
        }
    }


    /**
     * Kills the process (a hard kill on Windows, so the last move may not be
     * saved) and waits for it to exit.
     * @returns Once it has exited
     */
    public async stop(): Promise<void> {
        const child = this._child;
        this._child = undefined;
        if (child === undefined) {
            return;
        }
        // A child that has exited (by itself, or killed by a signal) emits
        // no more "exit", so waiting for one would hang.
        if (child.exitCode !== null || child.signalCode !== null) {
            return;
        }
        const exited = new Promise((resolve) => {
            child.once("exit", resolve);
        });
        child.kill();
        await exited;
    }


    /**
     * Stops the server for good and closes its log.
     * @returns Once it has exited
     */
    public async dispose(): Promise<void> {
        await this.stop();
        await new Promise((resolve) => {
            this._log.end(resolve);
        });
    }

}
