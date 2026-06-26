import { FileCompareActionType } from "@repo/depot-node/diffDirectories";
import {
    type ActionChoice,
    getExtraVsCodeActions,
    extraVsCodeActionLabel,
    itemChoices,
    choiceKey,
    isDestructiveChoice,
    commonChoices,
    digitToPageIndex,
    pageIndexToDigitLabel
} from "./diffTuiActions.mjs";


// ---------------------------------------------------------------------------
// getExtraVsCodeActions
// ---------------------------------------------------------------------------

describe("getExtraVsCodeActions()", () => {

    it("offers edit-left and diff for left-only files", () => {
        expect(getExtraVsCodeActions("leftOnly")).toEqual(["edit-left-vscode", "diff-vscode"]);
    });


    it("offers edit-right and diff for right-only files", () => {
        expect(getExtraVsCodeActions("rightOnly")).toEqual(["edit-right-vscode", "diff-vscode"]);
    });


    it("offers only diff for files in both directories", () => {
        expect(getExtraVsCodeActions("different")).toEqual(["diff-vscode"]);
        expect(getExtraVsCodeActions("identical")).toEqual(["diff-vscode"]);
    });

});


// ---------------------------------------------------------------------------
// extraVsCodeActionLabel
// ---------------------------------------------------------------------------

describe("extraVsCodeActionLabel()", () => {

    it("returns a human-readable label for each VS Code action", () => {
        expect(extraVsCodeActionLabel("edit-left-vscode")).toBe("edit left (VS Code)");
        expect(extraVsCodeActionLabel("edit-right-vscode")).toBe("edit right (VS Code)");
        expect(extraVsCodeActionLabel("diff-vscode")).toBe("diff (VS Code)");
    });

});


// ---------------------------------------------------------------------------
// itemChoices
// ---------------------------------------------------------------------------

describe("itemChoices()", () => {

    it("lists file actions first, then VS Code actions", () => {
        const choices = itemChoices(
            [FileCompareActionType.CopyRight, FileCompareActionType.DeleteLeft],
            "leftOnly"
        );
        expect(choices).toEqual([
            { kind: "file",   actionType: FileCompareActionType.CopyRight,  label: "copy right" },
            { kind: "file",   actionType: FileCompareActionType.DeleteLeft, label: "delete left" },
            { kind: "vscode", vsCodeAction: "edit-left-vscode",            label: "edit left (VS Code)" },
            { kind: "vscode", vsCodeAction: "diff-vscode",                 label: "diff (VS Code)" }
        ]);
    });


    it("includes the VS Code actions even when there are no file actions", () => {
        const choices = itemChoices([], "different");
        expect(choices).toEqual([
            { kind: "vscode", vsCodeAction: "diff-vscode", label: "diff (VS Code)" }
        ]);
    });

});


// ---------------------------------------------------------------------------
// choiceKey
// ---------------------------------------------------------------------------

describe("choiceKey()", () => {

    it("keys file choices by their action type", () => {
        const choice: ActionChoice = { kind: "file", actionType: FileCompareActionType.CopyLeft, label: "copy left" };
        expect(choiceKey(choice)).toBe(`file:${FileCompareActionType.CopyLeft}`);
    });


    it("keys VS Code choices by their action id", () => {
        const choice: ActionChoice = { kind: "vscode", vsCodeAction: "diff-vscode", label: "diff (VS Code)" };
        expect(choiceKey(choice)).toBe("vscode:diff-vscode");
    });

});


// ---------------------------------------------------------------------------
// isDestructiveChoice
// ---------------------------------------------------------------------------

describe("isDestructiveChoice()", () => {

    it("treats file actions as destructive", () => {
        const choice: ActionChoice = { kind: "file", actionType: FileCompareActionType.DeleteBoth, label: "delete both" };
        expect(isDestructiveChoice(choice)).toBe(true);
    });


    it("treats VS Code actions as non-destructive", () => {
        const choice: ActionChoice = { kind: "vscode", vsCodeAction: "diff-vscode", label: "diff (VS Code)" };
        expect(isDestructiveChoice(choice)).toBe(false);
    });

});


