import type { BrowserContextOptions, Page } from "@playwright/test";
import {
    createGame, enterName, fillWithRobots, hand, playToGameOver, startGame, untilMyTurn
} from "./support/game.js";
import { expect, test } from "./support/fixtures.js";
import { phone, smallPhone } from "./support/phones.js";


/** How far (in CSS pixels) a part of the table may move or change size. */
const tolerance = 3;


// A hazard window long enough to look at; the robots still play at once.
test.use({ serverEnv: { MB_HAZARD_WINDOW_MS: "3000" } });


/** Where a part of the table is in the document, and how big. */
interface Box {
    readonly left:   number;
    readonly top:    number;
    readonly width:  number;
    readonly height: number;
}


type Boxes = Readonly<Record<string, Box>>;


const sizes: ReadonlyArray<readonly [string, BrowserContextOptions]> = [
    ["320 x 568", smallPhone],
    ["390 x 844", phone]
];


/**
 * Measures what a card in the air or a pick-up must not move: the top bar,
 * the piles, the lanes and the hand.  Positions are in the document, so a
 * scroll (a pick-up scrolls on a short screen) is not a move.
 * @param page - A phone at the table
 * @returns The boxes by name
 */
async function measure(page: Page): Promise<Boxes> {
    return page.evaluate(() => {
        const selectors: ReadonlyArray<readonly [string, string]> = [
            ["top-bar", ".top-bar"],
            ["draw-pile", "[data-anim-anchor='draw-pile']"],
            ["discard-pile", "[data-anim-anchor='discard-pile']"],
            ["team-0", "[data-anim-anchor='team-0']"],
            ["team-1", "[data-anim-anchor='team-1']"],
            ["hand", "[data-anim-anchor='hand']"]
        ];
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
    });
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


/** What `watchGame` saw. */
interface Watched {
    /** Whether a hazard banner showed (else the game ended). */
    readonly hazard: boolean;
    /** The table as it was just before the banner showed. */
    readonly quiet:  Boxes;
}


/**
 * Plays Ann on by what is on her screen and measures the table until a
 * hazard banner shows against her team, or the game ends.
 * @param page - Ann's phone, at the start of a game
 * @returns Whether the banner showed, and the table just before it
 */
async function watchGame(page: Page): Promise<Watched> {
    void playToGameOver(page, "Ann").catch(() => undefined);
    const banner = page.locator(".hazard-banner");
    const gameOver = page.getByRole("button", { name: "Back to lobby" });
    let quiet = await measure(page);
    await expect.poll(async () => {
        if (await banner.count() > 0 || await gameOver.isVisible()) {
            return "done";
        }
        quiet = await measure(page);
        return "quiet";
    }, { timeout: 90_000, intervals: [50] }).toBe("done");
    return { hazard: await banner.count() > 0, quiet };
}


for (const [name, size] of sizes) {

    test(`at ${name}: picking a card up moves nothing on the table`, async ({ openPhone }) => {
        const ann = await openPhone(size);
        await enterName(ann, "Ann");
        await createGame(ann);
        await fillWithRobots(ann, 4);
        await startGame(ann);
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
        const ann = await openPhone(size);
        await enterName(ann, "Ann");
        const banner = ann.locator(".hazard-banner");
        let seen: Watched = { hazard: false, quiet: {} };
        // Whether a robot hits Ann is up to the cards, so a game that ends
        // without a hit is followed by another.
        for (let game = 0; game < 6 && !seen.hazard; game++) {
            if (game > 0) {
                await ann.getByRole("button", { name: "Back to lobby" }).tap();
            }
            await createGame(ann);
            await fillWithRobots(ann, 4);
            await startGame(ann);
            seen = await watchGame(ann);
        }
        expect(seen.hazard, "a hazard window opened against Ann in one of the games").toBe(true);
        const quiet = seen.quiet;

        // It opened: the same boxes, the same top bar (the alert is the
        // longest text it shows), and the countdown on screen above the
        // hand when the page is at its top.
        const during = await measure(ann);
        // The hand may grow: the card that answers the hazard gets a badge.
        const table = ["top-bar", "draw-pile", "discard-pile", "team-0", "team-1"];
        expectStill(quiet, during, "when the hazard window opened", table);
        await ann.evaluate(() => {
            window.scrollTo(0, 0);
        });
        await expect(ann.getByRole("timer"), "the banner counts down").toHaveCount(1);
        const countdown = await ann.evaluate(() => {
            const c = document.querySelector("[role='timer']")?.getBoundingClientRect();
            const h = document.querySelector(".hand")?.getBoundingClientRect();
            return {
                top:     c?.top ?? NaN,
                bottom:  c?.bottom ?? NaN,
                right:   c?.right ?? NaN,
                handTop: h?.top ?? 0,
                width:   window.innerWidth
            };
        });
        expect(countdown.top, "the countdown is on screen").toBeGreaterThanOrEqual(0);
        expect(countdown.right).toBeLessThanOrEqual(countdown.width);
        expect(countdown.bottom, "the countdown is above the hand")
        .toBeLessThanOrEqual(countdown.handTop);

        // It closed: the top bar is the height it was.
        await expect(banner).toHaveCount(0, { timeout: 25_000 });
        expectStill(during, await measure(ann), "when the hazard window closed", ["top-bar"]);
    });

}
