import { ActionPriority, type DiffDirFileItem } from "@repo/depot-node/diffDirectories";


/**
 * The interactive settings for the difftui command.  These are applied only
 * on an explicit refresh; changing them in the UI does not immediately
 * recompute the file list.
 */
export interface IDiffTuiSettings {
    actionPriority:   ActionPriority;
    includeIdentical: boolean;
    includeLeftOnly:  boolean;
    includeRightOnly: boolean;
    includePatterns:  Array<string>;
    excludePatterns:  Array<string>;
}


/**
 * The default settings, matching the existing diff command's defaults.
 */
export const defaultDiffTuiSettings: IDiffTuiSettings = {
    actionPriority:   ActionPriority.Preserve,
    includeIdentical: false,
    includeLeftOnly:  true,
    includeRightOnly: true,
    includePatterns:  ["**/*"],
    excludePatterns:  []
};


/**
 * Converts an ActionPriority value to its CLI/config string representation.
 *
 * @param priority - The ActionPriority to convert
 * @return The string representation used in config and display
 */
export function actionPriorityToString(
    priority: ActionPriority
): "preserve" | "sync-left-to-right" | "sync-right-to-left" {
    switch (priority) {
        case ActionPriority.SyncLeftToRight: return "sync-left-to-right";
        case ActionPriority.SyncRightToLeft: return "sync-right-to-left";
        case ActionPriority.Preserve:        return "preserve";
    }
}


/**
 * Converts a config/CLI string to an ActionPriority.
 *
 * @param value - The string to parse
 * @return The corresponding ActionPriority, or Preserve if unrecognized
 */
export function stringToActionPriority(value: string): ActionPriority {
    if (value === "sync-left-to-right") { return ActionPriority.SyncLeftToRight; }
    if (value === "sync-right-to-left") { return ActionPriority.SyncRightToLeft; }
    return ActionPriority.Preserve;
}


/**
 * Parses a comma-separated pattern string into an array of trimmed patterns.
 * Empty entries are removed.
 *
 * @param text - Comma-separated pattern string
 * @param defaults - Fallback patterns when text yields no patterns
 * @return An array of patterns
 */
export function parsePatternsText(text: string, defaults: Array<string>): Array<string> {
    const patterns = text
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
    return patterns.length > 0 ? patterns : defaults;
}


/**
 * Joins a pattern array into a comma-separated string for display in the
 * settings panel.
 *
 * @param patterns - Array of patterns
 * @return A comma-separated string
 */
export function patternArrayToText(patterns: Array<string>): string {
    return patterns.join(", ");
}


/**
 * Given a previously selected relative file path and a refreshed list of diff
 * items, returns the index of the best item to keep selected.
 *
 * Selection retention rules:
 * 1. If the previously selected path still exists in the new list, return its
 *    index.
 * 2. Otherwise return the index just before the old position clamped to the
 *    new list's valid range, or 0 for an empty list.
 *
 * @param previousPath - The previously selected relative file path, or
 *     undefined if nothing was selected
 * @param newItems - The refreshed list of diff items
 * @param previousIndex - The zero-based index that was selected before refresh
 * @return The new selection index, or -1 when the new list is empty
 */
export function retainSelection(
    previousPath:  string | undefined,
    newItems:      ReadonlyArray<DiffDirFileItem>,
    previousIndex: number
): number {
    if (newItems.length === 0) {
        return -1;
    }

    // Exact match: same path still present.
    if (previousPath !== undefined) {
        const exactIdx = newItems.findIndex(
            (item) => item.relativeFilePath === previousPath
        );
        if (exactIdx >= 0) {
            return exactIdx;
        }
    }

    // Nearest-next fallback: clamp previous index to new list bounds.
    const clampedIdx = Math.min(previousIndex, newItems.length - 1);
    return Math.max(0, clampedIdx);
}
