import type { BrowserContextOptions, Page } from "@playwright/test";
import {
    createGame, enterName, fillWithRobots, hand, playToGameOver, startGame, untilMyTurn
} from "./support/game.js";
import { expect, test } from "./support/fixtures.js";
import { phone, smallPhone } from "./support/phones.js";


/** How far (in CSS pixels) a part of the table may move or change size. */
const tolerance = 3;


// The robots answer a window at once when they can, so a window is short for
// the page; what it did to the table is recorded inside the page the moment
// the banner is inserted, not by polling it from outside.
test.use({ serverEnv: { MB_HAZARD_WINDOW_MS: "1000" } });


/** Where a part of the table is in the document, and how big. */
interface Box {
    readonly left:   number;
    readonly top:    number;
    readonly width:  number;
    readonly height: number;
}


type Boxes = Readonly<Record<string, Box>>;


/** What the page recorded when a hazard banner was inserted. */
interface Opened {
    /** The table in the last frame before, and how far the page was scrolled. */
    readonly quiet:     Boxes;
    readonly quietY:    number;
    /** The table when the banner was inserted, and how far the page was scrolled. */
    readonly during:    Boxes;
    readonly y:         number;
    /** The countdown's box in the viewport; none when the banner was gone already. */
    readonly countdown: { top: number; bottom: number; right: number } | null;
    readonly handTop:   number;
    readonly width:     number;
}


/** What the page records for the whole game (see `watchTable`). */
interface Watch {
    measure: () => Boxes;
    opens:   Array<Opened>;
    /** The top bar's height whenever a banner was removed. */
    closes:  Array<number>;
}


type WatchedWindow = Window & { stability: Watch };


const sizes: ReadonlyArray<readonly [string, BrowserContextOptions]> = [
    ["320 x 568", smallPhone],
    ["390 x 844", phone]
];


/**
 * Starts recording, inside the page, what a card in the air or a pick-up
 * must not move: the top bar, the piles, the lanes and the hand (positions
 * are in the document, so a scroll is not a move); and, for every hazard
 * banner inserted, the table just before and at that moment, with the
 * countdown's place.  While no banner shows, the page is kept scrolled down,
 * as a pick-up leaves a short screen, so that a banner has to bring it back.
 * @param page - A phone at the table
 * @returns Once recording
 */
