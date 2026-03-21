import { createElement } from "react";
import { render } from "ink";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Directory } from "@repo/depot-node/directory";
import { type PathPart } from "@repo/depot-node/pathHelpers";
import { DiffTuiApp } from "./diffTuiApp.js";
import { loadConfig, mergeWithDefaults } from "./diffTuiConfig.mjs";
import { defaultDiffTuiSettings } from "./diffTuiSettings.mjs";

////////////////////////////////////////////////////////////////////////////////
// Bootstrap
////////////////////////////////////////////////////////////////////////////////

main()
.then(
    (exitCode) => {
        if (exitCode !== 0) {
            process.exit(exitCode);
        }
    }
)
.catch((err: unknown) => {
    console.error(JSON.stringify(err));
    process.exit(-1);
});

////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////

export async function main(): Promise<number> {
    // Parse the two positional directory arguments.
    const argv = await yargs(hideBin(process.argv))
    .usage("Usage: difftui <leftDir> <rightDir>")
    .command(
        "$0 <leftDir> <rightDir>",
        "Interactively diff the files in leftDir and rightDir using a TUI",
        (yarg) => {
            return yarg
            .positional("leftDir", {
                describe: "The left directory",
                type:     "string"
            })
            .positional("rightDir", {
                describe: "The right directory",
                type:     "string"
            });
        }
    )
    .check(
        (args) => {
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
        "$0 /path/to/left /path/to/right",
        "Interactively compare two directories using a TUI."
    )
    .help()
    .argv;

    const leftDir  = new Directory(argv.leftDir as PathPart);
    const rightDir = new Directory(argv.rightDir as PathPart);

    // Load settings from difftui.json in the working directory.
    const configResult = loadConfig();
    if (configResult.failed) {
        console.error(configResult.error);
        return 1;
    }

    const initialSettings = mergeWithDefaults(configResult.value, defaultDiffTuiSettings);

    // Enter the alternate screen buffer so the TUI occupies a clean full-screen
    // surface starting at row 0.  This keeps the header pinned to the top and
    // restores the previous terminal content when the user quits.
    process.stdout.write("\x1b[?1049h\x1b[H");

    try {
        const { waitUntilExit } = render(
            createElement(DiffTuiApp, { leftDir, rightDir, initialSettings })
        );

        await waitUntilExit();
    }
    finally {
        // Exit the alternate screen buffer, restoring the original terminal.
        process.stdout.write("\x1b[?1049l");
    }

    return 0;
}
