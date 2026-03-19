import {
    parsePatternsText,
    patternArrayToText,
    actionPriorityToString,
    stringToActionPriority,
    retainSelection,
    defaultDiffTuiSettings
} from "./diffTuiSettings.mjs";
import {
    settingsToConfig,
    configToSettings,
    mergeWithDefaults
} from "./diffTuiConfig.mjs";
import { ActionPriority, type DiffDirFileItem } from "@repo/depot-node/diffDirectories";


// ---------------------------------------------------------------------------
// parsePatternsText
// ---------------------------------------------------------------------------

describe("parsePatternsText()", () => {

    it("splits a comma-separated string into trimmed patterns", () => {
        const result = parsePatternsText("**/*.ts, **/*.js", ["**/*"]);
        expect(result).toEqual(["**/*.ts", "**/*.js"]);
    });


    it("returns defaults when the text is empty", () => {
        const result = parsePatternsText("", ["**/*"]);
        expect(result).toEqual(["**/*"]);
    });


    it("removes blank entries after splitting", () => {
        const result = parsePatternsText(",  ,", ["**/*"]);
        expect(result).toEqual(["**/*"]);
    });


    it("handles a single pattern without commas", () => {
        const result = parsePatternsText("src/**", []);
        expect(result).toEqual(["src/**"]);
    });

});


// ---------------------------------------------------------------------------
// patternArrayToText
// ---------------------------------------------------------------------------

describe("patternArrayToText()", () => {

    it("joins an array into a comma-separated string", () => {
        const result = patternArrayToText(["**/*.ts", "**/*.js"]);
        expect(result).toBe("**/*.ts, **/*.js");
    });


    it("returns an empty string for an empty array", () => {
        const result = patternArrayToText([]);
        expect(result).toBe("");
    });


    it("returns a single element without a trailing comma", () => {
        const result = patternArrayToText(["**/*"]);
        expect(result).toBe("**/*");
    });

});


// ---------------------------------------------------------------------------
// actionPriorityToString / stringToActionPriority
// ---------------------------------------------------------------------------

describe("actionPriorityToString()", () => {

    it("converts Preserve to 'preserve'", () => {
        expect(actionPriorityToString(ActionPriority.Preserve)).toBe("preserve");
    });


    it("converts SyncLeftToRight to 'sync-left-to-right'", () => {
        expect(actionPriorityToString(ActionPriority.SyncLeftToRight)).toBe("sync-left-to-right");
    });


    it("converts SyncRightToLeft to 'sync-right-to-left'", () => {
        expect(actionPriorityToString(ActionPriority.SyncRightToLeft)).toBe("sync-right-to-left");
    });

});


describe("stringToActionPriority()", () => {

    it("converts 'preserve' to Preserve", () => {
        expect(stringToActionPriority("preserve")).toBe(ActionPriority.Preserve);
    });


    it("converts 'sync-left-to-right' to SyncLeftToRight", () => {
        expect(stringToActionPriority("sync-left-to-right")).toBe(ActionPriority.SyncLeftToRight);
    });


    it("converts 'sync-right-to-left' to SyncRightToLeft", () => {
        expect(stringToActionPriority("sync-right-to-left")).toBe(ActionPriority.SyncRightToLeft);
    });


    it("falls back to Preserve for unknown strings", () => {
        expect(stringToActionPriority("unknown")).toBe(ActionPriority.Preserve);
    });

});


// ---------------------------------------------------------------------------
// retainSelection
// ---------------------------------------------------------------------------

function makeFakeItem(relativeFilePath: string): DiffDirFileItem {
    return { relativeFilePath } as unknown as DiffDirFileItem;
}


describe("retainSelection()", () => {

    it("returns -1 for an empty list", () => {
        expect(retainSelection("foo.ts", [], 0)).toBe(-1);
    });


    it("returns the exact index when the previous path is still present", () => {
        const items = [
            makeFakeItem("a.ts"),
            makeFakeItem("b.ts"),
            makeFakeItem("c.ts")
        ];
        expect(retainSelection("b.ts", items, 1)).toBe(1);
    });


    it("returns the clamped previous index when the path is gone", () => {
        const items = [
            makeFakeItem("a.ts"),
            makeFakeItem("b.ts")
        ];
        // Was at index 4, but list now only has 2 items → clamp to 1.
        expect(retainSelection("z.ts", items, 4)).toBe(1);
    });


    it("returns 0 when the path is gone and index was 0", () => {
        const items = [
            makeFakeItem("a.ts")
        ];
        expect(retainSelection("z.ts", items, 0)).toBe(0);
    });


    it("returns 0 when previousPath is undefined", () => {
        const items = [
            makeFakeItem("a.ts"),
            makeFakeItem("b.ts")
        ];
        expect(retainSelection(undefined, items, 0)).toBe(0);
    });

});


// ---------------------------------------------------------------------------
// settingsToConfig / configToSettings round-trip
// ---------------------------------------------------------------------------

describe("settingsToConfig() / configToSettings() round-trip", () => {

    it("produces a config with string actionPriority", () => {
        const config = settingsToConfig(defaultDiffTuiSettings);
        expect(config.actionPriority).toBe("preserve");
        expect(config.includeIdentical).toBe(false);
        expect(config.includeLeftOnly).toBe(true);
        expect(config.includeRightOnly).toBe(true);
        expect(config.includePatterns).toEqual(["**/*"]);
        expect(config.excludePatterns).toEqual([]);
    });


    it("round-trips all ActionPriority values", () => {
        for (const priority of Object.values(ActionPriority)) {
            const settings = { ...defaultDiffTuiSettings, actionPriority: priority };
            const config   = settingsToConfig(settings);
            const restored = configToSettings(config);
            expect(restored.actionPriority).toBe(priority);
        }
    });


    it("round-trips boolean fields", () => {
        const settings = {
            ...defaultDiffTuiSettings,
            includeIdentical: true,
            includeLeftOnly:  false,
            includeRightOnly: false
        };
        const config   = settingsToConfig(settings);
        const restored = configToSettings(config);
        expect(restored.includeIdentical).toBe(true);
        expect(restored.includeLeftOnly).toBe(false);
        expect(restored.includeRightOnly).toBe(false);
    });


    it("round-trips pattern arrays", () => {
        const settings = {
            ...defaultDiffTuiSettings,
            includePatterns: ["src/**", "lib/**"],
            excludePatterns: ["**/node_modules/**"]
        };
        const config   = settingsToConfig(settings);
        const restored = configToSettings(config);
        expect(restored.includePatterns).toEqual(["src/**", "lib/**"]);
        expect(restored.excludePatterns).toEqual(["**/node_modules/**"]);
    });

});


// ---------------------------------------------------------------------------
// mergeWithDefaults
// ---------------------------------------------------------------------------

describe("mergeWithDefaults()", () => {

    it("returns defaults when loaded is undefined", () => {
        const merged = mergeWithDefaults(undefined, defaultDiffTuiSettings);
        expect(merged).toBe(defaultDiffTuiSettings);
    });


    it("returns the loaded settings when defined", () => {
        const loaded = { ...defaultDiffTuiSettings, includeIdentical: true };
        const merged = mergeWithDefaults(loaded, defaultDiffTuiSettings);
        expect(merged).toBe(loaded);
    });

});
