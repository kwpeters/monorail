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
    leftDir:          z.string(),
    rightDir:         z.string(),
    actionPriority:   schemaActionPriorityString,
    includeIdentical: z.boolean(),
    includeLeftOnly:  z.boolean(),
    includeRightOnly: z.boolean(),
    includePatterns:  z.array(z.string()),
    excludePatterns:  z.array(z.string())
}).strict();


export type DiffTuiConfig = z.infer<typeof schemaDiffTuiConfig>;


/**
 * Converts IDiffTuiSettings and the two directories to the JSON-serializable
 * DiffTuiConfig shape.
 *
 * @param settings  - The current settings object
 * @param leftDir   - Absolute or relative path to the left directory
 * @param rightDir  - Absolute or relative path to the right directory
 * @returns A plain object ready for JSON serialization
 */
export function settingsToConfig(
    settings: IDiffTuiSettings,
    leftDir:  string,
    rightDir: string
): DiffTuiConfig {
    return {
        leftDir,
        rightDir,
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
 * @returns The corresponding settings
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
 * Attempts to load a difftui config from an explicit file path.
 *
 * - If the file does not exist or cannot be read, returns a failed result.
 * - If the file is invalid (parse error or schema violation), returns a failed
 *   result with an error message.
 * - If the file is valid, returns a succeeded result with the full config.
 *
 * @param filePath - Absolute path to the config file
 * @returns A Result containing the full config or an error message
 */
export function loadConfigFromFile(
    filePath: string
): Result<DiffTuiConfig, string> {
    let raw: unknown;
    try {
        const text = fs.readFileSync(filePath, "utf-8");
        raw = JSON.parse(text) as unknown;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new FailedResult(`Failed to read ${filePath}: ${msg}`);
    }

    const result = safeParse(schemaDiffTuiConfig, raw);
    if (result.failed) {
        return new FailedResult(`Invalid config file ${filePath}: ${result.error}`);
    }

    return new SucceededResult(result.value);
}


/**
 * Attempts to load difftui.json from the given directory.
 *
 * - If the file does not exist, returns a succeeded result with `undefined`.
 * - If the file exists but is invalid (parse error or schema violation),
 *   returns a failed result with an error message.
 * - If the file exists and is valid, returns a succeeded result with the full
 *   config.
 *
 * @param dir - The directory to look in (defaults to process.cwd())
 * @returns A Result containing the parsed config or undefined, or an error message
 */
export function loadConfig(
    dir: string = process.cwd()
): Result<DiffTuiConfig | undefined, string> {
    const filePath = path.join(dir, CONFIG_FILE_NAME);

    if (!fs.existsSync(filePath)) {
        return new SucceededResult(undefined);
    }

    return loadConfigFromFile(filePath);
}


/**
 * Writes the current settings and directories to difftui.json in the given
 * directory.
 *
 * @param settings  - The settings to persist
 * @param leftDir   - The left directory path to include in the config
 * @param rightDir  - The right directory path to include in the config
 * @param dir       - The directory to write the file to (defaults to
 *     process.cwd())
 * @returns A Result indicating success or an error message
 */
export function saveConfig(
    settings: IDiffTuiSettings,
    leftDir:  string,
    rightDir: string,
    dir: string = process.cwd()
): Result<void, string> {
    const filePath = path.join(dir, CONFIG_FILE_NAME);
    const config = settingsToConfig(settings, leftDir, rightDir);

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
 * Merges a loaded full config's settings over defaults, returning a complete
 * IDiffTuiSettings.  When loaded is undefined the defaults are returned.
 *
 * @param loaded   - Parsed config from file, or undefined
 * @param defaults - The baseline defaults
 * @returns The merged settings
 */
export function mergeWithDefaults(
    loaded:   DiffTuiConfig | undefined,
    defaults: IDiffTuiSettings
): IDiffTuiSettings {
    return loaded !== undefined ? configToSettings(loaded) : defaults;
}
