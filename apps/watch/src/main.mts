import { watch } from "node:fs";
import * as cp from "node:child_process";
import { emitKeypressEvents, type Key } from "node:readline";
import * as _ from "lodash-es";
import chalk from "chalk";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import treeKill from "tree-kill";
import { Result, SucceededResult } from "@repo/depot/result";
import { toArray } from "@repo/depot/arrayHelpers";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { ListenerTracker } from "@repo/depot-node/listenerTracker";
import { spawn, type ISpawnResult } from "@repo/depot-node/spawn";
import { getOs, OperatingSystem } from "@repo/depot-node/os";


const DEBOUNCE_DELAY = 1500;
const SEP = "================================================================================";
const START_TEXT   = chalk.green.bold;
const STOP_TEXT    = chalk.white.bold.bgBlack;
const INFO_TEXT    = chalk.black.bgRgb(153, 153, 153);
const SUCCESS_TEXT = chalk.green.bold;
const FAIL_TEXT    = chalk.red.bold;


/**
 * Configuration options for this script.
 */
interface IWatchConfig {
    cmd:           string;
    cmdArgs:       Array<string>;
    watchDirs:     Array<Directory>;
    ignoreRegexes: Array<RegExp>;
}


export async function main(): Promise<number> {
    const res = await mainImpl();
    if (res.succeeded) {
        return res.value;
    }
    else {
        console.error(res.error);
        return -1;
    }
}


/**
 * Parses the command line and gathers the options into an easily consumable
 * form.
 * @return The configuration parameters for this script
 */
async function getConfiguration(): Promise<IWatchConfig> {

    const usage = [
        "Watches files and runs a command line when they change.",
        "- Watching can be paused/unpaused using ctrl+p.",
        "- Supports manual triggering by pressing any key.",
        "- If the spawned process is still running when another trigger",
        "  is received, the current process (and any child processes)",
        "  are killed.",
        "- ctrl+c to exit",
        "",
        'watch --watch <dir>... --ignore <regex>... "command"',
    ];

    const argv = await yargs(hideBin(process.argv))
    .usage(usage.join("\n"))
    .help()
    .option(
        "watch",
        {
            demandOption: false,
            type:         "string",
            default:      ".",
            describe:     "a directory to watch (can be used multiple times)"
        }
    )
    .option(
        "ignore",
        {
            demandOption: false,
            describe:     "Ignore activity for files matching the specified regex (can be used multiple times)"
        }
    )
    .wrap(process.stdout.columns ?? 80)
    .argv;

    //
    // Get the command from the command line arguments.
    //
    const [cmd, ...cmdArgs] = _.split(argv._[0] as string, /\s+/);

    //
    // Figure out which directories to watch.
    //
    const watchDirStrings = toArray(argv.watch);
    if (watchDirStrings.length === 0) {
        watchDirStrings.push(".");
    }

    // Convert the watched directory strings into Directory objects.
    const watchDirs = _.map(watchDirStrings, (curDir) => new Directory(curDir));

    // If any of the watched directories do not exist, exit.
    _.forEach(watchDirs, (curWatchDir) => {
        if (!curWatchDir.existsSync()) {
            console.error(`The directory "${curWatchDir.toString()}" does not exist.`);
            process.exit(-1);
        }
    });

    //
    // Setup the ignore regular expressions.
    //
    const ignoreRegexes: Array<RegExp> = _.map(toArray(argv.ignore as string), (curStr) => new RegExp(curStr));

    return {
        cmd:           cmd!,
        cmdArgs:       cmdArgs,
        watchDirs:     watchDirs,
        ignoreRegexes: ignoreRegexes
    };
}


/**
 * The main routine for this script.
 */
