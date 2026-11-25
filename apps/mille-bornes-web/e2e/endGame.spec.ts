import { createGame, enterName, fillWithRobots, joinGame, startGame } from "./support/game.js";
import { expect, test } from "./support/fixtures.js";


test("the organizer ends the game: everyone else is back in the lobby with a notice", async ({
    openPhone
}) => {
    const [ann, bea, cy] = await Promise.all([openPhone(), openPhone(), openPhone()]);
    await enterName(ann, "Ann");
    await enterName(bea, "Bea");
    await enterName(cy, "Cy");
    await createGame(ann);
    await joinGame(bea, "Ann");
    await joinGame(cy, "Ann");
    await fillWithRobots(ann, 4);
    await startGame(ann);

    await ann.getByRole("button", { name: "End game" }).tap();
    const dialog = ann.getByRole("dialog", { name: "End the game for everyone?" });
    await dialog.getByRole("button", { name: "End game" }).tap();

    for (const page of [ann, bea, cy]) {
        await expect(page.getByRole("heading", { name: "Lobby" })).toBeVisible();
    }
    for (const page of [bea, cy]) {
        const notice = page.locator(".notice");
        await expect(notice).toBeVisible();
        await expect(notice).toContainText("The organizer ended the game.");
        await notice.getByRole("button", { name: "Dismiss" }).tap();
        await expect(notice).toBeHidden();
    }
    await expect(ann.locator(".notice")).toHaveCount(0);
});