async function watchTable(page: Page): Promise<void> {
    await page.evaluate(() => {
        const selectors: ReadonlyArray<readonly [string, string]> = [
            ["top-bar", ".top-bar"],
            ["draw-pile", "[data-anim-anchor='draw-pile']"],
            ["discard-pile", "[data-anim-anchor='discard-pile']"],
            ["team-0", "[data-anim-anchor='team-0']"],
            ["team-1", "[data-anim-anchor='team-1']"],
            ["hand", "[data-anim-anchor='hand']"]
        ];
        const measure = (): Boxes => {
            const found: Record<string, Box> = {};
            for (const [name, selector] of selectors) {
                const r = document.querySelector(selector)?.getBoundingClientRect();
                if (r !== undefined) {
                    found[name] = {
                        left:   r.left + window.scrollX,
                        top:    r.top + window.scrollY,
                        width:  r.width,
                        height: r.height
                    };
                }
            }
            return found;
        };
        const watch: Watch = { measure, opens: [], closes: [] };
        let quiet = measure();
        let quietY = window.scrollY;
        const sample = (): void => {
            if (document.querySelector(".hazard-banner") === null) {
                const down = document.documentElement.scrollHeight - window.innerHeight;
                // An Extension offer scrolls itself into view: leave it be.
                if (down > window.scrollY + 1 && document.querySelector(".extension-offer") === null) {
                    window.scrollTo(0, down);
                }
                quiet = measure();
                quietY = window.scrollY;
            }
            requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
        const isBanner = (node: Node): boolean => node instanceof Element &&
            (node.matches(".hazard-banner") || node.querySelector(".hazard-banner") !== null);
        new MutationObserver((records) => {
            for (const record of records) {
                if ([...record.addedNodes].some(isBanner)) {
                    const countdown = document.querySelector("[role='timer']")?.getBoundingClientRect();
                    watch.opens.push({
                        quiet,
                        quietY,
                        during:    measure(),
                        y:         window.scrollY,
                        countdown: countdown === undefined ?
                            null :
                            { top: countdown.top, bottom: countdown.bottom, right: countdown.right },
                        handTop: document.querySelector(".hand")?.getBoundingClientRect().top ?? 0,
                        width:   window.innerWidth
                    });
                }
                if ([...record.removedNodes].some(isBanner)) {
                    watch.closes.push(measure()["top-bar"]?.height ?? NaN);
                }
            }
        }).observe(document.body, { childList: true, subtree: true });
        (window as unknown as WatchedWindow).stability = watch;
    });
}


async function measure(page: Page): Promise<Boxes> {
    return page.evaluate(() => (window as unknown as WatchedWindow).stability.measure());
}


/**
 * Asserts that nothing moved or changed size between two measures.  The hand
 * sticks to the bottom of the screen, so only its size counts.
 * @param before - The first measure
 * @param after - The second measure
 * @param what - What happened in between, for the failure message
 * @param only - The parts to compare (default all of them)
 * @returns Once checked
 */
function expectStill(
    before: Boxes,
    after: Boxes,
    what: string,
    only: ReadonlyArray<string> = Object.keys(before)
): void {
    for (const name of only) {
        const was = before[name];
        const now = after[name];
        expect(was, `${name} was measured`).toBeDefined();
        expect(now, `${name} is still there ${what}`).toBeDefined();
        const sized = [
            Math.abs(was!.width - now!.width), Math.abs(was!.height - now!.height)
        ];
        const placed = name === "hand" ?
            [] :
            [Math.abs(was!.left - now!.left), Math.abs(was!.top - now!.top)];
        for (const d of [...sized, ...placed]) {
            expect(d, `${name} moved or changed size by ${d.toString()} px ${what}`)
            .toBeLessThanOrEqual(tolerance);
        }
    }
}


/**
 * Plays Ann on by what is on her screen until a hazard banner has come and
 * gone with its countdown seen, or the game ends.
 * @param page - Ann's phone, at the start of a game
 * @returns Whether a banner was seen
 */
async function playUntilBanner(page: Page): Promise<boolean> {
    void playToGameOver(page, "Ann", { timeoutMs: 60_000 }).catch(() => undefined);
    const gameOver = page.getByRole("button", { name: "Back to lobby" });
    let seen = false;
    await expect.poll(async () => {
        const recorded = await page.evaluate(() => {
            const { opens, closes } = (window as unknown as WatchedWindow).stability;
            return { opens: opens.filter((o) => o.countdown !== null).length, closes: closes.length };
        });
        seen = recorded.opens > 0 && recorded.closes > 0;
        return seen || await gameOver.isVisible() ? "done" : "playing";
    }, { timeout: 60_000, intervals: [100] }).toBe("done");
    return seen;
}


for (const [name, size] of sizes) {

    test(`at ${name}: picking a card up moves nothing on the table`, async ({ openPhone }) => {
        const ann = await openPhone(size);
        await enterName(ann, "Ann");
        await createGame(ann);
        await fillWithRobots(ann, 4);
        await startGame(ann);
        await watchTable(ann);
        await untilMyTurn(ann);

        const before = await measure(ann);
        // A dimmed card can be picked up too, to be discarded.
        const card = hand(ann).locator("button.card-button").first();
        await card.tap({ force: true });
        await expect(card).toHaveAttribute("aria-pressed", "true");
        await expect(ann.getByRole("button", { name: "Discard", exact: true })).toBeVisible();
        expectStill(before, await measure(ann), "when a card is picked up");

        // The Discard button is beside the pile and still on screen.
        const edge = await ann.locator(".pile-target").evaluate((el) => {
            return { right: el.getBoundingClientRect().right, width: window.innerWidth };
        });
        expect(edge.right, "the Discard button is on screen").toBeLessThanOrEqual(edge.width);
    });


    test(`at ${name}: a hazard window moves nothing and shows its countdown`, async ({
        openPhone
    }) => {
        test.setTimeout(150_000);
        const ann = await openPhone(size);
        await enterName(ann, "Ann");
        let seen = false;
        // Whether a robot hits Ann is up to the cards, so a game that ends
        // without a hit is followed by another.
        for (let game = 0; game < 3 && !seen; game++) {
            if (game > 0) {
                await ann.getByRole("button", { name: "Back to lobby" }).tap();
            }
            await createGame(ann);
            await fillWithRobots(ann, 4);
            await startGame(ann);
            if (game === 0) {
                await watchTable(ann);
            }
            seen = await playUntilBanner(ann);
        }
        expect(seen, "a hazard banner came and went in one of the games").toBe(true);

        const { opens, closes } = await ann.evaluate(() => (window as unknown as WatchedWindow).stability);
        const opened = opens.filter((o) => o.countdown !== null);
        // The hand may grow: the card that answers the hazard gets a badge.
        const table = ["top-bar", "draw-pile", "discard-pile", "team-0", "team-1"];
        for (const o of opened) {
            // Nothing moved, the top bar is as tall as ever, and the page is
            // at its top with the countdown on screen above the hand.
            expectStill(o.quiet, o.during, "when the hazard window opened", table);
            expect(o.y, "the page is at its top").toBe(0);
            expect(o.countdown!.top, "the countdown is on screen").toBeGreaterThanOrEqual(0);
            expect(o.countdown!.right).toBeLessThanOrEqual(o.width);
            expect(o.countdown!.bottom, "the countdown is above the hand")
            .toBeLessThanOrEqual(o.handTop);
        }
        if (size === smallPhone) {
            // On this screen the table is taller than the screen, so the page
            // was down before, and the banner brought it back.
            expect(opened[0]!.quietY, "the page was scrolled down before").toBeGreaterThan(0);
        }
        for (const height of closes) {
            expect(Math.abs(height - opened[0]!.during["top-bar"]!.height), "the top bar after")
            .toBeLessThanOrEqual(tolerance);
        }
    });

}
