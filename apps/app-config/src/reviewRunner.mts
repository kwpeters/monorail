import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { type IChoiceString, promptForChoice } from "@repo/depot-node/prompts";
import { promptForChoiceFuzzy, registerFuzzyPrompt } from "@repo/depot-node/promptAutocomplete";
import { showVsCodeDiff } from "@repo/depot-node/vsCode";
import { FileComparer } from "@repo/depot-node/diffDirectories";
import { File } from "@repo/depot-node/file";
import { type IReviewConfig } from "./reviewTypes.mjs";


export enum FileComparisonResult {
    Identical = "identical",
    Different = "different"
}


interface IFuzzyAction {
    id:    string;
    label: string;
}


function toReviewAction(actionId: string): "show-diff" | "next" {
    return actionId === "show-diff" ? "show-diff" : "next";
}


async function promptForReviewAction(): Promise<"show-diff" | "next"> {
    const choices: Array<IFuzzyAction> = [
        { id: "show-diff", label: "Show VS Code diff" },
        { id: "next", label: "Move to next mapping" }
    ];

    try {
        const selected = await promptForChoiceFuzzy<IFuzzyAction>(
            "Different file detected. Choose action",
            choices,
            (item) => item.label
        );
        return toReviewAction(selected.id);
    }
    catch (_err: unknown) {
        const fallbackChoices: Array<IChoiceString> = choices.map((choice) => ({
            name:  choice.label,
            value: choice.id
        }));
        const selected = await promptForChoice("Different file detected. Choose action", fallbackChoices);
        return toReviewAction(selected);
    }
}


let fuzzyPromptRegistered = false;


export async function determineFileComparison(
    repoFilePath: File,
    deployedFilePath: File
): Promise<FileComparisonResult> {
    const comparer = FileComparer.create(repoFilePath, deployedFilePath);

    const identical = await comparer.bothExistAndIdentical(true);
    return identical ? FileComparisonResult.Identical : FileComparisonResult.Different;
}


export async function runInteractiveReview(config: IReviewConfig): Promise<Result<void, string>> {
    if (!fuzzyPromptRegistered) {
        registerFuzzyPrompt();
        fuzzyPromptRegistered = true;
    }

    const totalCount = config.mappings.length;
    let itemNumber = 1;

    for (const mapping of config.mappings) {
        console.log(`Reviewing item ${itemNumber}/${totalCount}: ${mapping.repoRelativePath}`);

        try {
            const status = await determineFileComparison(mapping.repoFile, mapping.deployedFile);
            if (status === FileComparisonResult.Identical) {
                console.log("  same: repository and deployed files match; skipping.");
                itemNumber += 1;
                continue;
            }

            console.log("  different: repository and deployed files differ.");
            const action = await promptForReviewAction();
            if (action === "show-diff") {
                await showVsCodeDiff(mapping.repoFile, mapping.deployedFile, false, true);
                console.log("  diff closed: continuing to next mapping.");
            }
            else {
                console.log("  skipped: continuing to next mapping.");
            }

            itemNumber += 1;
        }
        catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : "Unexpected runtime failure.";
            return new FailedResult(`Failed while reviewing ${mapping.repoRelativePath}: ${errMsg}`);
        }
    }

    return new SucceededResult(undefined);
}
