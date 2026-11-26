import type { Page } from "@playwright/test";
import {
    createGame, enterName, fillWithRobots, hand, joinGame, startGame, untilMyTurn
} from "./support/game.js";
import { expect, test } from "./support/fixtures.js";
import { phone, smallPhone } from "./support/phones.js";


/** The smallest touch target, in CSS pixels. */
const minTarget = 44;


/**
 * Opens a game with the organizer and one robot at the table.
 * @param page - The organizer's phone, at name entry
 * @returns Once the table shows
 */
async function toTable(page: Page): Promise<void> {
    await enterName(page, "Ann");
    await createGame(page);
    await fillWithRobots(page, 2);
    await startGame(page);
}


test("the table has no header: the page keeps its title, and the other screens keep theirs", async ({
    openPhone
}) => {
    const ann = await openPhone();
    await expect(ann.getByRole("banner")).toBeVisible();
    await enterName(ann, "Ann");
    await createGame(ann);
    await fillWithRobots(ann, 2);
    // The waiting room has its header, with the mute button.
    await expect(ann.getByRole("banner").getByRole("button", { name: /mute sounds$/iu }))
    .toBeVisible();

    await startGame(ann);
    await expect(ann.getByRole("banner")).toHaveCount(0);
    await expect(ann.locator(".shell-bar")).toHaveCount(0);
    await expect(ann.getByRole("button", { name: /mute sounds$/iu })).toHaveCount(0);
    // One h1 for the page, hidden from sight; the table's own headings follow.
    const title = ann.getByRole("heading", { level: 1 });
    await expect(title).toHaveCount(1);
    await expect(title).toHaveText("Mille Bornes");
    await expect(title).toHaveClass(/visually-hidden/u);
    await expect(ann.getByRole("main")).toBeVisible();
    // Nothing of the table is above the message: the top bar starts at the
    // page's top padding.
    const top = await ann.locator(".top-bar").evaluate((el) => el.getBoundingClientRect().top);
    expect(top, "the table starts at the top of the page").toBeLessThan(24);
});


test("the menu button is a 44 x 44 target, on a touch screen and with a mouse", async ({
    openPhone
}) => {
    const ann = await openPhone(phone);
    await toTable(ann);
    const mouse = await openPhone({ viewport: { width: 1000, height: 800 } });
    await enterName(mouse, "Mo");
    await createGame(mouse);
    await fillWithRobots(mouse, 2);
    await startGame(mouse);
    for (const page of [ann, mouse]) {
        const box = await page.getByRole("button", { name: "Menu" }).boundingBox();
        expect(box!.width).toBeGreaterThanOrEqual(minTarget - 0.5);
        expect(box!.height).toBeGreaterThanOrEqual(minTarget - 0.5);
    }
});


test("at 320 x 568 the menu opens over the table inside the screen, moving nothing", async ({
    openPhone
}) => {
    const ann = await openPhone(smallPhone);
    await toTable(ann);
    await untilMyTurn(ann);
    const place = async (): Promise<unknown> => ann.evaluate(() => {
        const rect = (s: string): number[] => {
            const r = document.querySelector(s)!.getBoundingClientRect();
            return [r.left, r.top + window.scrollY, r.width, r.height];
        };
        return [".top-bar", ".scoreboard", ".piles", ".hand"].map(rect);
    });
    const before = await place();
    await ann.getByRole("button", { name: "Menu" }).tap();
    const menu = ann.getByRole("menu", { name: "Menu" });
    await expect(menu).toBeVisible();
    expect(await place(), "the table does not move when the menu opens").toEqual(before);

    const where = await ann.evaluate(() => {
        const r = document.querySelector("[role=menu]")!.getBoundingClientRect();
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, w: innerWidth, h: innerHeight };
    });
    expect(where.left, "the menu is not cut off on the left").toBeGreaterThanOrEqual(0);
    expect(where.right, "the menu is not cut off on the right").toBeLessThanOrEqual(where.w);
    expect(where.top).toBeGreaterThanOrEqual(0);
    expect(where.bottom).toBeLessThanOrEqual(where.h);

    // The items are 44 px tall, and each is the topmost thing at its centre
    // (the hand and the table do not cover them).
    const items = await ann.getByRole("menuitem").evaluateAll((all) => all.map((el) => {
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { name: el.textContent, height: r.height, width: r.width, onTop: hit === el || el.contains(hit) };
    }));
    expect(items.map((i) => i.name)).toEqual([expect.stringContaining("Mute sounds"), "End game"]);
    for (const item of items) {
        expect(item.height, `${item.name} is tall enough`).toBeGreaterThanOrEqual(minTarget - 0.5);
        expect(item.onTop, `${item.name} is not covered`).toBe(true);
    }
    // And over the hand's dock, not under it: the menu button itself, too.
    const hit = await ann.getByRole("button", { name: "Menu" }).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2));
    });
    expect(hit).toBe(true);
    await expect(hand(ann)).toBeVisible();
});


