import * as path from "node:path";
import { type Argv, type Arguments } from "yargs";
import { toArray } from "@repo/depot/arrayHelpers";
import { elideEqual } from "@repo/depot/stringDiff";
import {
    ActionPriority,
    type DiffDirFileItem,
    type FileCompareAction,
    FileCompareActionType,
    diffDirectories
} from "@repo/depot-node/diffDirectories";
import { type PathPart } from "@repo/depot-node/pathHelpers";
import { Directory } from "@repo/depot-node/directory";
import { promptForChoice, promptToContinue, type IChoiceString } from "@repo/depot-node/prompts";
import { showVsCodeDiff } from "@repo/depot-node/fileDiff";


export const command = "diff2 <leftDir> <rightDir>";
export const describe = "Diff the files in leftDir and rightDir";

const ACTION_PREFIX = "action:";

interface IConfig {
    leftDir:          Directory;
    rightDir:         Directory;
    actionPriority:   ActionPriority;
    includePatterns:  Array<string>;
    excludePatterns:  Array<string>;
    includeLeftOnly:  boolean;
    includeRightOnly: boolean;
    includeIdentical: boolean;
}

interface ISummaryCounts {
    leftOnly:  number;
    rightOnly: number;
    identical: number;
    different: number;
}


export function builder(argv: Argv): Argv {
    return argv
    .positional("leftDir", {
        describe: "The left directory",
        type:     "string"
    })
    .positional("rightDir", {
        describe: "The right directory",
        type:     "string"
    })
    .option(
        "action-priority",
        {
            demandOption: false,
            type:         "string",
            default:      "preserve",
            choices:      ["preserve", "sync-left-to-right", "sync-right-to-left"],
            describe:     "Priority used to order each file's suggested actions"
        }
    )
    .option(
        "include-identical",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "Include files that are identical in both directories"
        }
    )
    .option(
        "include-left-only",
        {
            demandOption: false,
            type:         "boolean",
            default:      true,
            describe:     "Include files that exist only in the left directory"
        }
    )
    .option(
        "include-right-only",
        {
            demandOption: false,
            type:         "boolean",
            default:      true,
            describe:     "Include files that exist only in the right directory"
        }
    )
    .option(
        "include-patterns",
        {
            alias:        "i",
            demandOption: false,
            type:         "string",
            default:      ["**/*"],
            describe:     "Glob pattern to include (can be specified multiple times)"
        }
    )
    .option(
        "exclude-patterns",
        {
            alias:        "e",
            demandOption: false,
            type:         "string",
            default:      [],
            describe:     "Glob pattern to exclude (can be specified multiple times)"
        }
    )
    .check(
        (args: Arguments) => {
            if (countOptionOccurrences("include-identical") > 1) {
                throw new Error(`Option --include-identical may only be specified once.`);
            }

            const leftDir = new Directory(args.leftDir as PathPart);
            const rightDir = new Directory(args.rightDir as PathPart);

            if (!leftDir.existsSync()) {
                throw new Error(`The left directory "${leftDir.toString()}" does not exist.`);
            }

            if (!rightDir.existsSync()) {
                throw new Error(`The right directory "${rightDir.toString()}" does not exist.`);
            }

            return true;
        },
        false
    )
    .example(
        `$0 diff2 -e **/node_modules/**/* -e **/.turbo/**/* -e **/dist/**/* \\path\\to\\left\\dir \\path\\to\\right\\dir`,
        `Compare \\path\\to\\left\\dir and \\path\\to\\right\\dir, excluding node_modules, turbo cache and dist directories. Multiple -e flags can be used to specify multiple exclude patterns.`
    )
    .example(
        `$0 diff2 --include-left-only=false \\path\\to\\left\\dir \\path\\to\\right\\dir`,
        `Omit files that exist only in the left directory, showing only right-only and files present in both.`
    )
    .example(
        `$0 diff2 --include-right-only=false \\path\\to\\left\\dir \\path\\to\\right\\dir`,
        `Omit files that exist only in the right directory, showing only left-only and files present in both.`
    );
}


export async function handler(args: Arguments): Promise<void> {
    const config = getConfiguration(args);

    const diffItems = await diffDirectories(config.leftDir, config.rightDir, {
        includeLeftOnly:  config.includeLeftOnly,
        includeRightOnly: config.includeRightOnly,
        includeIdentical: config.includeIdentical,
        includePatterns:  config.includePatterns,
        excludePatterns:  config.excludePatterns
    });

    if (diffItems.length === 0) {
        console.log(`No differences found.`);
        return undefined;
    }

    const summary = await computeSummary(diffItems);
    printSummary(summary, diffItems.length);
    let itemIndex = 1;

    for (const item of diffItems) {
        console.log("");
        console.log(`Reviewing item ${itemIndex} of ${diffItems.length}.`);
        printFilePaths(item);

        let moveNext = false;
        while (!moveNext) {

            // Print the file comparison status.
            console.log(`Status: ${await item.status()}`);

            const fileActions = await item.actions(config.actionPriority);
            const menuChoices = buildMenuChoices(fileActions);
            const selected = await promptForChoice(`File: ${item.relativeFilePath}`, menuChoices);

            if (selected.startsWith(ACTION_PREFIX)) {
                const actionType = parseActionType(selected, ACTION_PREFIX);
                const action = actionType === undefined ? undefined : findAction(fileActions, actionType);
                if (action !== undefined) {
                    const confirmed = await promptToContinue("Are you sure?", false);
                    if (confirmed) {
                        await action.execute();
                        console.log(`Executed ${action.type}.`);
                    }
                    else {
                        console.log(`Cancelled ${action.type}.`);
                    }
                }
                else {
                    console.log(`Action is no longer available.`);
                }
            }
            else if (selected === "diff") {
                await showVsCodeDiff(item.leftFile, item.rightFile, false, true);
            }
            else if (selected === "next") {
                moveNext = true;
            }
            else if (selected === "end") {
                return undefined;
            }
        }

        itemIndex += 1;
    }

    return undefined;
}


