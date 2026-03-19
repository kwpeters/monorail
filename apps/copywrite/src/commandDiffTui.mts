import { createElement } from "react";
import { render } from "ink";
import { type Argv, type Arguments } from "yargs";
import { Directory } from "@repo/depot-node/directory";
import { type PathPart } from "@repo/depot-node/pathHelpers";
import { DiffTuiApp } from "./diffTuiApp.js";
import { loadConfig, mergeWithDefaults } from "./diffTuiConfig.mjs";
import { defaultDiffTuiSettings } from "./diffTuiSettings.mjs";


export const command = "difftui <leftDir> <rightDir>";
export const describe = "Interactively diff the files in leftDir and rightDir using a TUI";


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
    .check(
        (args: Arguments) => {
            const leftDir  = new Directory(args.leftDir as PathPart);
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
        `$0 difftui \\path\\to\\left\\dir \\path\\to\\right\\dir`,
        `Interactively compare two directories using a TUI.  All filter options are configurable from within the TUI.`
    );
}


export async function handler(args: Arguments): Promise<void> {
    const leftDir  = new Directory(args.leftDir as PathPart);
    const rightDir = new Directory(args.rightDir as PathPart);

    // Load settings from difftui.json in the working directory.
    const configResult = loadConfig();
    if (configResult.failed) {
        console.error(configResult.error);
        process.exit(1);
    }

    const initialSettings = mergeWithDefaults(configResult.value, defaultDiffTuiSettings);

    const { waitUntilExit } = render(
        createElement(DiffTuiApp, { leftDir, rightDir, initialSettings })
    );

    await waitUntilExit();
}
