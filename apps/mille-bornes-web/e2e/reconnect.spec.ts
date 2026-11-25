import type { Page } from "@playwright/test";
import {
    createGame, enterName, fillWithRobots, hand, handCards, joinGame, playToGameOver, startGame,
    untilMyTurn
} from "./support/game.js";
import { expect, test } from "./support/fixtures.js";
import { phone } from "./support/phones.js";


/**
 * Asserts that nothing flies for a while: a snapshot after a reconnect must
 * not replay the moves that were missed.
 * @param page - A phone at the table
 * @returns After a second without a flying card
 */
async function expectNothingFlies(page: Page): Promise<void> {
    for (let i = 0; i < 10; i++) {
        expect(await page.locator(".flying-layer > *").count(), "no animation replays").toBe(0);
        await page.waitForTimeout(100);
    }
}


/**
 * Plays one card (the first one, discarded) through the UI.
 * @param page - A phone on its turn
 * @returns Once the discard has been sent
 */
async function discardFirst(page: Page): Promise<void> {
    // Forced: a dimmed card counts as disabled for Playwright, but can be
    // discarded.
    await hand(page).locator("button.card-button").first().tap({ force: true });
    await page.getByRole("button", { name: "Discard", exact: true }).tap();
}


test.describe("a phone that loses its page or its connection", () => {

    test("a reload lands on the same table with the same hand", async ({ openPhone }) => {
        const ann = await openPhone();
        await enterName(ann, "Ann");
        await createGame(ann);
        await fillWithRobots(ann, 4);
        await startGame(ann);
        await untilMyTurn(ann);
        const before = await handCards(ann);
        expect(before).toHaveLength(7);

        await ann.reload();
        await untilMyTurn(ann);
        expect(await handCards(ann)).toEqual(before);
        await expect(ann.getByRole("heading", { name: "Lobby" })).toHaveCount(0);
    });


    test("going offline shows Reconnecting... and coming back shows the current table without " +
        "replaying what was missed", async ({ openPhone, relay }) => {
        const ann = await openPhone(phone, relay.url);
        const bea = await openPhone();
        await enterName(ann, "Ann");
        await enterName(bea, "Bea");
        await createGame(ann);
        await joinGame(bea, "Ann");
        await fillWithRobots(ann, 4);
        await startGame(ann);
        // The game waits for one of them; it is to be Bea's turn.
        await expect(bea.locator(".top-bar")).toHaveText(/^(?:Your turn|Waiting for Ann)/u, {
            timeout: 20_000
        });
        if ((await bea.locator(".top-bar").textContent())?.startsWith("Waiting") === true) {
            await discardFirst(ann);
        }
        await untilMyTurn(bea);

        // The open stream stalls, as on a lost Wi-Fi link, so only the
        // client's inactivity timeout notices.
        await ann.context().setOffline(true);
        relay.stall();
        await expect(ann.getByText("Reconnecting...")).toBeVisible({ timeout: 15_000 });

        // Ann misses Bea's move and the robots' moves after it, until the
        // game waits for a human again.
        await discardFirst(bea);
        await expect(bea.locator(".top-bar")).toHaveText(/^(?:Your turn|Waiting for Ann)/u, {
            timeout: 20_000
        });
        const drawPile = bea.locator(".pile.draw");
        const discardPile = bea.locator(".pile.discard [data-card]");

        relay.restore();
        await ann.context().setOffline(false);
        await expect(ann.getByText("Reconnecting...")).toBeHidden({ timeout: 20_000 });
        await expectNothingFlies(ann);
        await expect(ann.locator(".pile.draw")).toHaveAttribute(
            "aria-label", (await drawPile.getAttribute("aria-label")) ?? ""
        );
        await expect(ann.locator(".pile.discard [data-card]")).toHaveAttribute(
            "data-card", (await discardPile.getAttribute("data-card")) ?? ""
        );
        await expect(hand(ann).locator("[data-card]")).toHaveCount(7);
    });


    test("a server restart shows the lost connection, then the same game, which goes on", async ({
        openPhone, server
    }) => {
        const ann = await openPhone();
        await enterName(ann, "Ann");
        await createGame(ann);
        await fillWithRobots(ann, 4);
        await startGame(ann);
        await untilMyTurn(ann);
        const teams = await ann.locator(".team-name").allTextContents();

        await server.stop();
        await expect(ann.getByText("Reconnecting...")).toBeVisible();
        // The banner says the link is lost after 10 s of trying.
        await expect(ann.getByText("Lost connection, trying again")).toBeVisible({
            timeout: 15_000
        });

        await server.start();
        await expect(ann.getByText("Lost connection, trying again")).toBeHidden({
            timeout: 20_000
        });
        // A hard kill may lose the last move, so the game is checked, not
        // the move count: the same teams, and it plays on to the end.
        await expect(hand(ann)).toBeVisible();
        expect(await ann.locator(".team-name").allTextContents()).toEqual(teams);
        await playToGameOver(ann, "Ann");
        await expect(ann.getByRole("region", { name: "Score sheet" })).toBeVisible();
    });

});