function getConfiguration(args: Arguments): IConfig {
    const actionPriority = mapActionPriority(args["action-priority"] as string);
    const includePatterns = normalizePatterns(args["include-patterns"] as string | Array<string> | undefined, ["**/*"]);
    const excludePatterns = normalizePatterns(args["exclude-patterns"] as string | Array<string> | undefined, []);

    return {
        leftDir:          new Directory(args.leftDir as PathPart),
        rightDir:         new Directory(args.rightDir as PathPart),
        actionPriority:   actionPriority,
        includePatterns:  includePatterns,
        excludePatterns:  excludePatterns,
        includeLeftOnly:  !!args["include-left-only"],
        includeRightOnly: !!args["include-right-only"],
        includeIdentical: !!args["include-identical"]
    };
}


function mapActionPriority(value: string): ActionPriority {
    if (value === "sync-left-to-right") {
        return ActionPriority.SyncLeftToRight;
    }

    if (value === "sync-right-to-left") {
        return ActionPriority.SyncRightToLeft;
    }

    return ActionPriority.Preserve;
}


function normalizePatterns(
    value: string | Array<string> | undefined,
    defaultPatterns: Array<string>
): Array<string> {
    const patterns = toArray(value).filter((curPattern) => curPattern.trim().length > 0);
    return patterns.length > 0 ? patterns : defaultPatterns;
}


function buildMenuChoices(actions: Array<FileCompareAction>): Array<IChoiceString> {
    const actionChoices = actions.map((curAction) => {
        const actionType = curAction.type;
        return { name: `execute: ${actionType}`, value: `${ACTION_PREFIX}${actionType}` };
    });

    return [
        ...actionChoices,
        { name: "diff", value: "diff" },
        { name: "next", value: "next" },
        { name: "end", value: "end" }
    ];
}


function parseActionType(
    selectedValue: string,
    prefix: string
): FileCompareActionType | undefined {
    const actionType = selectedValue.slice(prefix.length);

    const validActionTypes = Object.values(FileCompareActionType) as Array<string>;
    if (validActionTypes.includes(actionType)) {
        return actionType as FileCompareActionType;
    }

    return undefined;
}


function findAction(
    actions: Array<FileCompareAction>,
    actionType: FileCompareActionType
): FileCompareAction | undefined {
    for (const action of actions) {
        if (action.type === actionType) {
            return action;
        }
    }

    return undefined;
}


async function computeSummary(diffItems: Array<DiffDirFileItem>): Promise<ISummaryCounts> {
    let leftOnly = 0;
    let rightOnly = 0;
    let identical = 0;

    for (const item of diffItems) {
        const [isLeftOnly, isRightOnly, bothExistAndIdentical] = await Promise.all([
            item.isLeftOnly(),
            item.isRightOnly(),
            item.bothExistAndIdentical()
        ]);

        if (isLeftOnly) {
            leftOnly++;
            continue;
        }

        if (isRightOnly) {
            rightOnly++;
            continue;
        }

        if (bothExistAndIdentical) {
            identical++;
        }
    }

    return {
        leftOnly:  leftOnly,
        rightOnly: rightOnly,
        identical: identical,
        different: diffItems.length - leftOnly - rightOnly - identical
    };
}


function printSummary(summary: ISummaryCounts, total: number): void {
    console.log(``);
    console.log(`Found ${total} file(s) to review.`);
    console.log(`  left-only: ${summary.leftOnly}`);
    console.log(`  right-only: ${summary.rightOnly}`);
    console.log(`  identical: ${summary.identical}`);
    console.log(`  different: ${summary.different}`);
}


function printFilePaths(item: DiffDirFileItem): void {
    const [leftAbbrevParts, rightAbbrevParts] =
        elideEqual(item.leftFile.toString(), item.rightFile.toString(), path.sep, "...", 1, 3);

    const leftAbbrev = leftAbbrevParts.join(path.sep);
    const rightAbbrev = rightAbbrevParts.join(path.sep);

    console.log(leftAbbrev);
    console.log(rightAbbrev);
}


function countOptionOccurrences(optionName: string): number {
    const longName = `--${optionName}`;
    const negatedName = `--no-${optionName}`;

    return process.argv.reduce((acc, curArg) => {
        if (curArg === longName || curArg.startsWith(`${longName}=`)) {
            return acc + 1;
        }

        if (curArg === negatedName || curArg.startsWith(`${negatedName}=`)) {
            return acc + 1;
        }

        return acc;
    }, 0);
}
