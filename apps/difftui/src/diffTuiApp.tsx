import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useApp, useInput, Newline, useStdout } from "ink";
import TextInput from "ink-text-input";
import * as path from "node:path";
import {
    type DiffDirFileItem,
    FileCompareActionType,
    diffDirectories
} from "@repo/depot-node/diffDirectories";
import { showVsCodeDiff, openInVsCode } from "@repo/depot-node/vsCode";
import { Directory } from "@repo/depot-node/directory";
import { VoSet } from "@repo/depot/voSet";
import { type HashString } from "@repo/depot/hash";
import {
    type IDiffTuiSettings,
    actionPriorityToString,
    stringToActionPriority,
    patternArrayToText,
    parsePatternsText,
    retainSelection
} from "./diffTuiSettings.mjs";
import {
    type ActionChoice,
    type ExtraVsCodeAction,
    ACTIONS_PER_PAGE,
    itemChoices,
    choiceKey,
    isDestructiveChoice,
    commonChoices,
    digitToPageIndex,
    pageIndexToDigitLabel
} from "./diffTuiActions.mjs";
import { configToSettings, loadConfigFromFile, saveConfig } from "./diffTuiConfig.mjs";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppMode = "list" | "confirm" | "settings";


interface IDiffTuiAppProps {
    leftDir:         Directory;
    rightDir:        Directory;
    configFilePath:  string | undefined;
    initialSettings: IDiffTuiSettings;
}


interface IItemWithStatus {
    item:   DiffDirFileItem;
    status: string;
}


/** A pending destructive action awaiting confirmation. */
interface IPendingConfirm {
    choice: ActionChoice;
    items:  Array<IItemWithStatus>;
}


// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

function statusBadge(status: string): string {
    switch (status) {
        case "leftOnly":   return "L";
        case "rightOnly":  return "R";
        case "identical":  return "=";
        case "different":  return "≠";
        default:           return "?";
    }
}


function statusColor(status: string): string {
    switch (status) {
        case "leftOnly":   return "yellow";
        case "rightOnly":  return "cyan";
        case "identical":  return "green";
        case "different":  return "red";
        default:           return "white";
    }
}


// ---------------------------------------------------------------------------
// Item set (used for both ignored and multi-selected items)
// ---------------------------------------------------------------------------

/**
 * Creates a session-only set of diff items keyed by their relative file path.
 * Keying by path lets membership survive a refresh (which builds brand-new
 * item/File instances) and a config reload (which may repoint the compared
 * directories).
 *
 * @param initial - Items to seed the new set with
 * @returns A new VoSet keyed by relative file path
 */
function createItemSet(
    initial?: Iterable<DiffDirFileItem>
): VoSet<DiffDirFileItem> {
    // The relative file path is already a unique identity for an item, so it is
    // used directly as the hash (branded as HashString) — no risk of the hash
    // collisions a derived hash could introduce.
    return new VoSet<DiffDirFileItem>(
        (item) => item.relativeFilePath as HashString,
        initial
    );
}


// ---------------------------------------------------------------------------
// Settings panel state
// ---------------------------------------------------------------------------

interface ISettingsDraft {
    actionPriority:     string;
    includeIdentical:   boolean;
    includeLeftOnly:    boolean;
    includeRightOnly:   boolean;
    includePatternText: string;
    excludePatternText: string;
    /** Index of the currently focused field (0–5). */
    focusedField:       number;
    /** True when a text field is being edited. */
    editing:            boolean;
}


function settingsToEditorDraft(settings: IDiffTuiSettings): ISettingsDraft {
    return {
        actionPriority:     actionPriorityToString(settings.actionPriority),
        includeIdentical:   settings.includeIdentical,
        includeLeftOnly:    settings.includeLeftOnly,
        includeRightOnly:   settings.includeRightOnly,
        includePatternText: patternArrayToText(settings.includePatterns),
        excludePatternText: patternArrayToText(settings.excludePatterns),
        focusedField:       0,
        editing:            false
    };
}


function draftToSettings(draft: ISettingsDraft): IDiffTuiSettings {
    return {
        actionPriority:   stringToActionPriority(draft.actionPriority),
        includeIdentical: draft.includeIdentical,
        includeLeftOnly:  draft.includeLeftOnly,
        includeRightOnly: draft.includeRightOnly,
        includePatterns:  parsePatternsText(draft.includePatternText, ["**/*"]),
        excludePatterns:  parsePatternsText(draft.excludePatternText, [])
    };
}


