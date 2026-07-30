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
        const banner = "=".repeat(60);
        console.log(`\n${banner}\n  Reviewing item ${itemNumber}/${totalCount}: ${mapping.repoRelativePath}\n${banner}`);

        try {
            while (true) {
                const status = await determineFileComparison(mapping.repoFile, mapping.deployedFile);
                if (status === FileComparisonResult.Identical) {
                    console.log("  same: repository and deployed files match; skipping.");
                    break;
                }

                const [repoExists, deployedExists] = (await Promise.all([
                    mapping.repoFile.exists(),
                    mapping.deployedFile.exists()
                ])).map((stats) => stats !== undefined);
                console.log(
                    `  different:\n` +
                    `    repo:     ${mapping.repoFile.absPath()} (${repoExists ? "exists" : "missing"})\n` +
                    `    deployed: ${mapping.deployedFile.absPath()} (${deployedExists ? "exists" : "missing"})`
                );
                const action = await promptForReviewAction();
                if (action === "show-diff") {
                    if (!deployedExists) {
                        await mapping.deployedFile.write("");
                    }
                    await showVsCodeDiff(mapping.repoFile, mapping.deployedFile, false, true);
                    if (!deployedExists) {
                        const stats = mapping.deployedFile.existsSync();
                        if (stats?.size === 0) {
                            await mapping.deployedFile.delete();
                        }
                    }
                }
                else {
                    console.log("  skipped: continuing to next mapping.");
                    break;
                }
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
