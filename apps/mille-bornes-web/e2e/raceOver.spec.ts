import {
    createGame, enterName, fillWithRobots, hand, playToGameOver, startGame
} from "./support/game.js";
import { expect, test } from "./support/fixtures.js";


// The real NextRace timer, long enough to read the sheet; the other timings
// stay fast.
test.use({ serverEnv: { MB_RACE_OVER_PAUSE_MS: "3000" } });


test("between races the score sheet and the countdown show, then the next race is dealt", async ({
    openPhone
}) => {
    test.setTimeout(300_000);
    const ann = await openPhone();
    await enterName(ann, "Ann");
    await createGame(ann);
    // Full, not Short: a Short game can end with its first race, and then no
    // race-over sheet ever shows.
    await ann.getByRole("button", { name: "Full" }).tap();
    await expect(ann.getByRole("button", { name: /Full/u }))
    .toHaveAttribute("aria-pressed", "true");
    await fillWithRobots(ann, 4);
    await startGame(ann);

    // Watched while the phone plays: the sheet shows for 3 s only.
    const betweenRaces = (async (): Promise<void> => {
        await expect(ann.getByRole("heading", { name: "Race over" })).toBeVisible({
            timeout: 120_000
        });
        const sheet = ann.getByRole("region", { name: "Score sheet" });
        await expect(sheet.locator("thead .score-team")).toHaveCount(2, { timeout: 2000 });
        await expect(ann.getByRole("timer")).toHaveText(/^Next race in \d s$/u, { timeout: 2000 });
        // The next race comes over the stream onto the same page: a new hand.
        await expect(hand(ann).locator("[data-card]").first()).toBeVisible({ timeout: 10_000 });
        await expect(ann.getByRole("heading", { name: "Race over" })).toHaveCount(0);
        expect(await hand(ann).locator("[data-card]").count()).toBeGreaterThanOrEqual(6);
    })();
    // Awaited below; until then a failure must not count as unhandled.
    betweenRaces.catch(() => undefined);

    await playToGameOver(ann, "Ann", { timeoutMs: 240_000 });
    await betweenRaces;
    await expect(ann.getByRole("list", { name: "Who was who" }).getByRole("listitem"))
    .toHaveCount(4);
});