// ---------------------------------------------------------------------------
// commonChoices
// ---------------------------------------------------------------------------

describe("commonChoices()", () => {

    function fileChoice(actionType: FileCompareActionType): ActionChoice {
        return { kind: "file", actionType, label: actionType };
    }

    function vsChoice(vsCodeAction: "edit-left-vscode" | "edit-right-vscode" | "diff-vscode"): ActionChoice {
        return { kind: "vscode", vsCodeAction, label: vsCodeAction };
    }


    it("returns an empty list when there are no items", () => {
        expect(commonChoices([])).toEqual([]);
    });


    it("returns the single item's choices unchanged", () => {
        const choices = [fileChoice(FileCompareActionType.CopyRight), vsChoice("diff-vscode")];
        expect(commonChoices([choices])).toEqual(choices);
    });


    it("keeps only choices present in every item, in the first item's order", () => {
        const itemA = [
            fileChoice(FileCompareActionType.CopyRight),
            fileChoice(FileCompareActionType.DeleteLeft),
            vsChoice("diff-vscode")
        ];
        const itemB = [
            fileChoice(FileCompareActionType.DeleteLeft),
            fileChoice(FileCompareActionType.CopyRight),
            vsChoice("diff-vscode")
        ];
        expect(commonChoices([itemA, itemB])).toEqual([
            fileChoice(FileCompareActionType.CopyRight),
            fileChoice(FileCompareActionType.DeleteLeft),
            vsChoice("diff-vscode")
        ]);
    });


    it("drops choices missing from any item", () => {
        const leftOnly  = [fileChoice(FileCompareActionType.CopyRight), vsChoice("edit-left-vscode"), vsChoice("diff-vscode")];
        const rightOnly = [fileChoice(FileCompareActionType.CopyLeft), vsChoice("edit-right-vscode"), vsChoice("diff-vscode")];
        // Only the shared "diff-vscode" action survives.
        expect(commonChoices([leftOnly, rightOnly])).toEqual([vsChoice("diff-vscode")]);
    });


    it("returns an empty list when items share nothing", () => {
        const itemA = [fileChoice(FileCompareActionType.CopyRight)];
        const itemB = [fileChoice(FileCompareActionType.CopyLeft)];
        expect(commonChoices([itemA, itemB])).toEqual([]);
    });

});


// ---------------------------------------------------------------------------
// digitToPageIndex
// ---------------------------------------------------------------------------

describe("digitToPageIndex()", () => {

    it("maps '1'–'9' to indices 0–8", () => {
        expect(digitToPageIndex("1")).toBe(0);
        expect(digitToPageIndex("5")).toBe(4);
        expect(digitToPageIndex("9")).toBe(8);
    });


    it("maps '0' to index 9 (the tenth action)", () => {
        expect(digitToPageIndex("0")).toBe(9);
    });


    it("returns undefined for non-digit keys", () => {
        expect(digitToPageIndex("a")).toBeUndefined();
        expect(digitToPageIndex("")).toBeUndefined();
        expect(digitToPageIndex("12")).toBeUndefined();
    });

});


// ---------------------------------------------------------------------------
// pageIndexToDigitLabel
// ---------------------------------------------------------------------------

describe("pageIndexToDigitLabel()", () => {

    it("labels positions 0–8 as '1'–'9'", () => {
        expect(pageIndexToDigitLabel(0)).toBe("1");
        expect(pageIndexToDigitLabel(4)).toBe("5");
        expect(pageIndexToDigitLabel(8)).toBe("9");
    });


    it("labels position 9 as '0'", () => {
        expect(pageIndexToDigitLabel(9)).toBe("0");
    });


    it("returns an empty string for positions beyond the page", () => {
        expect(pageIndexToDigitLabel(10)).toBe("");
        expect(pageIndexToDigitLabel(-1)).toBe("");
    });


    it("is the inverse of digitToPageIndex for positions 0–9", () => {
        for (let i = 0; i < 10; i++) {
            expect(digitToPageIndex(pageIndexToDigitLabel(i))).toBe(i);
        }
    });

});
