import { FileCompareActionType } from "@repo/depot-node/diffDirectories";


/**
 * The VS Code helper actions that are offered alongside the file-system actions.
 * These are not produced by the diffDirectories action model; the TUI adds them.
 */
export type ExtraVsCodeAction = "edit-left-vscode" | "edit-right-vscode" | "diff-vscode";


/**
 * A single action the user can perform on the current selection.  An action is
 * either a file-system action (copy/delete, produced by the diff model) or a
 * VS Code helper action (edit/diff, added by the TUI).
 */
export type ActionChoice =
    | { kind: "file";   actionType:   FileCompareActionType; label: string }
    | { kind: "vscode"; vsCodeAction: ExtraVsCodeAction;     label: string };


/**
 * The maximum number of actions that are numbered (and therefore directly
 * runnable via a number key) on a single page of the detail pane.  Numbered
 * 1–9 then 0 (representing the tenth).
 */
export const ACTIONS_PER_PAGE = 10;


/**
 * Returns the VS Code helper actions appropriate for a given file status.
 *
 * @param status - The diff status of the file ("leftOnly", "rightOnly", …)
 * @returns The ordered list of VS Code actions to offer
 */
export function getExtraVsCodeActions(status: string): Array<ExtraVsCodeAction> {
    switch (status) {
        case "leftOnly":  return ["edit-left-vscode", "diff-vscode"];
        case "rightOnly": return ["edit-right-vscode", "diff-vscode"];
        default:          return ["diff-vscode"];
    }
}


/**
 * Returns the human-readable label for a VS Code helper action.
 *
 * @param action - The VS Code action
 * @returns The display label
 */
export function extraVsCodeActionLabel(action: ExtraVsCodeAction): string {
    switch (action) {
        case "edit-left-vscode":  return "edit left (VS Code)";
        case "edit-right-vscode": return "edit right (VS Code)";
        case "diff-vscode":       return "diff (VS Code)";
    }
}


/**
 * Builds the ordered list of action choices for a single file item: its
 * file-system actions (already filtered to exclude Skip) followed by the VS Code
 * helper actions appropriate for its status.
 *
 * @param fileActionTypes - The file-system action types available for the item
 *     (Skip excluded by the caller)
 * @param status - The diff status of the file
 * @returns The combined, ordered list of action choices
 */
export function itemChoices(
    fileActionTypes: ReadonlyArray<FileCompareActionType>,
    status:          string
): Array<ActionChoice> {
    const fileChoices: Array<ActionChoice> = fileActionTypes.map((actionType) => ({
        kind:  "file",
        actionType,
        label: actionType
    }));
    const vsChoices: Array<ActionChoice> = getExtraVsCodeActions(status).map((vsCodeAction) => ({
        kind:  "vscode",
        vsCodeAction,
        label: extraVsCodeActionLabel(vsCodeAction)
    }));
    return [...fileChoices, ...vsChoices];
}


/**
 * Returns a stable key uniquely identifying the kind of an action choice,
 * independent of which file(s) it applies to.  Used to compare choices across
 * items.
 *
 * @param choice - The action choice
 * @returns The comparison key
 */
export function choiceKey(choice: ActionChoice): string {
    return choice.kind === "file" ?
        `file:${choice.actionType}` :
        `vscode:${choice.vsCodeAction}`;
}


/**
 * Whether an action choice is destructive (mutates the file system) and should
 * therefore require confirmation before running.  File-system actions
 * (copy/delete) are destructive; VS Code helper actions are not.
 *
 * @param choice - The action choice
 * @returns True if the choice is destructive
 */
export function isDestructiveChoice(choice: ActionChoice): boolean {
    return choice.kind === "file";
}


/**
 * Computes the actions common to every item in a selection.  An action is
 * common when a choice with the same key (see {@link choiceKey}) appears in
 * every item's choice list.  The result preserves the order of the first item's
 * choices.
 *
 * @param perItem - One choice list per selected item
 * @returns The choices common to all items, in the first item's order
 */
export function commonChoices(
    perItem: ReadonlyArray<ReadonlyArray<ActionChoice>>
): Array<ActionChoice> {
    const [first, ...rest] = perItem;
    if (first === undefined) {
        return [];
    }

    const restKeySets = rest.map((choices) => new Set(choices.map(choiceKey)));
    return first.filter((choice) => {
        const key = choiceKey(choice);
        return restKeySets.every((set) => set.has(key));
    });
}


/**
 * Maps a pressed number key to a zero-based index within the visible action
 * page.  Keys "1"–"9" map to 0–8 and "0" maps to 9 (the tenth action).
 *
 * @param input - The pressed key
 * @returns The zero-based page index, or undefined if the key is not a digit
 */
export function digitToPageIndex(input: string): number | undefined {
    if (input === "0") {
        return ACTIONS_PER_PAGE - 1;
    }
    if (input.length === 1 && input >= "1" && input <= "9") {
        return input.charCodeAt(0) - "1".charCodeAt(0);
    }
    return undefined;
}


/**
 * Returns the digit label shown for a given zero-based position within the
 * visible action page.  Positions 0–8 are labeled "1"–"9" and position 9 is
 * labeled "0".
 *
 * @param pageIndex - The zero-based position within the page
 * @returns The digit label, or an empty string for positions beyond the page
 */
export function pageIndexToDigitLabel(pageIndex: number): string {
    if (pageIndex === ACTIONS_PER_PAGE - 1) {
        return "0";
    }
    if (pageIndex >= 0 && pageIndex < ACTIONS_PER_PAGE - 1) {
        return String(pageIndex + 1);
    }
    return "";
}
