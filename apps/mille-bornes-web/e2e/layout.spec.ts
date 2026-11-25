import type { Page } from "@playwright/test";
import {
    createGame, enterName, fillWithRobots, hand, joinGame, startGame
} from "./support/game.js";
import { expect, test } from "./support/fixtures.js";
import { smallPhone } from "./support/phones.js";


/** The smallest touch target, in CSS pixels. */
const minTarget = 44;


/**
 * Asserts that a screen does not scroll sideways and that every visible
 * button is big enough to tap.
 * @param page - A phone showing the screen
 * @param name - The screen, for failure messages
 * @returns Once both are checked
 */
async function expectPhoneFriendly(page: Page, name: string): Promise<void> {
    const width = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth
    }));
    expect(width.scroll, `${name}: the page does not scroll sideways`)
    .toBeLessThanOrEqual(width.client);

    const small = await page.evaluate((min) => {
        return [...document.querySelectorAll("button")]
        .filter((b) => b.getClientRects().length > 0)
        .map((b) => {
            const r = b.getBoundingClientRect();
            const label = b.getAttribute("aria-label") ?? b.textContent;
            return { label: label.trim(), width: r.width, height: r.height };
        })
        .filter((b) => b.width < min - 0.5 || b.height < min - 0.5);
    }, minTarget);
    expect(small, `${name}: every button is at least ${minTarget.toString()} x ` +
        minTarget.toString()).toEqual([]);
}


test("at 320 x 568: no sideways scroll, big enough buttons, the hand in view", async ({
    openPhone
}) => {
    const [ann, bea] = await Promise.all([openPhone(smallPhone), openPhone(smallPhone)]);
    await enterName(ann, "Annabelle Longname");
    await enterName(bea, "Bea 🚗🚗🚗");
    await createGame(ann);
    await expect(bea.getByRole("button", { name: /^Join / })).toBeVisible();
    await expectPhoneFriendly(bea, "lobby");

    await joinGame(bea, "Annabelle Longname");
    await fillWithRobots(ann, 6);
    await expectPhoneFriendly(ann, "organizer's waiting room");
    await expectPhoneFriendly(bea, "joiner's waiting room");

    await startGame(ann);
    await expect(hand(bea)).toBeVisible();
    for (const [page, who] of [[ann, "organizer"], [bea, "joiner"]] as const) {
        await expectPhoneFriendly(page, `${who}'s table`);
        // The table opens at the top, wherever the waiting room was scrolled.
        await expect(page.locator(".top-bar"), `${who}: the top bar is in view`)
        .toBeInViewport();
        const where = await hand(page).evaluate((el) => {
            const r = el.getBoundingClientRect();
            return { top: r.top, bottom: r.bottom, viewport: window.innerHeight };
        });
        expect(where.top, `${who}: the hand's top is on screen`).toBeGreaterThanOrEqual(0);
        expect(where.bottom, `${who}: the hand ends on screen`)
        .toBeLessThanOrEqual(where.viewport + 0.5);
        expect(where.bottom, `${who}: the hand sits at the bottom`)
        .toBeGreaterThanOrEqual(where.viewport - 40);
    }
});
