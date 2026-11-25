import { defineConfig } from "@playwright/test";
import { phone } from "./e2e/support/phones.js";


// Every test starts its own game server (see e2e/support/fixtures.ts), so
// tests do not see each other's games.
export default defineConfig({
    testDir:     "./e2e",
    testMatch:   "**/*.spec.ts",
    globalSetup: "./e2e/support/checkBuilt.ts",
    outputDir:   "./test-results",
    timeout:     240_000,
    expect:      { timeout: 10_000 },
    forbidOnly:  true,
    retries:     0,
    workers:     2,
    reporter:    "list",
    use:         {
        ...phone,
        browserName: "chromium",
        trace:       "retain-on-failure"
    }
});
