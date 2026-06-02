import { createElement } from "react";
import { render } from "ink";
import * as path from "node:path";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Directory } from "@repo/depot-node/directory";
import { DiffTuiApp } from "./diffTuiApp.js";
import { loadConfig, loadConfigFromFile, configToSettings, mergeWithDefaults } from "./diffTuiConfig.mjs";
import { type IDiffTuiSettings, defaultDiffTuiSettings } from "./diffTuiSettings.mjs";

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
    const argv = await yargs(hideBin(process.argv))
    .usage("Usage: difftui [--config <file>] [<leftDir> <rightDir>]")
    .command(
        "$0 [leftDir] [rightDir]",
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
            })
            .option("config", {
                alias:    "c",
                describe: "Path to a difftui config file",
                type:     "string"
            });
        }
    )
    .check(
        (args) => {
            // When a config file is provided the positional dirs are optional;
            // they come from the file.  When no config file is given the two
            // positional dirs are required and must exist on disk.
            if (args.config === undefined) {
                if (args.leftDir === undefined || args.rightDir === undefined) {
                    throw new Error("Two directory arguments are required when --config is not specified.");
                }

                const leftDir  = new Directory(args.leftDir as string);
                const rightDir = new Directory(args.rightDir as string);

                if (!leftDir.existsSync()) {
                    throw new Error(`The left directory "${leftDir.toString()}" does not exist.`);
                }

                if (!rightDir.existsSync()) {
                    throw new Error(`The right directory "${rightDir.toString()}" does not exist.`);
                }
            }

            return true;
        },
        false
    )
    .example(
        "$0 /path/to/left /path/to/right",
        "Interactively compare two directories using a TUI."
    )
    .example(
        "$0 --config difftui.json",
        "Load directories and settings from a config file."
    )
    .help()
    .argv;

    // -------------------------------------------------------------------------
    // Resolve directories and settings
    // -------------------------------------------------------------------------

    let leftDirStr:  string;
    let rightDirStr: string;
    let initialSettings: IDiffTuiSettings;

    const configFile = argv.config as string | undefined;
    if (configFile !== undefined) {
        // Explicit config file path.
        const configPath = path.resolve(configFile);
        const configResult = loadConfigFromFile(configPath);
        if (configResult.failed) {
            console.error(configResult.error);
            return 1;
        }
        leftDirStr      = configResult.value.leftDir;
        rightDirStr     = configResult.value.rightDir;
        initialSettings = configToSettings(configResult.value);
    }
    else {
        // Positional args are required (validated above).
        leftDirStr  = argv.leftDir as string;
        rightDirStr = argv.rightDir as string;

        // Also try to load settings from difftui.json in the working directory.
        const configResult = loadConfig();
        if (configResult.failed) {
            console.error(configResult.error);
            return 1;
        }
        initialSettings = mergeWithDefaults(configResult.value, defaultDiffTuiSettings);
    }

    const leftDir  = new Directory(leftDirStr);
    const rightDir = new Directory(rightDirStr);

    if (!leftDir.existsSync()) {
        console.error(`The left directory "${leftDir.toString()}" does not exist.`);
        return 1;
    }

    if (!rightDir.existsSync()) {
        console.error(`The right directory "${rightDir.toString()}" does not exist.`);
        return 1;
    }

    // Enter the alternate screen buffer so the TUI occupies a clean full-screen
    // surface starting at row 0.  This keeps the header pinned to the top and
    // restores the previous terminal content when the user quits.
    process.stdout.write("\x1b[?1049h\x1b[H");

    try {
        const { waitUntilExit } = render(
            createElement(DiffTuiApp, {
                leftDir,
                rightDir,
                configFilePath: configFile !== undefined ? path.resolve(configFile) : undefined,
                initialSettings
            })
        );

        await waitUntilExit();
    }
    finally {
        // Exit the alternate screen buffer, restoring the original terminal.
        process.stdout.write("\x1b[?1049l");
    }

    return 0;
}
