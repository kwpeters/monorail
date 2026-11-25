import {
    createGame, enterName, fillWithRobots, joinGame, playToGameOver, startGame
} from "./support/game.js";
import { expect, test } from "./support/fixtures.js";


test("three humans and a robot play a Quick game to the end and go back to the lobby", async ({
    openPhone
}) => {
    const names = ["Ann", "Bea", "Cy"];
    const [ann, bea, cy] = await Promise.all(names.map(async () => openPhone()));
    const phones = [ann!, bea!, cy!];
    await Promise.all(phones.map(async (page, i) => enterName(page, names[i]!)));

    await createGame(ann!);
    await joinGame(bea!, "Ann");
    await joinGame(cy!, "Ann");
    await fillWithRobots(ann!, 4);
    await startGame(ann!);

    // Only the organizer can tell the robot from the humans before the end.
    for (const joiner of [bea!, cy!]) {
        await expect(joiner.getByRole("region", { name: "Your hand" })).toBeVisible();
        await expect(joiner.locator(".robot")).toHaveCount(0);
        await expect(joiner.getByText(/robot/iu)).toHaveCount(0);
    }
    await expect(ann!.locator(".robot")).toHaveCount(1);

    await Promise.all(phones.map(async (page, i) => playToGameOver(page, names[i]!)));

    for (const page of phones) {
        await expect(page.getByRole("region", { name: "Score sheet" })).toBeVisible();
        const reveal = page.getByRole("list", { name: "Who was who" });
        await expect(reveal.getByRole("listitem")).toHaveCount(4);
        for (const name of names) {
            await expect(reveal).toContainText(`${name} was... a human!`);
        }
        await expect(reveal.getByText("was... a robot!")).toHaveCount(1);
    }

    for (const page of phones) {
        await page.getByRole("button", { name: "Back to lobby" }).tap();
        await expect(page.getByRole("heading", { name: "Lobby" })).toBeVisible();
    }
});
