import fs from "node:fs";
import {
    expect,
    test as base,
    type Browser,
    type BrowserContext,
    type BrowserContextOptions,
    type Page
} from "@playwright/test";
import { GameServer } from "./gameServer.js";
import { phone } from "./phones.js";
import { Relay } from "./relay.js";


/** What every spec gets. */
export interface Fixtures {
    /**
     * Environment variables for this test's server, over the fast timings;
     * set with `test.use({ serverEnv: { ... } })`.
     */
    serverEnv: Readonly<Record<string, string>>;

    /** A game server of this test's own, started before the test. */
    server:    GameServer;

    /**
     * Opens the app on a new phone: a browser context of its own, so each
     * phone keeps its own credential.
     * @param options - The phone (default 390 x 844)
     * @param url - Where to open the app (default the server's address)
     * @returns The page, showing name entry
     */
    openPhone: (options?: BrowserContextOptions, url?: string) => Promise<Page>;

    /**
     * A relay in front of this test's server, closed after the test
     * whatever its outcome; made only for a test that asks for it.
     */
    relay:     Relay;
}


async function openPhoneOn(
    browser: Browser,
    url:     string,
    options: BrowserContextOptions,
    errors:  Array<string>
): Promise<Page> {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    page.on("pageerror", (err) => errors.push(err.message));
    await page.goto(url);
    return page;
}


/** The Playwright `test` with a game server and phones. */
export const test = base.extend<Fixtures>({
    serverEnv: [{}, { option: true }],

    server: async ({ serverEnv }, use, testInfo) => {
        const dataDir = testInfo.outputPath("server-data");
        fs.mkdirSync(dataDir, { recursive: true });
        const log = testInfo.outputPath("server.log");
        const server = await GameServer.start(dataDir, log, serverEnv);
        await use(server);
        await server.dispose();
    },

    openPhone: async ({ browser, server }, use) => {
        const contexts: Array<BrowserContext> = [];
        const errors: Array<string> = [];
        await use(async (options = phone, url = server.url) => {
            const page = await openPhoneOn(browser, url, options, errors);
            contexts.push(page.context());
            return page;
        });
        await Promise.all(contexts.map(async (c) => c.close()));
        expect(errors, "no page may throw").toEqual([]);
    },

    relay: async ({ server }, use) => {
        const relay = await Relay.open(server.port);
        try {
            await use(relay);
        }
        finally {
            await relay.close();
        }
    }
});


export { expect };
