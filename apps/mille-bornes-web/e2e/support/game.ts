import { expect, type Locator, type Page } from "@playwright/test";


/** How long one phone may take to play a whole Quick game. */
export const gameTimeoutMs = 150_000;


/**
 * Enters a name on the name entry screen and waits for the lobby.
 * @param page - A phone showing name entry
 * @param name - The name to type
 * @returns Once the lobby shows
 */
export async function enterName(page: Page, name: string): Promise<void> {
    await page.getByLabel("Your name").fill(name);
    await page.getByRole("button", { name: "Join", exact: true }).tap();
    await expect(page.getByRole("heading", { name: "Lobby" })).toBeVisible();
}


/**
 * Starts a new game from the lobby and waits for the organizer's room.
 * @param page - A phone in the lobby
 * @returns Once the organizer's waiting room shows
 */
export async function createGame(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Start a new game" }).tap();
    await expect(page.getByRole("heading", { name: "Your game" })).toBeVisible();
}


/**
 * Joins the game of the named organizer and waits for the waiting room.
 * @param page - A phone in the lobby
 * @param organizer - The organizer's name
 * @returns Once the joiner's waiting room shows
 */
export async function joinGame(page: Page, organizer: string): Promise<void> {
    await page.getByRole("button", { name: `Join ${organizer}'s game`, exact: true }).tap();
    await expect(page.getByRole("heading", { name: "Waiting room" })).toBeVisible();
}


/**
 * Adds robots until the game has the given number of seats.
 * @param page - The organizer's phone in the waiting room
 * @param seats - The number of seats wanted
 * @returns Once the room shows that many seats
 */
export async function fillWithRobots(page: Page, seats: number): Promise<void> {
    const shown = page.locator(".team-seat");
    for (let n = await shown.count(); n < seats; n++) {
        await page.getByRole("button", { name: "Add a robot" }).tap();
        await expect(shown).toHaveCount(n + 1);
    }
}


/**
 * Starts the game (Quick, the default length) and waits for the table.
 * @param page - The organizer's phone in the waiting room
 * @returns Once the table shows
 */
export async function startGame(page: Page): Promise<void> {
    await page.getByRole("button", { name: "Start game" }).tap();
    await expect(hand(page)).toBeVisible();
}


/**
 * Gets a phone's hand.
 * @param page - A phone at the table
 * @returns The hand region
 */
export function hand(page: Page): Locator {
    return page.getByRole("region", { name: "Your hand" });
}


/**
 * Reads the cards in a phone's hand.
 * @param page - A phone at the table
 * @returns The cards' values, in hand order
 */
export async function handCards(page: Page): Promise<Array<string>> {
    return hand(page).locator("[data-card]")
    .evaluateAll((cards) => cards.map((c) => c.getAttribute("data-card") ?? ""));
}


/**
 * Gets the top bar's text.
 * @param page - A phone at the table
 * @returns The text, or "" when there is no top bar
 */
async function topBarText(page: Page): Promise<string> {
    const bar = page.locator(".top-bar");
    return await bar.count() === 0 ? "" : (await bar.textContent()) ?? "";
}


/**
 * Waits until it is the phone's turn.  With only robots to wait for, its hand
 * then stays as it is until it plays.
 * @param page - A phone at the table
 * @returns Once the top bar says it is its turn
 */
export async function untilMyTurn(page: Page): Promise<void> {
    await expect(page.locator(".top-bar")).toHaveText(/^Your turn/u, { timeout: 20_000 });
}


/**
 * Tells whether it is the player's turn.  The top bar says so, unless it is
 * showing why a card cannot be played (for 3 s, which can outlast a round of
 * fast robots); the player's chip on the table is marked either way.
 * @param page - A phone at the table
 * @param name - The player's name
 * @returns True on the player's turn
 */
async function isMyTurn(page: Page, name: string): Promise<boolean> {
    if ((await topBarText(page)).startsWith("Your turn")) {
        return true;
    }
    const onTurn = await page.locator(".player.on-turn .truncate").allTextContents();
    return onTurn.includes(name);
}