test("the menu closes on Escape, on a tap outside, and on End game, and keeps focus sensible", async ({
    openPhone
}) => {
    const ann = await openPhone();
    await toTable(ann);
    const button = ann.getByRole("button", { name: "Menu" });
    const menu = ann.getByRole("menu");

    await button.tap();
    await expect(menu).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await button.tap();
    await expect(menu).toBeHidden();

    await button.focus();
    await ann.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await expect(ann.getByRole("menuitem").first()).toBeFocused();
    await ann.keyboard.press("ArrowDown");
    await expect(ann.getByRole("menuitem", { name: "End game" })).toBeFocused();
    await ann.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();

    await button.tap();
    await expect(menu).toBeVisible();
    await ann.locator(".scoreboard").tap({ position: { x: 4, y: 4 } });
    await expect(menu).toBeHidden();

    await button.tap();
    await ann.getByRole("menuitem", { name: "End game" }).tap();
    await expect(menu).toBeHidden();
    await expect(ann.getByRole("dialog", { name: "End the game for everyone?" })).toBeVisible();
});


test("Mute sounds says what it does, flips in the open menu, and is remembered", async ({
    openPhone
}) => {
    const ann = await openPhone();
    await toTable(ann);
    const button = ann.getByRole("button", { name: "Menu" });
    await button.tap();
    await ann.getByRole("menuitem", { name: "Mute sounds" }).tap();
    await expect(ann.getByRole("menu")).toBeVisible();
    await expect(ann.getByRole("menuitem", { name: "Unmute sounds" })).toBeVisible();

    await ann.reload();
    await expect(hand(ann)).toBeVisible();
    await ann.getByRole("button", { name: "Menu" }).tap();
    await expect(ann.getByRole("menuitem", { name: "Unmute sounds" })).toBeVisible();
});


test("a player who is not the organizer has Mute sounds and no End game", async ({
    openPhone
}) => {
    const [ann, bea] = await Promise.all([openPhone(), openPhone()]);
    await enterName(ann, "Ann");
    await enterName(bea, "Bea");
    await createGame(ann);
    await joinGame(bea, "Ann");
    await fillWithRobots(ann, 4);
    await startGame(ann);
    await expect(hand(bea)).toBeVisible();

    await bea.getByRole("button", { name: "Menu" }).tap();
    await expect(bea.getByRole("menuitem")).toHaveCount(1);
    await expect(bea.getByRole("menuitem", { name: "Mute sounds" })).toBeVisible();

    await ann.getByRole("button", { name: "Menu" }).tap();
    await expect(ann.getByRole("menuitem")).toHaveCount(2);
});


test("a tap that closes the menu does nothing else, and the hand works at once after it", async ({
    openPhone
}) => {
    const ann = await openPhone();
    await toTable(ann);
    await untilMyTurn(ann);
    const button = ann.getByRole("button", { name: "Menu" });
    const menu = ann.getByRole("menu");
    // A dimmed card can be picked up too, to be discarded.
    const card = hand(ann).locator("button.card-button").first();

    await button.tap();
    await expect(menu).toBeVisible();
    await card.tap({ force: true });
    await expect(menu).toBeHidden();
    await expect(card, "the tap only closed the menu").toHaveAttribute("aria-pressed", "false");

    await card.tap({ force: true });
    await expect(card, "the next tap picks the card up").toHaveAttribute("aria-pressed", "true");
    await expect(ann.getByRole("button", { name: "Discard", exact: true })).toBeVisible();

    // The same for a target: with the card picked up, one tap closes the menu
    // and the next one discards.
    await button.tap();
    await ann.getByRole("button", { name: "Discard", exact: true }).tap();
    await expect(menu).toBeHidden();
    await expect(card).toHaveAttribute("aria-pressed", "true");
    await expect(ann.getByRole("button", { name: "Discard", exact: true })).toBeVisible();
});
