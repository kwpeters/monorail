import type { Page } from "@playwright/test";
import { createGame, enterName, fillWithRobots, joinGame, startGame } from "./support/game.js";
import { expect, test } from "./support/fixtures.js";


// Names are at most 20 characters, so the script is short: if it ran, it
// would set `window.__p`.
const hostile = "<svg onload=__p=1>";


async function expectNoScript(page: Page): Promise<void> {
    await expect(page.locator("svg[onload]")).toHaveCount(0);
    expect(await page.evaluate(() => "__p" in window), "the name's script never runs").toBe(false);
}


test("a name with HTML in it is shown as text on the lobby, waiting room and table", async ({
    openPhone
}) => {
    const [host, bea] = await Promise.all([openPhone(), openPhone()]);
    await enterName(host, hostile);
    await enterName(bea, "Bea");
    await expect(host.getByText(`Playing as ${hostile}`)).toBeVisible();

    await createGame(host);
    await expect(bea.getByRole("heading", { name: `${hostile}'s game` })).toBeVisible();
    await expectNoScript(bea);

    await joinGame(bea, hostile);
    await expect(bea.getByText(`Waiting for ${hostile} to start the game...`)).toBeVisible();
    await expect(host.locator(".team-seat").getByText(hostile, { exact: true })).toBeVisible();
    await expectNoScript(host);
    await expectNoScript(bea);

    await fillWithRobots(host, 4);
    await startGame(host);
    for (const page of [host, bea]) {
        await expect(page.locator(".player").getByText(hostile, { exact: true })).toBeVisible();
        await expectNoScript(page);
    }
});