/** Looks at the table at a moment of the game (a card picked up, an offer). */
export type OnPicked = (page: Page) => Promise<void>;


/**
 * Takes one turn through the visible UI: the first card that is not dimmed,
 * then its Play or lane button, else Discard; with every card dimmed, the
 * first card is discarded.
 * @param page - A phone whose top bar says it is its turn
 * @param onPicked - Called once the card is picked up
 * @returns Once the play has been sent
 */
async function takeTurn(page: Page, onPicked: OnPicked): Promise<void> {
    const before = await topBarText(page);
    const handBefore = await handCards(page);
    const cards = hand(page).locator("button.card-button");
    const dimmed = await cards.evaluateAll((all) => {
        return all.map((c) => c.getAttribute("aria-disabled") === "true");
    });
    const first = dimmed.indexOf(false);
    const discardOnly = first < 0;
    const card = cards.nth(discardOnly ? 0 : first);
    // Playwright counts aria-disabled as disabled, but the app keeps a dimmed
    // card tappable on purpose: it explains itself and can be discarded.
    await card.tap({ force: discardOnly, timeout: 2000 });
    await expect(card).toHaveAttribute("aria-pressed", "true", { timeout: 2000 });
    await onPicked(page);

    const play = hand(page).getByRole("button", { name: "Play", exact: true });
    const lanes = page.getByRole("button", { name: /^Play on Team \d$/u });
    const discard = page.getByRole("button", { name: "Discard", exact: true });
    const target = !discardOnly && await play.isVisible() ? play :
        !discardOnly && await lanes.count() > 0 ? lanes.first() : discard;
    await target.tap({ timeout: 2000 });

    // The next screen moves the turn on, or changes the hand (a safety gives
    // another turn).  Until it comes, the old screen must not be played.
    await expect.poll(async () => {
        const now = await topBarText(page);
        const cardsNow = await handCards(page);
        return now !== before || JSON.stringify(cardsNow) !== JSON.stringify(handBefore);
    }, { timeout: 3000 }).toBe(true).catch(() => undefined);
}


/**
 * Plays a phone through to the end of the game using only what is on its
 * screen: it takes its turns (see `takeTurn`), stops at an Extension offer,
 * and waits out hazard windows and other players' turns.  A step that fails
 * because the screen moved on is tried again, so `onPicked` should record
 * what it finds rather than throw.
 * @param page - A phone at the table
 * @param name - The player's name: the table marks their turn with it, and a
 * failure message names the phone with it
 * @param options - How long the game may take (default `gameTimeoutMs`), what
 * to do each time a card is picked up, and what to do when an Extension offer
 * shows (before Stop here is tapped)
 * @returns Once the phone shows Back to lobby
 */
export async function playToGameOver(
    page:    Page,
    name:    string,
    options: { timeoutMs?: number; onPicked?: OnPicked; onOffer?: OnPicked } = {}
): Promise<void> {
    const nothing = async (): Promise<void> => Promise.resolve();
    const { timeoutMs = gameTimeoutMs, onPicked = nothing, onOffer = nothing } = options;
    const deadline = Date.now() + timeoutMs;
    const backToLobby = page.getByRole("button", { name: "Back to lobby" });
    const stopHere = page.getByRole("button", { name: "Stop here" });
    let turns = 0;
    let lastError = "none";
    while (!(await backToLobby.isVisible())) {
        if (Date.now() > deadline) {
            throw new Error(`${name}: the game did not end within ${timeoutMs.toString()} ms ` +
                `after ${turns.toString()} turns; the top bar says "${await topBarText(page)}"; ` +
                `the last failed step: ${lastError}`);
        }
        try {
            if (await stopHere.isVisible()) {
                await onOffer(page);
                await stopHere.tap({ timeout: 2000 });
            }
            else if (await isMyTurn(page, name)) {
                await takeTurn(page, onPicked);
                turns++;
            }
            else {
                await page.waitForTimeout(50);
            }
        }
        catch (err) {
            // The screen moved on under a step (a turn passed, a window
            // opened); the next round looks again.
            lastError = err instanceof Error ? err.message.split("\n")[0] ?? "" : String(err);
        }
    }
}
