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


/** What every spec gets. */
export interface Fixtures {
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
    // Playwright reads the fixtures a fixture needs from this pattern.
    // eslint-disable-next-line no-empty-pattern
    server: async ({}, use, testInfo) => {
        const dataDir = testInfo.outputPath("server-data");
        fs.mkdirSync(dataDir, { recursive: true });
        const server = await GameServer.start(dataDir, testInfo.outputPath("server.log"));
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
    }
});


export { expect };