async function mainImpl(): Promise<Result<number, string>> {
    const config: IWatchConfig = await getConfiguration();
    console.log(`watching:  ${config.watchDirs.join(", ")}`);
    console.log("ignoring:  " + (config.ignoreRegexes.join(", ") || "nothing"));
    console.log(`command:   ${config.cmd} ${config.cmdArgs.join(" ")}`);

    //
    // Start watching the directories.
    //
    const watchListenerTracker = _.map(config.watchDirs, (curWatchDir) => {
        const tracker = new ListenerTracker(watch(curWatchDir.toString(), {recursive: true}));
        tracker.on("change", (eventType: string, filename: string): void => {
            // When this event is fired, filename is relative to the directory
            // being watched.  Since onFilesystemActivity() is being used to
            // watch *all* of the watched directories, the path must be
            // prepended to eliminate possible ambiguity.
            onFilesystemActivity(eventType, new File(curWatchDir, filename));
        });
        return tracker;
    });

    let isEnabled = true;
    let timerId: NodeJS.Timeout | undefined | "pending";
    let spawnResult: ISpawnResult | undefined;
    let killInProgress = false;

    //
    // Setup keypresses so that they too can trigger the command.
    //
    emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY && process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
        process.stdin.on("keypress", onKeypress);
    }

    //
    // Perform the action once just to get started.
    //
    performAction();


    /**
     * Handler for filesystem change events
     * @param eventType - string
     * @param eventType - The type of change that has occurred
     * @param file - The file that changed
     */
    function onFilesystemActivity(eventType: string, file: File): void {
        if (!isEnabled) {
            return;
        }

        if (matchesAny(file.toString(), config.ignoreRegexes)) {
            console.log(INFO_TEXT(`Ignoring filesystem activity for ${file.toString()}.`));
            return;
        }

        console.log(INFO_TEXT(`File modified: ${file.toString()}`));
        trigger();
    }


    /**
     * Handler for keypress events from stdin
     * @param str -
     * @param key - Information about the key that was pressed
     */
    function onKeypress(str: string, key: Key): void {
        // Allow ctrl+p to pause/unpause watching.
        if (!key.ctrl && !key.meta && key.name === "p") {
            isEnabled = !isEnabled;
            const msg = isEnabled ? "unpaused" : "paused";
            console.log(INFO_TEXT(msg));
            return;
        }

        // Allow ctrl+c to exit the process.
        if (key.ctrl && key.name === "c") {
            _.forEach(watchListenerTracker, (curWatcher) => curWatcher.removeAll());
            if (spawnResult) {
                killInProgress = true;
                treeKill(spawnResult.childProcess.pid!);
            }

            const __dontCare = (spawnResult?.closePromise ?? Promise.resolve(undefined))
            .catch(() => {
                // Intentionally empty
            })
            .then(() => {
                process.exit();
            });
            return;
        }

        if (isEnabled) {
            console.log(INFO_TEXT("Key pressed."));
            trigger();
        }
    }


    /**
     * Helper function that should be called whenever an event happens that
     * should trigger the command to run.  This function takes care of killing
     * any in-progress commands and debouncing triggers.
     */
    function trigger(): void {

        if (timerId !== undefined) {

            if (timerId !== "pending") {
                clearTimeout(timerId);
                timerId = setTimeout(performAction, DEBOUNCE_DELAY);
            }

            return;
        }
        else {
            // Prevent another trigger from queueing another launch.
            timerId = "pending";

            let promise: Promise<void>;
            if (spawnResult) {
                // The process is currently running.  Kill it.
                console.log(STOP_TEXT("----- Killing current child process. -----"));
                killInProgress = true;
                treeKill(spawnResult.childProcess.pid!);

                promise = spawnResult.closePromise
                .then(
                    () => {
                        // Intentionally empty
                    },
                    () => {
                        // Intentionally empty
                    }
                );
            }
            else {
                promise = Promise.resolve(undefined);
            }

            const __dontCare = promise
            .catch(() => {
                // Intentionally empty
            })
            .then(() => {
                killInProgress = false;
                timerId = setTimeout(performAction, DEBOUNCE_DELAY);
            });
        }
    }


    /**
     * Executes the command line provided by the user
     */
    function performAction(): void {
        console.log(START_TEXT(SEP));
        const startTimestamp = new Date().toLocaleString("en-US");
        const commandStr = `"${config.cmd} ${config.cmdArgs.join(" ")}"`;
        console.log(START_TEXT(startTimestamp));
        console.log(START_TEXT(`Executing command ${commandStr}`));
        console.log(START_TEXT(SEP));

        timerId = undefined;

        let spawnOptions: cp.SpawnOptions | undefined;
        if (getOs() === OperatingSystem.Windows) {
            spawnOptions = {shell: true};
        }
        spawnResult = spawn(config.cmd, config.cmdArgs, spawnOptions, undefined, process.stdout, process.stderr);

        spawnResult.closePromise
        .then(() => {
            if (killInProgress) {
                console.log("Process killed.");
            }
            else {
                const endTimestamp = new Date().toLocaleString("en-US");
                const msg = `✓ Success: ${commandStr}\n` +
                    `  started:  ${startTimestamp}\n` +
                    `  finished: ${endTimestamp}`;
                console.log(SUCCESS_TEXT(msg));
            }
        })
        .catch(() => {
            if (killInProgress) {
                console.log("Process killed.");
            }
            else {
                // This is here so we don't get unhandled rejection messages.
                const endTimestamp = new Date().toLocaleString("en-US");
                const msg = `✗ Failed: ${commandStr}\n` +
                    `  started:  ${startTimestamp}\n` +
                    `  finished: ${endTimestamp}`;
                console.log(FAIL_TEXT(msg));
            }
        })
        .finally(() => {
            console.log("");
            // timerId = undefined;
            spawnResult = undefined;
        });
    }

    return new SucceededResult(0);
}


////////////////////////////////////////////////////////////////////////////////
// Helper Functions
////////////////////////////////////////////////////////////////////////////////

/**
 * Tests to see if any patterns match _str_
 * @param str - The string to test
 * @param patterns - The regular expressions to test against
 * @return true if one or more patterns match _str_
 */
function matchesAny(str: string, patterns: Array<RegExp>): boolean {
    return _.some(patterns, (curPattern) => curPattern.test(str));
}
