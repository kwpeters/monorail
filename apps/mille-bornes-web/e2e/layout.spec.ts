import type { Page } from "@playwright/test";
import {
    createGame, enterName, fillWithRobots, hand, joinGame, playToGameOver, startGame, untilMyTurn
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


/** What one look at a picked-up card's targets found. */
interface TargetCheck {
    /** The targets on screen that the hand (or anything) covers, or too small. */
    readonly problems: ReadonlyArray<string>;
    /** How many lane targets were on screen and checked. */
    readonly lanes:    number;
}


/**
 * Checks that the Discard button is on screen, on top at its centre and at
 * least 44 x 44, and that every lane button with its centre on screen is on
 * top too.
 * @param page - A phone with a card picked up
 * @returns What was found
 */
async function checkTargets(page: Page): Promise<TargetCheck> {
    return page.evaluate((min) => {
        const problems: Array<string> = [];
        let lanes = 0;
        const onTop = (b: Element): boolean => {
            const r = b.getBoundingClientRect();
            const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
            return hit !== null && b.contains(hit);
        };
        const discard = document.querySelector(".pile-target");
        if (discard === null) {
            problems.push("no Discard button");
        }
        else {
            const r = discard.getBoundingClientRect();
            if (r.top < 0 || r.bottom > window.innerHeight || !onTop(discard)) {
                // Enough to tell a covered button from a scroll that did not happen.
                const handTop = document.querySelector(".hand")?.getBoundingClientRect().top ?? NaN;
                problems.push(`Discard is covered or off screen at ${r.top.toString()} ` +
                    `(hand top ${handTop.toString()}, scrolled ${window.scrollY.toString()} ` +
                    `of ${document.documentElement.scrollHeight.toString()})`);
            }
            if (r.width < min - 0.5 || r.height < min - 0.5) {
                problems.push(`Discard is ${r.width.toString()} x ${r.height.toString()}`);
            }
        }
        for (const lane of document.querySelectorAll(".lane-target")) {
            const r = lane.getBoundingClientRect();
            // Scrolling Discard clear can push the top lane up out of view; a
            // lane with its centre on screen must be on top, not under the hand.
            const middle = r.top + r.height / 2;
            if (middle > 0 && middle < window.innerHeight) {
                lanes++;
                if (!onTop(lane)) {
                    problems.push(`${lane.textContent} is covered at ${r.top.toString()}`);
                }
            }
        }
        return { problems, lanes };
    }, minTarget);
}


test("at 320 x 568 a picked-up card's Discard and lane buttons are never under the hand", async ({
    openPhone
}) => {
    // Three seats make three teams, the tallest table with lane buttons.
    const ann = await openPhone(smallPhone);
    await enterName(ann, "Ann");
    await createGame(ann);
    await fillWithRobots(ann, 3);
    await startGame(ann);
    await untilMyTurn(ann);

    // A dimmed card still answers a tap: it says why, and can be discarded.
    const dimmed = hand(ann).locator("button.card-button[aria-disabled='true']").first();
    await dimmed.tap({ force: true });
    await expect(ann.locator(".top-bar")).not.toHaveText(/^Your turn/u);
    await expect(ann.getByRole("button", { name: "Discard", exact: true })).toBeVisible();
    await dimmed.tap({ force: true });
    await expect(dimmed).toHaveAttribute("aria-pressed", "false");

    const problems: Array<string> = [];
    let picks = 0;
    let lanes = 0;
    let offers = 0;
    await playToGameOver(ann, "Ann", {
        onPicked: async (page) => {
            const found = await checkTargets(page);
            picks++;
            lanes += found.lanes;
            problems.push(...found.problems);
        },
        // The offer sits at the top of the table, which a pick may have
        // scrolled away; it scrolls itself back into view.
        onOffer: async (page) => {
            offers++;
            // The offer lasts 1.5 s; one that ran out fails this step only.
            const top = await page.locator(".extension-offer").evaluate((el) => {
                return el.getBoundingClientRect().top;
            }, undefined, { timeout: 1000 });
            // Scrolled to the top gives a sub-pixel position, not exactly 0.
            if (top < -1) {
                problems.push(`the Extension offer is above the screen at ${top.toString()}`);
            }
        }
    });
    test.info().annotations.push({
        type:        "targets checked",
        description: `${picks.toString()} picks, ${lanes.toString()} lane buttons on screen, ` +
            `${offers.toString()} Extension offers`
    });
    expect(picks, "cards were picked up").toBeGreaterThan(5);
    expect(problems, "no target under the hand").toEqual([]);
});
