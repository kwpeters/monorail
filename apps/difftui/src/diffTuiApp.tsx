import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useApp, useInput, Newline, useStdout } from "ink";
import TextInput from "ink-text-input";
import * as path from "node:path";
import {
    type DiffDirFileItem,
    type FileCompareAction,
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
import { configToSettings, loadConfigFromFile, saveConfig } from "./diffTuiConfig.mjs";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppMode = "list" | "action" | "confirm" | "settings";


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


interface IActionChoice {
    label: string;
    index: number;
}


// ---------------------------------------------------------------------------
// VS Code extra action helpers
// ---------------------------------------------------------------------------

type ExtraVsCodeAction = "edit-left-vscode" | "edit-right-vscode" | "diff-vscode";

function getExtraActions(status: string): Array<ExtraVsCodeAction> {
    switch (status) {
        case "leftOnly":  return ["edit-left-vscode", "diff-vscode"];
        case "rightOnly": return ["edit-right-vscode", "diff-vscode"];
        default:          return ["diff-vscode"];
    }
}

function extraActionLabel(action: ExtraVsCodeAction): string {
    switch (action) {
        case "edit-left-vscode":  return "edit left (VS Code)";
        case "edit-right-vscode": return "edit right (VS Code)";
        case "diff-vscode":       return "diff (VS Code)";
    }
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
// Ignored-files set
// ---------------------------------------------------------------------------

/**
 * Creates a session-only set of "ignored" diff items.  Items are hashed by
 * their relative file path so that membership survives a refresh (which builds
 * brand-new item/File instances) and a config reload (which may repoint the
 * compared directories).
 *
 * @param initial - Items to seed the new set with
 * @return A new VoSet keyed by relative file path
 */
function createIgnoredSet(
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
 * Total lines consumed by fixed chrome:
 *   header (border + 1 content + border)                             =  3
 *   details pane (border + paddingY + 6 content + paddingY + border) = 10
 *   footer (2 hint lines + optional status + optional ignored count) =  4
 *   scroll indicators in list (⬆ + ⬇, worst case)                    =  2
 *                                                                    ────
 *                                                                      19 lines
 */
const FIXED_OVERHEAD = 19;

/** Minimum rows to show in the scrollable file list. */
const MIN_LIST_ROWS = 3;

/** Fallback terminal height when stdout.rows is unavailable or zero. */
const DEFAULT_TERMINAL_ROWS = 24;


// ---------------------------------------------------------------------------
// Main App component
// ---------------------------------------------------------------------------

/**
 * Root Ink component for the difftui command.  Manages all application state
 * and renders the appropriate pane based on the current mode.
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
    const [ignored, setIgnored] = useState<VoSet<DiffDirFileItem>>(() => createIgnoredSet());

    // Whether ignored files are shown (dimmed) in the list or hidden entirely.
    const [showIgnored, setShowIgnored] = useState(false);

    // Whether we're loading.
    const [loading, setLoading] = useState(true);

    // Status message shown in footer.
    const [statusMsg, setStatusMsg] = useState<string>("");

    // Currently selected index in the file list.
    const [selectedIndex, setSelectedIndex] = useState(0);

    // First visible row index for the scrollable file list.
    const [scrollOffset, setScrollOffset] = useState(0);

    // Interaction mode.
    const [mode, setMode] = useState<AppMode>("list");

    // Available actions for the selected item (Skip is excluded).
    const [availableActions, setAvailableActions] = useState<Array<FileCompareAction>>([]);

    // Which action is highlighted in the action pane.
    const [actionIndex, setActionIndex] = useState(0);

    // Whether we're waiting for confirmation.
    const [confirmAction, setConfirmAction] = useState<FileCompareAction | undefined>(undefined);

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


    // Initial load.
    useEffect(() => {
        void computeDiff(appliedSettings, currentLeftDir, currentRightDir, undefined, 0,
                         ignored, showIgnored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // Load available actions (Skip excluded) whenever selection changes or mode returns.
    useEffect(() => {
        if (mode !== "list" && mode !== "action") { return; }
        const entry = visibleItems[selectedIndex];
        if (entry === undefined) {
            setAvailableActions([]);
            return;
        }
        void entry.item.actions(appliedSettings.actionPriority)
        .then((acts) => {
            setAvailableActions(acts.filter((a) => a.type !== FileCompareActionType.Skip));
            setActionIndex(0);
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIndex, items, ignored, showIgnored, appliedSettings.actionPriority, mode]);


    // Scroll the file list to keep the selected item visible.
    useEffect(() => {
        const visCount = getListRows();
        setScrollOffset((prev) => {
            if (selectedIndex < prev) { return selectedIndex; }
            if (selectedIndex >= prev + visCount) { return selectedIndex - visCount + 1; }
            return prev;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIndex, stdout.rows]);


    // After a refresh, an ignore toggle, or a view change the list may shrink;
    // clamp the scroll offset and selected index to the new bounds.
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
                const act = confirmAction;
                if (act !== undefined) {
                    setMode("list");
                    setConfirmAction(undefined);
                    void act.execute().then(async () => {
                        const prevPath = visibleItems[selectedIndex]?.item.relativeFilePath;
                        await computeDiff(
                            appliedSettings,
                            currentLeftDir,
                            currentRightDir,
                            prevPath,
                            selectedIndex,
                            ignored,
                            showIgnored
                        );
                    });
                }
            }
            else {
                setStatusMsg("Cancelled.");
                setConfirmAction(undefined);
                setMode("list");
            }
            return;
        }

        // -----------------------------------------------------------------------
        // Action selection mode
        // -----------------------------------------------------------------------
        if (mode === "action") {
            if (key.escape || input === "q") {
                setMode("list");
                return;
            }

            const entry        = visibleItems[selectedIndex];
            const extraActions = entry !== undefined ?
                getExtraActions(entry.status) :
                ["diff-vscode" as ExtraVsCodeAction];
            const totalChoices = availableActions.length + extraActions.length;

            if (key.upArrow) {
                setActionIndex((i) => (i - 1 + totalChoices) % totalChoices);
                return;
            }

            if (key.downArrow) {
                setActionIndex((i) => (i + 1) % totalChoices);
                return;
            }

            if (key.return) {
                if (actionIndex < availableActions.length) {
                    // Execute action.
                    const act = availableActions[actionIndex];
                    if (act !== undefined) {
                        setConfirmAction(act);
                        setMode("confirm");
                    }
                }
                else {
                    // VS Code action.
                    const extraAction = extraActions[actionIndex - availableActions.length];
                    if (entry !== undefined && extraAction !== undefined) {
                        switch (extraAction) {
                            case "edit-left-vscode":
                                void openInVsCode(entry.item.leftFile, false, true);
                                break;

                            case "edit-right-vscode":
                                void openInVsCode(entry.item.rightFile, false, true);
                                break;

                            case "diff-vscode":
                                if (entry.status === "leftOnly") {
                                    void (async () => {
                                        await entry.item.rightFile.write("");
                                        await showVsCodeDiff(entry.item.leftFile, entry.item.rightFile, false, true);
                                        const stats = entry.item.rightFile.existsSync();
                                        if (stats?.size === 0) {
                                            await entry.item.rightFile.delete();
                                        }
                                        const prevPath = visibleItems[selectedIndex]?.item.relativeFilePath;
                                        await computeDiff(appliedSettings, currentLeftDir, currentRightDir,
                                                          prevPath, selectedIndex, ignored, showIgnored);
                                    })();
                                }
                                else if (entry.status === "rightOnly") {
                                    void (async () => {
                                        await entry.item.leftFile.write("");
                                        await showVsCodeDiff(entry.item.leftFile, entry.item.rightFile, false, true);
                                        const stats = entry.item.leftFile.existsSync();
                                        if (stats?.size === 0) {
                                            await entry.item.leftFile.delete();
                                        }
                                        const prevPath = visibleItems[selectedIndex]?.item.relativeFilePath;
                                        await computeDiff(appliedSettings, currentLeftDir, currentRightDir,
                                                          prevPath, selectedIndex, ignored, showIgnored);
                                    })();
                                }
                                else {
                                    void showVsCodeDiff(entry.item.leftFile, entry.item.rightFile, false, true);
                                }
                                break;
                        }
                    }
                    setMode("list");
                }
                return;
            }

            return;
        }

        // -----------------------------------------------------------------------
        // List mode (default)
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

        // Toggle ignore on the selected file.
        if (input === "i") {
            const entry = visibleItems[selectedIndex];
            if (entry !== undefined) {
                const wasIgnored = ignored.has(entry.item);
                const next = createIgnoredSet(ignored);
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
                setIgnored(createIgnoredSet());
                setStatusMsg(`Un-ignored ${count} file${count === 1 ? "" : "s"}.`);
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

        if (key.return && visibleItems.length > 0) {
            setMode("action");
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
                    const isSelected = idx === selectedIndex;
                    const isIgnored = ignored.has(entry.item);
                    const badge = statusBadge(entry.status);
                    const color = statusColor(entry.status);
                    return (
                        <Box key={entry.item.relativeFilePath} paddingX={1}>
                            <Text {...(isSelected ? { color: "blue" as const } : {})} bold={isSelected}>
                                {isSelected ? "▶" : "  "}
                            </Text>
                            <Text color={color} dimColor={isIgnored}>[{badge}] </Text>
                            <Text
                                color={isSelected ? "white" as const : "gray" as const}
                                bold={isSelected}
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


    function renderDetailsPane(): React.ReactElement {
        const entry = visibleItems[selectedIndex];
        if (entry === undefined) {
            return <Box />;
        }

        const badge = statusBadge(entry.status);
        const color = statusColor(entry.status);
        const isIgnored = ignored.has(entry.item);

        return (
            <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="single">
                <Text bold>Selected ({selectedIndex + 1} of {visibleItems.length}): </Text>
                <Text>{entry.item.relativeFilePath}{isIgnored ? " (ignored)" : ""}</Text>
                <Text color={color}>Status: [{badge}] {entry.status}</Text>
                <Newline />
                <Text dimColor>Left:  {entry.item.leftFile.toString()}</Text>
                <Text dimColor>Right: {entry.item.rightFile.toString()}</Text>
            </Box>
        );
    }


    function renderActionPane(): React.ReactElement {
        if (mode === "confirm" && confirmAction !== undefined) {
            return (
                <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="single">
                    <Text bold color="yellow">Confirm action: {confirmAction.type}</Text>
                    <Newline />
                    <Text>Press <Text bold color="green">y</Text> to confirm, any other key to cancel.</Text>
                </Box>
            );
        }

        if (mode !== "action") {
            return renderDetailsPane();
        }

        const actionChoices: Array<IActionChoice> = availableActions.map((act, i) => ({
            label: act.type,
            index: i
        }));
        const entry        = visibleItems[selectedIndex];
        const extraActions = entry !== undefined ?
            getExtraActions(entry.status) :
            ["diff-vscode" as ExtraVsCodeAction];
        extraActions.forEach((action, i) => {
            actionChoices.push({ label: extraActionLabel(action), index: availableActions.length + i });
        });

        return (
            <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="single">
                <Text bold>Actions:</Text>
                {actionChoices.map((choice) => {
                    const isHighlighted = choice.index === actionIndex;
                    return (
                        <Box key={choice.label}>
                            <Text {...(isHighlighted ? { color: "blue" as const } : {})}
                                bold={isHighlighted}>
                                {isHighlighted ? "▶ " : "  "}
                                {choice.label}
                            </Text>
                        </Box>
                    );
                })}
                <Newline />
                <Text dimColor>[↑↓] Navigate  [Enter] Execute  [Esc/q] Back</Text>
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
                <Text dimColor>[↑↓] Navigate  [Enter] Toggle/Edit</Text>
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
                {ignored.size > 0 && (
                    <Text color="magenta">
                        {ignored.size} ignored{showIgnored ? " (shown)" : " (hidden)"}
                    </Text>
                )}
                <Text dimColor>
                    [↑↓] Select  [Enter] Actions  [i] Ignore  [I] Show ignored  [u] Un-ignore all
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
                <Box flexDirection="column">
                    {renderFileList()}
                    {renderActionPane()}
                </Box>
            )}
            {renderFooter()}
        </Box>
    );
}
