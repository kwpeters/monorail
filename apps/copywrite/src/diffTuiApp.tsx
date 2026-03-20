import React, { useState, useCallback, useEffect } from "react";
import { Box, Text, useApp, useInput, Newline, useStdout } from "ink";
import TextInput from "ink-text-input";
import {
    ActionPriority,
    type DiffDirFileItem,
    type FileCompareAction,
    FileCompareActionType,
    diffDirectories
} from "@repo/depot-node/diffDirectories";
import { showVsCodeDiff } from "@repo/depot-node/fileDiff";
import { Directory } from "@repo/depot-node/directory";
import {
    type IDiffTuiSettings,
    actionPriorityToString,
    stringToActionPriority,
    patternArrayToText,
    parsePatternsText,
    retainSelection
} from "./diffTuiSettings.mjs";
import { saveConfig } from "./diffTuiConfig.mjs";


// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppMode = "list" | "action" | "confirm" | "settings";


interface IDiffTuiAppProps {
    leftDir:         Directory;
    rightDir:        Directory;
    initialSettings: IDiffTuiSettings;
}


interface IItemWithStatus {
    item:   DiffDirFileItem;
    status: string;
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
// Settings panel state
// ---------------------------------------------------------------------------

interface ISettingsDraft {
    actionPriority:       string;
    includeIdentical:     boolean;
    includeLeftOnly:      boolean;
    includeRightOnly:     boolean;
    includePatternText:   string;
    excludePatternText:   string;
    /** Index of the currently focused field (0–5). */
    focusedField:         number;
    /** True when a text field is being edited. */
    editing:              boolean;
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
 *   header (border + 1 content + border)          = 3
 *   details pane (border + paddingY + 6 content + paddingY + border) = 10
 *   footer (hint + optional status msg)           = 2
 *   scroll indicators in list (⬆ + ⬇, worst case)= 2
 *                                               ────
 *                                               17 lines
 */
const FIXED_OVERHEAD = 17;

/** Minimum rows to show in the scrollable file list. */
const MIN_LIST_ROWS = 3;

/** Fallback terminal height when stdout.rows is unavailable. */
const DEFAULT_TERMINAL_ROWS = 24;


// ---------------------------------------------------------------------------
// Main App component
// ---------------------------------------------------------------------------

/**
 * Root Ink component for the difftui command.  Manages all application state
 * and renders the appropriate pane based on the current mode.
 */
export function DiffTuiApp({ leftDir, rightDir, initialSettings }: IDiffTuiAppProps): React.ReactElement {
    const { exit } = useApp();
    const { stdout } = useStdout();

    // Applied settings (used for the current diff list computation).
    const [appliedSettings, setAppliedSettings] = useState<IDiffTuiSettings>(initialSettings);

    // Pending settings (reflected in the settings panel, applied on 'r').
    const [pendingSettings, setPendingSettings] = useState<IDiffTuiSettings>(initialSettings);

    // The resolved diff list with statuses.
    const [items, setItems] = useState<Array<IItemWithStatus>>([]);

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
        return Math.max(MIN_LIST_ROWS, (stdout.rows ?? DEFAULT_TERMINAL_ROWS) - FIXED_OVERHEAD);
    }

    // ---------------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------------

