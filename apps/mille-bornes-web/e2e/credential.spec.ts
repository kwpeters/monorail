import { enterName } from "./support/game.js";
import { expect, test } from "./support/fixtures.js";


// Where the app keeps the credential (`credentialStorageKey`).
const storageKey = "milleBornes.credential";


test("a credential the server does not know sends the phone back to name entry", async ({
    openPhone
}) => {
    const ann = await openPhone();
    await enterName(ann, "Ann");

    // As after the server lost its sessions: the stored token is no longer good.
    await ann.evaluate((key) => {
        const saved = JSON.parse(window.localStorage.getItem(key) ?? "{}") as object;
        window.localStorage.setItem(key, JSON.stringify({ ...saved, token: "not-the-token" }));
    }, storageKey);
    await ann.reload();

    await expect(ann.getByLabel("Your name")).toBeVisible();
    expect(await ann.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBeNull();

    await enterName(ann, "Ann again");
    await expect(ann.getByText("Playing as Ann again")).toBeVisible();
    await ann.reload();
    await expect(ann.getByRole("heading", { name: "Lobby" })).toBeVisible();
});
