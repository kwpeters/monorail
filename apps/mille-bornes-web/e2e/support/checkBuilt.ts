import fs from "node:fs";
import path from "node:path";
import { serverEntry, webRoot } from "./gameServer.js";


/**
 * Fails the run at once, with what to do, when the game server or the web app
 * has not been built (`npm run e2e` builds both first).
 */
export default function checkBuilt(): void {
    const needed = [serverEntry, path.join(webRoot, "index.html")];
    const missing = needed.filter((f) => !fs.existsSync(f));
    if (missing.length > 0) {
        throw new Error(
            `Not built: ${missing.join(", ")}.  Run "npm run build" at the repository root ` +
            "(or use \"npm run e2e -w @repo/mille-bornes-web\", which builds what it needs)."
        );
    }
}
