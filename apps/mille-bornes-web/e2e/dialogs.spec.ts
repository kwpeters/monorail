import type { Locator, Page } from "@playwright/test";
import { createGame, enterName, fillWithRobots, hand, startGame } from "./support/game.js";
import { expect, test } from "./support/fixtures.js";


/**
 * Holds a finger on an element for longer than a long press, then lifts it.
 * @param page - The page
 * @param target - What to press
 * @returns Once the finger is lifted
 */
async function longPress(page: Page, target: Locator): Promise<void> {
    const box = await target.boundingBox();
    if (box === null) {
        throw new Error("The element to long-press is not on screen.");
    }
    const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await page.waitForTimeout(800);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
}


test.describe("native dialogs in a real browser", () => {

    test("Escape closes Cancel game and End game without acting, and focus returns", async ({
        openPhone
    }) => {
        const ann = await openPhone();
        await enterName(ann, "Ann");
        await createGame(ann);
        await fillWithRobots(ann, 2);

        const cancel = ann.getByRole("button", { name: "Cancel game" });
        await cancel.tap();
        const cancelDialog = ann.getByRole("dialog", { name: "Cancel this game?" });
        await expect(cancelDialog).toBeVisible();
        await expect(cancelDialog.getByRole("button", { name: "Keep the game" })).toBeFocused();
        await ann.keyboard.press("Escape");
        await expect(cancelDialog).toBeHidden();
        await expect(cancel).toBeFocused();
        await expect(ann.getByRole("heading", { name: "Your game" })).toBeVisible();

        await startGame(ann);
        // At the table End game is in the top bar's menu, not in a header.
        const menu = ann.getByRole("button", { name: "Menu" });
        await menu.tap();
        await ann.getByRole("menuitem", { name: "End game" }).tap();
        const endDialog = ann.getByRole("dialog", { name: "End the game for everyone?" });
        await expect(endDialog).toBeVisible();
        await expect(endDialog.getByRole("button", { name: "Keep playing" })).toBeFocused();
        await ann.keyboard.press("Escape");
        await expect(endDialog).toBeHidden();
        await expect(menu).toBeFocused();
        await expect(hand(ann)).toBeVisible();
    });


    test("a long press on a card explains it; Escape or Close returns focus to it", async ({
        openPhone
    }) => {
        const ann = await openPhone();
        await enterName(ann, "Ann");
        await createGame(ann);
        await fillWithRobots(ann, 2);
        await startGame(ann);

        const card = hand(ann).locator("button.card-button").first();
        const help = ann.locator("dialog.card-help");
        for (const close of ["Escape", "Close"]) {
            await longPress(ann, card);
            await expect(help).toBeVisible();
            await expect(help.getByRole("heading")).not.toBeEmpty();
            // The long press opens the help instead of picking the card up.
            await expect(card).toHaveAttribute("aria-pressed", "false");
            if (close === "Escape") {
                await ann.keyboard.press("Escape");
            }
            else {
                await help.getByRole("button", { name: "Close" }).tap();
            }
            await expect(help).toHaveCount(0);
            await expect(card, `focus returns after ${close}`).toBeFocused();
        }
    });

});