    const computeDiff = useCallback(async (settings: IDiffTuiSettings, prevPath: string | undefined, prevIdx: number) => {
        setLoading(true);
        setStatusMsg("");
        try {
            const diffItems = await diffDirectories(leftDir, rightDir, {
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
            const newIdx = retainSelection(prevPath, diffItems, prevIdx);
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
    }, [leftDir, rightDir]);


    // Initial load.
    useEffect(() => {
        void computeDiff(appliedSettings, undefined, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // Load available actions (Skip excluded) whenever selection changes or mode returns.
    useEffect(() => {
        if (mode !== "list" && mode !== "action") { return; }
        const entry = items[selectedIndex];
        if (entry === undefined) {
            setAvailableActions([]);
            return;
        }
        void entry.item.actions(appliedSettings.actionPriority)
        .then((acts) => {
            setAvailableActions(acts.filter((a) => a.type !== FileCompareActionType.Skip));
            setActionIndex(0);
        });
    }, [selectedIndex, items, appliedSettings.actionPriority, mode]);


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


    // After a refresh the list may shrink; clamp scroll offset to the new bounds.
    useEffect(() => {
        const visCount = getListRows();
        setScrollOffset((prev) => Math.min(prev, Math.max(0, items.length - visCount)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [items, stdout.rows]);


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

            if (key.escape || input === "s") {
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

            // Apply / refresh.
            if (input === "r") {
                const newSettings = draftToSettings(settingsDraft);
                setPendingSettings(newSettings);
                setAppliedSettings(newSettings);
                setMode("list");
                const prevPath = items[selectedIndex]?.item.relativeFilePath;
                void computeDiff(newSettings, prevPath, selectedIndex);
                return;
            }

            // Export config (Ctrl+E).
            if (key.ctrl && input === "e") {
                const newSettings = draftToSettings(settingsDraft);
                const result = saveConfig(newSettings);
                if (result.failed) {
                    setStatusMsg(`Export failed: ${result.error}`);
                }
                else {
                    setStatusMsg("Settings exported to difftui.json");
                }
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
                        const prevPath = items[selectedIndex]?.item.relativeFilePath;
                        await computeDiff(appliedSettings, prevPath, selectedIndex);
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

            const totalChoices = availableActions.length + 1; // +1 for diff
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
                    // VS Code diff.
                    const entry = items[selectedIndex];
                    if (entry !== undefined) {
                        void showVsCodeDiff(entry.item.leftFile, entry.item.rightFile, false, true);
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
            const newSettings = draftToSettings(settingsDraft);
            setAppliedSettings(newSettings);
            setPendingSettings(newSettings);
            const prevPath = items[selectedIndex]?.item.relativeFilePath;
            void computeDiff(newSettings, prevPath, selectedIndex);
            return;
        }

        if (key.ctrl && input === "e") {
            const result = saveConfig(appliedSettings);
            if (result.failed) {
                setStatusMsg(`Export failed: ${result.error}`);
            }
            else {
                setStatusMsg("Settings exported to difftui.json");
            }
            return;
        }

        if (key.upArrow && items.length > 0) {
            setSelectedIndex((i) => Math.max(0, i - 1));
            return;
        }

        if (key.downArrow && items.length > 0) {
            setSelectedIndex((i) => Math.min(items.length - 1, i + 1));
            return;
        }

        if (key.return && items.length > 0) {
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
                <Text dimColor>{leftDir.toString()}</Text>
                <Text bold color="blue"> ↔ </Text>
                <Text dimColor>{rightDir.toString()}</Text>
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

        const visCount = getListRows();
        const hasAbove = scrollOffset > 0;
        const hasBelow = scrollOffset + visCount < items.length;
        const visibleItems = items.slice(scrollOffset, scrollOffset + visCount);

        return (
            <Box flexDirection="column">
                {hasAbove && (
                    <Box paddingX={1}>
                        <Text dimColor>⬆ {scrollOffset} more above</Text>
                    </Box>
                )}
                {visibleItems.map((entry, relIdx) => {
                    const idx = scrollOffset + relIdx;
                    const isSelected = idx === selectedIndex;
                    const badge = statusBadge(entry.status);
                    const color = statusColor(entry.status);
                    return (
                        <Box key={entry.item.relativeFilePath} paddingX={1}>
                            <Text {...(isSelected ? { color: "blue" as const } : {})} bold={isSelected}>
                                {isSelected ? "▶" : "  "}
                            </Text>
                            <Text color={color}>[{badge}] </Text>
                            <Text color={isSelected ? "white" as const : "gray" as const}
                                  bold={isSelected}>
                                {entry.item.relativeFilePath}
                            </Text>
                        </Box>
                    );
                })}
                {hasBelow && (
                    <Box paddingX={1}>
                        <Text dimColor>⬇ {items.length - scrollOffset - visCount} more below</Text>
                    </Box>
                )}
            </Box>
        );
    }


    function renderDetailsPane(): React.ReactElement {
        const entry = items[selectedIndex];
        if (entry === undefined) {
            return <Box />;
        }

        const badge = statusBadge(entry.status);
        const color = statusColor(entry.status);

        return (
            <Box flexDirection="column" paddingX={2} paddingY={1} borderStyle="single">
                <Text bold>Selected: </Text>
                <Text>{entry.item.relativeFilePath}</Text>
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

        const actionChoices = availableActions.map((act, i) => ({
            label: act.type as string,
            index: i
        }));
        actionChoices.push({ label: "diff (VS Code)", index: availableActions.length });

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
                <Text bold color="cyan">Settings  </Text>
                <Text dimColor>(s/Esc close · r apply · Ctrl+E export)</Text>
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
                <Text dimColor>[↑↓/Tab] Navigate  [Enter] Toggle/Edit  [r] Apply  [Ctrl+E] Export</Text>
            </Box>
        );
    }


    function renderFooter(): React.ReactElement {
        return (
            <Box flexDirection="column" paddingX={1}>
                {statusMsg.length > 0 && (
                    <Text color="yellow">{statusMsg}</Text>
                )}
                <Text dimColor>
                    [↑↓] Select  [Enter] Actions  [s] Settings  [r] Refresh  [q] Quit
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
