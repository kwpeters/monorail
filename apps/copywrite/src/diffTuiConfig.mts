import * as path from "node:path";
import * as fs from "node:fs";
import * as z from "zod";
import { safeParse } from "@repo/depot/zodHelpers";
import { FailedResult, SucceededResult, type Result } from "@repo/depot/result";
import {
    type IDiffTuiSettings,
    stringToActionPriority,
    actionPriorityToString
} from "./diffTuiSettings.mjs";


/** Name of the config file read from / written to the working directory. */
export const CONFIG_FILE_NAME = "difftui.json";


const schemaActionPriorityString = z.enum([
    "preserve",
    "sync-left-to-right",
    "sync-right-to-left"
]);


/**
 * Strict Zod schema for the difftui.json config file.  Unknown keys are
 * rejected via .strict() so that typos are caught at load time.
 */
export const schemaDiffTuiConfig = z.object({
    actionPriority:   schemaActionPriorityString,
    includeIdentical: z.boolean(),
    includeLeftOnly:  z.boolean(),
    includeRightOnly: z.boolean(),
    includePatterns:  z.array(z.string()),
    excludePatterns:  z.array(z.string())
}).strict();


export type DiffTuiConfig = z.infer<typeof schemaDiffTuiConfig>;


/**
 * Converts IDiffTuiSettings to the JSON-serializable DiffTuiConfig shape.
 *
 * @param settings - The current settings object
 * @return A plain object ready for JSON serialization
 */
export function settingsToConfig(settings: IDiffTuiSettings): DiffTuiConfig {
    return {
        actionPriority:   actionPriorityToString(settings.actionPriority),
        includeIdentical: settings.includeIdentical,
        includeLeftOnly:  settings.includeLeftOnly,
        includeRightOnly: settings.includeRightOnly,
        includePatterns:  settings.includePatterns,
        excludePatterns:  settings.excludePatterns
    };
}


/**
 * Converts a parsed DiffTuiConfig back to IDiffTuiSettings.
 *
 * @param config - The parsed config object
 * @return The corresponding settings
 */
export function configToSettings(config: DiffTuiConfig): IDiffTuiSettings {
    return {
        actionPriority:   stringToActionPriority(config.actionPriority),
        includeIdentical: config.includeIdentical,
        includeLeftOnly:  config.includeLeftOnly,
        includeRightOnly: config.includeRightOnly,
        includePatterns:  config.includePatterns,
        excludePatterns:  config.excludePatterns
    };
}


/**
 * Attempts to load difftui.json from the given directory.
 *
 * - If the file does not exist, returns a succeeded result with `undefined`.
 * - If the file exists but is invalid (parse error or schema violation),
 *   returns a failed result with an error message.
 * - If the file exists and is valid, returns a succeeded result with the
 *   parsed settings.
 *
 * @param dir - The directory to look in (defaults to process.cwd())
 * @return A Result containing the parsed settings or undefined, or an error
 *     message
 */
export function loadConfig(
    dir: string = process.cwd()
): Result<IDiffTuiSettings | undefined, string> {
    const filePath = path.join(dir, CONFIG_FILE_NAME);

    if (!fs.existsSync(filePath)) {
        return new SucceededResult(undefined);
    }

    let raw: unknown;
    try {
        const text = fs.readFileSync(filePath, "utf-8");
        raw = JSON.parse(text) as unknown;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new FailedResult(`Failed to parse ${CONFIG_FILE_NAME}: ${msg}`);
    }

    const result = safeParse(schemaDiffTuiConfig, raw);
    if (result.failed) {
        return new FailedResult(
            `Invalid ${CONFIG_FILE_NAME}: ${result.error}`
        );
    }

    return new SucceededResult(configToSettings(result.value));
}


/**
 * Writes the current settings to difftui.json in the given directory.
 *
 * @param settings - The settings to persist
 * @param dir - The directory to write to (defaults to process.cwd())
 * @return A Result indicating success or an error message
 */
export function saveConfig(
    settings: IDiffTuiSettings,
    dir: string = process.cwd()
): Result<void, string> {
    const filePath = path.join(dir, CONFIG_FILE_NAME);
    const config = settingsToConfig(settings);

    try {
        fs.writeFileSync(filePath, JSON.stringify(config, null, 4) + "\n", "utf-8");
        return new SucceededResult(undefined);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new FailedResult(`Failed to write ${CONFIG_FILE_NAME}: ${msg}`);
    }
}


/**
 * Merges loaded config settings over defaults, returning a complete
 * IDiffTuiSettings.  When loaded is undefined the defaults are returned.
 *
 * @param loaded - Settings from config file, or undefined
 * @param defaults - The baseline defaults
 * @return The merged settings
 */
export function mergeWithDefaults(
    loaded:   IDiffTuiSettings | undefined,
    defaults: IDiffTuiSettings
): IDiffTuiSettings {
    return loaded ?? defaults;
}