const ACTION_PRIORITY_VALUES = [
    "preserve",
    "sync-left-to-right",
    "sync-right-to-left"
];

const SETTINGS_FIELD_COUNT = 6;

/**
 * Total lines consumed by fixed chrome surrounding the master/detail row:
 *   header (border + 1 content + border)             = 3
 *   footer (3 hint lines + 2 optional status lines)  = 5
 *   list scroll indicators (⬆ + ⬇, worst case)       = 2
 *                                                    ───
 *                                                     10 lines
 */
const FIXED_OVERHEAD = 10;

/** Minimum rows to show in the scrollable file list. */
const MIN_LIST_ROWS = 3;

/** Fallback terminal height when stdout.rows is unavailable or zero. */
const DEFAULT_TERMINAL_ROWS = 24;


// ---------------------------------------------------------------------------
// Main App component
// ---------------------------------------------------------------------------

/**
 * Root Ink component for the difftui command.  Manages all application state
 * and renders a master (file list) / detail (actions) view.
 */
export function DiffTuiApp({
    leftDir,
    rightDir,
    configFilePath,
    initialSettings
}: IDiffTuiAppProps): React.ReactElement {
    const { exit } = useApp();
    const { stdout } = useStdout();

    const [currentLeftDir, setCurrentLeftDir] = useState(leftDir);
    const [currentRightDir, setCurrentRightDir] = useState(rightDir);

    // Applied settings (used for the current diff list computation).
    const [appliedSettings, setAppliedSettings] = useState<IDiffTuiSettings>(initialSettings);

    // Pending settings (reflected in the settings panel, applied on 'r').
    const [pendingSettings, setPendingSettings] = useState<IDiffTuiSettings>(initialSettings);

    // The resolved diff list with statuses.
    const [items, setItems] = useState<Array<IItemWithStatus>>([]);

    // Session-only set of files the user has chosen to temporarily ignore.
    // Not persisted to the config file and not cleared on a config reload.
    const [ignored, setIgnored] = useState<VoSet<DiffDirFileItem>>(() => createItemSet());

    // Session-only set of files the user has multi-selected (via 'x').  When
    // non-empty, actions operate on every selected file rather than just the
    // highlighted one.
    const [selected, setSelected] = useState<VoSet<DiffDirFileItem>>(() => createItemSet());

    // Whether ignored files are shown (dimmed) in the list or hidden entirely.
    const [showIgnored, setShowIgnored] = useState(false);

    // Whether we're loading.
    const [loading, setLoading] = useState(true);

    // Status message shown in footer.
    const [statusMsg, setStatusMsg] = useState<string>("");

    // Currently highlighted index in the file list (the master cursor).
    const [selectedIndex, setSelectedIndex] = useState(0);

    // First visible row index for the scrollable file list.
    const [scrollOffset, setScrollOffset] = useState(0);

    // Interaction mode.
    const [mode, setMode] = useState<AppMode>("list");

    // The actions available for the current effective selection (common to all
    // selected items, or the highlighted item's actions when nothing is
    // multi-selected).
    const [choices, setChoices] = useState<Array<ActionChoice>>([]);

    // Whether keyboard focus is in the detail (action) pane.  When focused,
    // the arrow keys scroll/move within the action list instead of the file
    // list.
    const [detailFocused, setDetailFocused] = useState(false);

    // Highlighted action index (within `choices`) when the detail pane is
    // focused.
    const [actionHighlight, setActionHighlight] = useState(0);

    // First visible action index for the (paged) detail pane.
    const [actionScroll, setActionScroll] = useState(0);

    // The destructive action awaiting confirmation, if any.
    const [confirmPending, setConfirmPending] = useState<IPendingConfirm | undefined>(undefined);

    // Settings draft (editor state).
    const [settingsDraft, setSettingsDraft] = useState<ISettingsDraft>(
        () => settingsToEditorDraft(initialSettings)
    );

    // Number of visible rows the file list may occupy.
    function getListRows(): number {
        return Math.max(MIN_LIST_ROWS, (stdout.rows || DEFAULT_TERMINAL_ROWS) - FIXED_OVERHEAD);
    }

    // The list actually shown to (and navigated by) the user.  Ignored items are
    // hidden unless the "show ignored" view is enabled.  All selection, scroll
    // and action logic operates on this derived list, not the full `items`.
    const visibleItems = showIgnored ?
        items :
        items.filter((entry) => !ignored.has(entry.item));

    // The visible items the user has multi-selected.
    const selectedVisibleItems = visibleItems.filter((entry) => selected.has(entry.item));

    // True when the user is operating on a multi-selection.
    const isMultiMode = selectedVisibleItems.length > 0;

    // The items the next action will operate on: the multi-selection if any,
    // otherwise just the highlighted item.
    function getEffectiveItems(): Array<IItemWithStatus> {
        if (isMultiMode) {
            return selectedVisibleItems;
        }
        const entry = visibleItems[selectedIndex];
        return entry !== undefined ? [entry] : [];
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    const computeDiff = useCallback(async (
        settings: IDiffTuiSettings,
        diffLeftDir: Directory,
        diffRightDir: Directory,
        prevPath: string | undefined,
        prevIdx: number,
        ignoredSet: VoSet<DiffDirFileItem>,
        showIgnoredFlag: boolean
    ) => {
        setLoading(true);
        setStatusMsg("");
        try {
            const diffItems = await diffDirectories(diffLeftDir, diffRightDir, {
                includeLeftOnly:  settings.includeLeftOnly,
                includeRightOnly: settings.includeRightOnly,
                includeIdentical: settings.includeIdentical,
                includePatterns:  settings.includePatterns,
                excludePatterns:  settings.excludePatterns
            });

            const withStatus: Array<IItemWithStatus> = await Promise.all(
                diffItems.map(async (item) => {
                    const st = await item.status();
                    return { item, status: st };
                })
            );

            setItems(withStatus);

            // Selection is tracked against the visible list, so retain it
            // against the same filtering the UI applies.
            const visible = showIgnoredFlag ?
                withStatus :
                withStatus.filter((entry) => !ignoredSet.has(entry.item));
            const newIdx = retainSelection(prevPath, visible.map((entry) => entry.item), prevIdx);
            setSelectedIndex(newIdx < 0 ? 0 : newIdx);
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setStatusMsg(`Error: ${msg}`);
            setItems([]);
        }
        finally {
            setLoading(false);
        }
    }, []);


    async function refreshFromCurrentState(settings: IDiffTuiSettings): Promise<void> {
        const prevPath = visibleItems[selectedIndex]?.item.relativeFilePath;
        await computeDiff(settings, currentLeftDir, currentRightDir, prevPath, selectedIndex,
                          ignored, showIgnored);
    }


    async function refreshFromConfigFile(): Promise<void> {
        if (configFilePath === undefined) {
            await refreshFromCurrentState(draftToSettings(settingsDraft));
            return;
        }

        const configResult = loadConfigFromFile(configFilePath);
        if (configResult.failed) {
            setStatusMsg(configResult.error);
            return;
        }

        const refreshedLeftDir  = new Directory(path.resolve(configResult.value.leftDir));
        const refreshedRightDir = new Directory(path.resolve(configResult.value.rightDir));
        if (!refreshedLeftDir.existsSync()) {
            setStatusMsg(`The left directory "${refreshedLeftDir.toString()}" does not exist.`);
            return;
        }

        if (!refreshedRightDir.existsSync()) {
            setStatusMsg(`The right directory "${refreshedRightDir.toString()}" does not exist.`);
            return;
        }

        const refreshedSettings = configToSettings(configResult.value);
        setCurrentLeftDir(refreshedLeftDir);
        setCurrentRightDir(refreshedRightDir);
        setAppliedSettings(refreshedSettings);
        setPendingSettings(refreshedSettings);
        setSettingsDraft(settingsToEditorDraft(refreshedSettings));

        const prevPath = visibleItems[selectedIndex]?.item.relativeFilePath;
        await computeDiff(
            refreshedSettings,
            refreshedLeftDir,
            refreshedRightDir,
            prevPath,
            selectedIndex,
            ignored,
            showIgnored
        );
    }


    /**
     * Runs a VS Code helper action against a single file item.
     *
     * @param action - The VS Code action to run
     * @param entry - The file item to run it against
     */
    async function runVsCodeAction(action: ExtraVsCodeAction, entry: IItemWithStatus): Promise<void> {
        switch (action) {
            case "edit-left-vscode":
                await openInVsCode(entry.item.leftFile, false, true);
                break;

            case "edit-right-vscode":
                await openInVsCode(entry.item.rightFile, false, true);
                break;

            case "diff-vscode":
                if (entry.status === "leftOnly") {
                    // Diff against an empty placeholder so the missing side shows.
                    await entry.item.rightFile.write("");
                    await showVsCodeDiff(entry.item.leftFile, entry.item.rightFile, false, true);
                    const stats = entry.item.rightFile.existsSync();
                    if (stats?.size === 0) {
                        await entry.item.rightFile.delete();
                    }
                }
                else if (entry.status === "rightOnly") {
                    await entry.item.leftFile.write("");
                    await showVsCodeDiff(entry.item.leftFile, entry.item.rightFile, false, true);
                    const stats = entry.item.leftFile.existsSync();
                    if (stats?.size === 0) {
                        await entry.item.leftFile.delete();
                    }
                }
                else {
                    await showVsCodeDiff(entry.item.leftFile, entry.item.rightFile, false, true);
                }
                break;
        }
    }


    /**
     * Applies an action choice to each of the given items.  For file actions the
     * matching action is re-resolved per item (the choice only carries the
     * action type, not the bound files).
     *
     * @param choice - The action to apply
     * @param targets - The items to apply it to
     */
    async function applyChoice(choice: ActionChoice, targets: Array<IItemWithStatus>): Promise<void> {
        for (const entry of targets) {
            if (choice.kind === "file") {
                const acts = await entry.item.actions(appliedSettings.actionPriority);
                const act = acts.find((a) => a.type === choice.actionType);
                if (act !== undefined) {
                    await act.execute();
                }
            }
            else {
                await runVsCodeAction(choice.vsCodeAction, entry);
            }
        }
    }


    /**
     * Swaps the left and right directories and recomputes the diff.  File
     * statuses (left-only/right-only) flip accordingly.  The swap affects only
     * the in-memory state; it is not written back to any config file.
     */
    function swapDirectories(): void {
        const newLeft  = currentRightDir;
        const newRight = currentLeftDir;
        setCurrentLeftDir(newLeft);
        setCurrentRightDir(newRight);

        const prevPath = visibleItems[selectedIndex]?.item.relativeFilePath;
        void computeDiff(appliedSettings, newLeft, newRight, prevPath, selectedIndex,
                         ignored, showIgnored);
    }


    /**
     * Recomputes the diff after an action has run, retaining the highlighted
     * file and clearing any multi-selection.
     */
    async function refreshAfterAction(): Promise<void> {
        const prevPath = visibleItems[selectedIndex]?.item.relativeFilePath;
        if (selected.size > 0) {
            setSelected(createItemSet());
        }
        await computeDiff(appliedSettings, currentLeftDir, currentRightDir,
                          prevPath, selectedIndex, ignored, showIgnored);
    }


    /**
     * Triggers the action at the given index within the current `choices`.
     * Destructive actions enter confirmation mode; others run immediately.
     *
     * @param choiceIdx - The index into `choices`
     */
    function triggerChoice(choiceIdx: number): void {
        const choice = choices[choiceIdx];
        if (choice === undefined) {
            return;
        }
        const targets = getEffectiveItems();
        if (targets.length === 0) {
            return;
        }

        if (isDestructiveChoice(choice)) {
            setConfirmPending({ choice, items: targets });
            setMode("confirm");
            return;
        }

        void (async () => {
            await applyChoice(choice, targets);
            await refreshAfterAction();
        })();
    }


    // Initial load.
    useEffect(() => {
        void computeDiff(appliedSettings, currentLeftDir, currentRightDir, undefined, 0,
                         ignored, showIgnored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // Recompute the available actions whenever the effective selection changes.
    // Skip is excluded.  When multiple items are selected, only the actions
    // common to all of them are offered.
    useEffect(() => {
        if (mode === "settings") { return; }

        const targets = getEffectiveItems();
        if (targets.length === 0) {
            setChoices([]);
            setActionHighlight(0);
            setActionScroll(0);
            return;
        }

        let cancelled = false;
        void Promise.all(
            targets.map(async (entry) => {
                const acts = await entry.item.actions(appliedSettings.actionPriority);
                const fileTypes = acts
                .map((a) => a.type)
                .filter((t) => t !== FileCompareActionType.Skip);
                return itemChoices(fileTypes, entry.status);
            })
        ).then((perItem) => {
            if (cancelled) { return; }
            setChoices(commonChoices(perItem));
            setActionHighlight(0);
            setActionScroll(0);
        });

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIndex, items, ignored, showIgnored, selected, appliedSettings.actionPriority, mode]);


    // Scroll the file list to keep the highlighted item visible.
    useEffect(() => {
        const visCount = getListRows();
        setScrollOffset((prev) => {
            if (selectedIndex < prev) { return selectedIndex; }
            if (selectedIndex >= prev + visCount) { return selectedIndex - visCount + 1; }
            return prev;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIndex, stdout.rows]);


    // Keep the highlighted action visible within the paged detail pane.
    useEffect(() => {
        setActionScroll((prev) => {
            if (actionHighlight < prev) { return actionHighlight; }
            if (actionHighlight >= prev + ACTIONS_PER_PAGE) { return actionHighlight - ACTIONS_PER_PAGE + 1; }
            return prev;
        });
    }, [actionHighlight]);


    // After a refresh, an ignore toggle, or a view change the list may shrink;
    // clamp the scroll offset and highlighted index to the new bounds.
    useEffect(() => {
        const visCount = getListRows();
        setScrollOffset((prev) => Math.min(prev, Math.max(0, visibleItems.length - visCount)));
        setSelectedIndex((prev) => Math.min(prev, Math.max(0, visibleItems.length - 1)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visibleItems.length, stdout.rows]);


    // ---------------------------------------------------------------------------
    // Keyboard handling
    // ---------------------------------------------------------------------------

    useInput((input, key) => {

        // -----------------------------------------------------------------------
        // Settings panel mode
        // -----------------------------------------------------------------------
        if (mode === "settings") {
            if (settingsDraft.editing) {
                // Text editing is delegated to ink-text-input; only handle
                // Escape here to cancel and finish the edit.
                if (key.escape) {
                    setSettingsDraft((d) => ({ ...d, editing: false }));
                }
                return;
            }

            if (key.escape || input === "c") {
                setMode("list");
                return;
            }

            if (key.upArrow) {
                setSettingsDraft((d) => ({
                    ...d,
                    focusedField: (d.focusedField - 1 + SETTINGS_FIELD_COUNT) % SETTINGS_FIELD_COUNT
                }));
                return;
            }

            if (key.downArrow || key.tab) {
                setSettingsDraft((d) => ({
                    ...d,
                    focusedField: (d.focusedField + 1) % SETTINGS_FIELD_COUNT
                }));
                return;
            }

            // Enter on focused field.
            if (key.return) {
                const f = settingsDraft.focusedField;
                if (f === 0) {
                    // Cycle action priority.
                    setSettingsDraft((d) => {
                        const idx = ACTION_PRIORITY_VALUES.indexOf(d.actionPriority);
                        const next = ACTION_PRIORITY_VALUES[(idx + 1) % ACTION_PRIORITY_VALUES.length]!;
                        return { ...d, actionPriority: next };
                    });
                }
                else if (f === 1) {
                    setSettingsDraft((d) => ({ ...d, includeIdentical: !d.includeIdentical }));
                }
                else if (f === 2) {
                    setSettingsDraft((d) => ({ ...d, includeLeftOnly: !d.includeLeftOnly }));
                }
                else if (f === 3) {
                    setSettingsDraft((d) => ({ ...d, includeRightOnly: !d.includeRightOnly }));
                }
                else if (f === 4 || f === 5) {
                    // Begin editing text field.
                    setSettingsDraft((d) => ({ ...d, editing: true }));
                }
                return;
            }

            // Swap the left and right directories.
            if (input === "w") {
                swapDirectories();
                return;
            }

            // OK – apply settings and close.
            if (input === "o") {
                const newSettings = draftToSettings(settingsDraft);
                setPendingSettings(newSettings);
                setAppliedSettings(newSettings);
                setMode("list");
                void refreshFromCurrentState(newSettings);
                return;
            }

            return;
        }

        // -----------------------------------------------------------------------
        // Confirmation mode
        // -----------------------------------------------------------------------
        if (mode === "confirm") {
            if (input === "y" || input === "Y") {
                const pending = confirmPending;
                setMode("list");
                setConfirmPending(undefined);
                if (pending !== undefined) {
                    void (async () => {
                        await applyChoice(pending.choice, pending.items);
                        await refreshAfterAction();
                    })();
                }
            }
            else {
                setStatusMsg("Cancelled.");
                setConfirmPending(undefined);
                setMode("list");
            }
            return;
        }

        // -----------------------------------------------------------------------
        // List / master-detail mode (default)
        // -----------------------------------------------------------------------
        if (loading) { return; }

        if (input === "q") {
            exit();
            return;
        }

        if (input === "s") {
            setSettingsDraft(settingsToEditorDraft(pendingSettings));
            setMode("settings");
            return;
        }

        if (input === "r") {
            if (configFilePath !== undefined) {
                void refreshFromConfigFile();
                return;
            }

            const newSettings = draftToSettings(settingsDraft);
            setAppliedSettings(newSettings);
            setPendingSettings(newSettings);
            void refreshFromCurrentState(newSettings);
            return;
        }

        if (key.ctrl && input === "e") {
            const result = saveConfig(
                appliedSettings,
                currentLeftDir.toString(),
                currentRightDir.toString()
            );
            if (result.failed) {
                setStatusMsg(`Export failed: ${result.error}`);
            }
            else {
                setStatusMsg("Config exported to difftui.json");
            }
            return;
        }

        // Toggle ignore on the highlighted file.
        if (input === "i") {
            const entry = visibleItems[selectedIndex];
            if (entry !== undefined) {
                const wasIgnored = ignored.has(entry.item);
                const next = createItemSet(ignored);
                if (wasIgnored) {
                    next.delete(entry.item);
                }
                else {
                    next.add(entry.item);
                }
                setIgnored(next);
                setStatusMsg(
                    wasIgnored ?
                        `No longer ignoring ${entry.item.relativeFilePath}` :
                        `Ignoring ${entry.item.relativeFilePath}`
                );
            }
            return;
        }

        // Toggle whether ignored files are shown (dimmed) in the list.
        if (input === "I") {
            setShowIgnored((prev) => !prev);
            return;
        }

        // Un-ignore all files.
        if (input === "u") {
            const count = ignored.size;
            if (count > 0) {
                setIgnored(createItemSet());
                setStatusMsg(`Un-ignored ${count} file${count === 1 ? "" : "s"}.`);
            }
            return;
        }

        // Toggle multi-selection on the highlighted file (Gmail-style 'x').
        if (input === "x") {
            const entry = visibleItems[selectedIndex];
            if (entry !== undefined) {
                const wasSelected = selected.has(entry.item);
                const next = createItemSet(selected);
                if (wasSelected) {
                    next.delete(entry.item);
                }
                else {
                    next.add(entry.item);
                }
                setSelected(next);
            }
            return;
        }

        // Number keys run the corresponding action (1–9, then 0 for the tenth).
        const pageIdx = digitToPageIndex(input);
        if (pageIdx !== undefined) {
            triggerChoice(actionScroll + pageIdx);
            return;
        }

        // Tab moves focus between the file list and the action pane.
        if (key.tab) {
            setDetailFocused((prev) => !prev);
            return;
        }

        // Arrow keys navigate either the action pane or the file list,
        // depending on focus.
        if (detailFocused) {
            if (key.escape) {
                setDetailFocused(false);
                return;
            }
            if (key.upArrow && choices.length > 0) {
                setActionHighlight((i) => Math.max(0, i - 1));
                return;
            }
            if (key.downArrow && choices.length > 0) {
                setActionHighlight((i) => Math.min(choices.length - 1, i + 1));
                return;
            }
            if (key.return && choices.length > 0) {
                triggerChoice(actionHighlight);
                return;
            }
            return;
        }

        if (key.upArrow && visibleItems.length > 0) {
            setSelectedIndex((i) => Math.max(0, i - 1));
            return;
        }

        if (key.downArrow && visibleItems.length > 0) {
            setSelectedIndex((i) => Math.min(visibleItems.length - 1, i + 1));
            return;
        }
    });


    // ---------------------------------------------------------------------------
    // Render helpers
    // ---------------------------------------------------------------------------

    function renderHeader(): React.ReactElement {
        return (
            <Box borderStyle="single" paddingX={1}>
                <Text bold color="blue">difftui  </Text>
                <Text dimColor>{currentLeftDir.toString()}</Text>
                <Text bold color="blue"> ↔ </Text>
                <Text dimColor>{currentRightDir.toString()}</Text>
            </Box>
        );
    }


    function renderFileList(): React.ReactElement {
        if (loading) {
            return (
                <Box paddingX={2} paddingY={1}>
                    <Text color="yellow">Loading…</Text>
                </Box>
            );
        }

        if (items.length === 0) {
            return (
                <Box paddingX={2} paddingY={1}>
                    <Text dimColor>No matching files. Press </Text>
                    <Text bold>s</Text>
                    <Text dimColor> to change settings and </Text>
                    <Text bold>r</Text>
                    <Text dimColor> to refresh.</Text>
                </Box>
            );
        }

        if (visibleItems.length === 0) {
            return (
                <Box paddingX={2} paddingY={1}>
                    <Text dimColor>All {items.length} matching file{items.length === 1 ? " is" : "s are"} ignored. Press </Text>
                    <Text bold>I</Text>
                    <Text dimColor> to show them or </Text>
                    <Text bold>u</Text>
                    <Text dimColor> to un-ignore all.</Text>
                </Box>
            );
        }

        const visCount = getListRows();
        const hasAbove = scrollOffset > 0;
        const hasBelow = scrollOffset + visCount < visibleItems.length;
        const pageItems = visibleItems.slice(scrollOffset, scrollOffset + visCount);

        return (
            <Box flexDirection="column">
                {hasAbove && (
                    <Box paddingX={1}>
                        <Text dimColor>⬆ {scrollOffset} more above</Text>
                    </Box>
                )}
                {pageItems.map((entry, relIdx) => {
                    const idx = scrollOffset + relIdx;
                    const isHighlighted = idx === selectedIndex;
                    const isChecked = selected.has(entry.item);
                    const isIgnored = ignored.has(entry.item);
                    const badge = statusBadge(entry.status);
                    const color = statusColor(entry.status);
                    return (
                        <Box key={entry.item.relativeFilePath} paddingX={1}>
                            <Text {...(isHighlighted ? { color: "blue" as const } : {})} bold={isHighlighted}>
                                {isHighlighted ? "▶" : " "}
                            </Text>
                            <Text color="green">{isChecked ? "✓" : " "} </Text>
                            <Text color={color} dimColor={isIgnored}>[{badge}] </Text>
                            <Text
                                color={isHighlighted ? "white" as const : "gray" as const}
                                bold={isHighlighted}
                                dimColor={isIgnored}>
                                {entry.item.relativeFilePath}
                            </Text>
                            {isIgnored && <Text dimColor> (ignored)</Text>}
                        </Box>
                    );
                })}
                {hasBelow && (
                    <Box paddingX={1}>
                        <Text dimColor>⬇ {visibleItems.length - scrollOffset - visCount} more below</Text>
                    </Box>
                )}
            </Box>
        );
    }


    function renderDetailSummary(): React.ReactElement {
        if (isMultiMode) {
            // Summarize the multi-selection by status.
            const counts = new Map<string, number>();
            for (const entry of selectedVisibleItems) {
                counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
            }
            const breakdown = [...counts.entries()]
            .map(([status, n]) => `${n} ${status}`)
            .join(", ");

            return (
                <Box flexDirection="column">
                    <Text bold>{selectedVisibleItems.length} files selected</Text>
                    {breakdown.length > 0 && <Text dimColor>{breakdown}</Text>}
                </Box>
            );
        }

        const entry = visibleItems[selectedIndex];
        if (entry === undefined) {
            return <Text dimColor>No selection.</Text>;
        }

        const badge = statusBadge(entry.status);
        const color = statusColor(entry.status);
        const isIgnored = ignored.has(entry.item);

        return (
            <Box flexDirection="column">
                <Text bold>Selected ({selectedIndex + 1} of {visibleItems.length}):</Text>
                <Text>{entry.item.relativeFilePath}{isIgnored ? " (ignored)" : ""}</Text>
                <Text color={color}>Status: [{badge}] {entry.status}</Text>
            </Box>
        );
    }


    function renderActionList(): React.ReactElement {
        if (choices.length === 0) {
            return <Text dimColor>  (no actions available)</Text>;
        }

        const hasAbove = actionScroll > 0;
        const hasBelow = actionScroll + ACTIONS_PER_PAGE < choices.length;
        const page = choices.slice(actionScroll, actionScroll + ACTIONS_PER_PAGE);

        return (
            <Box flexDirection="column">
                {hasAbove && <Text dimColor>  ⬆ more</Text>}
                {page.map((choice, relIdx) => {
                    const absIdx = actionScroll + relIdx;
                    const digit = pageIndexToDigitLabel(relIdx);
                    const isHighlighted = detailFocused && absIdx === actionHighlight;
                    return (
                        <Box key={choiceKey(choice)}>
                            <Text {...(isHighlighted ? { color: "blue" as const } : {})}
                                bold={isHighlighted}>
                                {isHighlighted ? "▶ " : "  "}{digit}. {choice.label}
                            </Text>
                        </Box>
                    );
                })}
                {hasBelow && <Text dimColor>  ⬇ more</Text>}
            </Box>
        );
    }


    function renderDetailPane(): React.ReactElement {
        if (mode === "confirm" && confirmPending !== undefined) {
            const count = confirmPending.items.length;
            const target = count === 1 ? "1 file" : `${count} files`;
            return (
                <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="single">
                    <Text bold color="yellow">Confirm: {confirmPending.choice.label}</Text>
                    <Text dimColor>Applies to {target}.</Text>
                    <Newline />
                    <Text>Press <Text bold color="green">y</Text> to confirm, any other key to cancel.</Text>
                </Box>
            );
        }

        return (
            <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="single"
                {...(detailFocused ? { borderColor: "blue" as const } : {})}>
                {renderDetailSummary()}
                <Newline />
                <Text bold>Actions:</Text>
                {renderActionList()}
                <Newline />
                <Text dimColor>[1-0] Run  [Tab] Focus actions</Text>
            </Box>
        );
    }


    function renderSettingsPanel(): React.ReactElement {
        const fields = [
            {
                label: "Action Priority",
                value: settingsDraft.actionPriority,
                type:  "cycle" as const
            },
            {
                label: "Include Identical",
                value: settingsDraft.includeIdentical ? "yes" : "no",
                type:  "bool" as const
            },
            {
                label: "Include Left Only",
                value: settingsDraft.includeLeftOnly ? "yes" : "no",
                type:  "bool" as const
            },
            {
                label: "Include Right Only",
                value: settingsDraft.includeRightOnly ? "yes" : "no",
                type:  "bool" as const
            },
            {
                label: "Include Patterns",
                value: settingsDraft.includePatternText,
                type:  "text" as const
            },
            {
                label: "Exclude Patterns",
                value: settingsDraft.excludePatternText,
                type:  "text" as const
            }
        ];

        return (
            <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="single">
                <Text bold color="cyan">Settings</Text>
                <Newline />
                <Box>
                    <Text bold>Left:  </Text>
                    <Text dimColor>{currentLeftDir.absPath()}</Text>
                </Box>
                <Box>
                    <Text bold>Right: </Text>
                    <Text dimColor>{currentRightDir.absPath()}</Text>
                </Box>
                <Newline />
                {fields.map((field, idx) => {
                    const isFocused = idx === settingsDraft.focusedField;
                    const isEditing = isFocused && settingsDraft.editing;
                    const textValue = idx === 4
                        ? settingsDraft.includePatternText
                        : settingsDraft.excludePatternText;

                    return (
                        <Box key={field.label} marginBottom={0}>
                            <Text bold={isFocused} {...(isFocused ? { color: "cyan" as const } : {})}>
                                {isFocused ? "▶ " : "  "}
                                {field.label}:{" "}
                            </Text>
                            {isEditing && (idx === 4 || idx === 5) ? (
                                <TextInput
                                    value={textValue}
                                    onChange={(val: string) => {
                                        if (idx === 4) {
                                            setSettingsDraft((d) => ({ ...d, includePatternText: val }));
                                        }
                                        else {
                                            setSettingsDraft((d) => ({ ...d, excludePatternText: val }));
                                        }
                                    }}
                                    onSubmit={() => {
                                        setSettingsDraft((d) => ({ ...d, editing: false }));
                                    }}
                                />
                            ) : (
                                <Text color={isFocused ? "white" : "gray"}>{field.value}</Text>
                            )}
                        </Box>
                    );
                })}
                <Newline />
                <Text dimColor>[↑↓] Navigate  [Enter] Toggle/Edit  [w] Swap dirs</Text>
                <Text dimColor>[Esc/c] Cancel  [o] OK</Text>
            </Box>
        );
    }


    function renderFooter(): React.ReactElement {
        return (
            <Box flexDirection="column" paddingX={1}>
                {statusMsg.length > 0 && (
                    <Text color="yellow">{statusMsg}</Text>
                )}
                {(ignored.size > 0 || selected.size > 0) && (
                    <Text color="magenta">
                        {selected.size > 0 ? `${selected.size} selected  ` : ""}
                        {ignored.size > 0 ? `${ignored.size} ignored${showIgnored ? " (shown)" : " (hidden)"}` : ""}
                    </Text>
                )}
                <Text dimColor>
                    [↑↓] Move  [x] Select  [Tab] Focus actions
                </Text>
                <Text dimColor>
                    [i] Ignore  [I] Show ignored  [u] Un-ignore all
                </Text>
                <Text dimColor>
                    [s] Settings  [r] Refresh  [Ctrl+E] Export  [q] Quit
                </Text>
            </Box>
        );
    }


    // ---------------------------------------------------------------------------
    // Main render
    // ---------------------------------------------------------------------------

    return (
        <Box flexDirection="column">
            {renderHeader()}
            {mode === "settings" ? renderSettingsPanel() : (
                <Box flexDirection="row">
                    <Box flexDirection="column" width="50%">
                        {renderFileList()}
                    </Box>
                    <Box flexDirection="column" width="50%">
                        {renderDetailPane()}
                    </Box>
                </Box>
            )}
            {renderFooter()}
        </Box>
    );
}
