import * as url from "url";
import stripJsonComments from "strip-json-comments";
import inquirer, {Answers} from "inquirer";
import inquirerPrompt from "inquirer-autocomplete-prompt";
import fuzzy from "fuzzy";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { assertNever } from "../../../packages/depot/src/never.js";
import { spawn, spawnErrorToString } from "../../../packages/depot-node/src/spawn2.js";
import { ICommandExecutable, ICommandFileExplorer, ICommandUrl, isCommandFileExplorer, isCommandUrl, isICommandExecutable } from "./commands.js";


////////////////////////////////////////////////////////////////////////////////
// TODO: Check to see if folders exist.  If they don't I can probably remove
// those "file explorer" commands from the list. Alternative approach (which is
// probably better)... let the user choose the command.  Check the path before
// attempting it.  If it doesn't exist, display a message.
// See the following post about how to show a message box:
// https://stackoverflow.com/questions/56352600/how-can-show-alert-message-in-node-js
////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////////
// TODO: In paths read from config file, convert forward slashes to back slashes
// so users don't have to do so much escaping in the config file.
////////////////////////////////////////////////////////////////////////////////


if (runningThisScript()) {
    registerCustomPrompts();
    const res = await PromiseResult.forceResult(main());
    if (res.failed) {
        console.error(res.error);
        process.exit(-1);
    }
    else if (res.value !== 0) {
        console.error(`Script exited with code ${res.value}.`);
        process.exit(res.value);
    }
}


function runningThisScript(): boolean {
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]).href;
    return runningThisScript;
}


function registerCustomPrompts() {
    inquirer.registerPrompt("autocomplete", inquirerPrompt);
}


type Command = ICommandExecutable | ICommandUrl | ICommandFileExplorer;


async function main(): Promise<Result<number, string>> {

    const configRes = await getConfiguration();
    if (configRes.failed) {
        return configRes;
    }

    const commands = configRes.value;

    const fuzzyOpts = {
        extract: (cmd: Command) => cmd.name
    };

    const choiceFilterFn = (previousAnswers: Answers, searchStr: string) => {
        if (!searchStr) {
            return commandsToChoices(commands);
        }

        const fuzzyMatches = fuzzy.filter(searchStr, commands, fuzzyOpts);
        const matchingCommands = fuzzyMatches.map((fuzzyMatch) => fuzzyMatch.original);
        return Promise.resolve(commandsToChoices(matchingCommands));
    };

    const questionCommand = {
        type:     "autocomplete",
        name:     "command",
        message:  "command:",
        source:   choiceFilterFn,
        pageSize: 25
    };

    const answers = await inquirer.prompt<{ command: Command; }>([questionCommand]);
    const cmd = answers.command;

    const executeRes = await executeCommand(cmd);
    if (executeRes.failed) {
        return executeRes;
    }

    return new SucceededResult(0);
}


/**
 * Converts a single Command to a Choice that can be used by the inquirer
 * library.
 *
 * @param cmd - The Command to be converted.
 * @return The resulting Choice
 */
function commandToChoice(cmd: Command): { name: string, value: Command} {
    return {
        name:  cmd.name,
        value: cmd
    };
}


/**
 * Converts an array of Commands to an array of Choice instances that can be
 * used by the inquirer library.
 *
 * @param cmds - The Commands to be converted
 * @return The resulting Choice instances
 */
function commandsToChoices(cmds: Array<Command>): Array<{ name: string, value: Command}> {
    return cmds.map(commandToChoice);
}


/**
 * Gets the configuration for this application.
 *
 * @return If the configuration file is successfully read, the array of
 * commands defined in it.
 */
async function getConfiguration(): Promise<Result<Array<Command>, string>> {

    let homeDirStr: string;
    if (process.env.CLOUDHOME) {
        homeDirStr = process.env.CLOUDHOME;
    }
    else if (process.env.HOME) {
        homeDirStr = process.env.HOME;
    }
    else {
        return new FailedResult("No CLOUDHOME or HOME environment variable is set.");
    }

    const configFile = new File(new Directory(homeDirStr), "mm.json");
    const configFileStats = await configFile.exists();
    if (!configFileStats) {
        return new FailedResult(`Configuration file "${configFile.toString()}" does not exist.`);
    }

    const configJsonStr = await configFile.read();
    const configJson = JSON.parse(stripJsonComments(configJsonStr)) as {commands: Array<unknown>};

    const res = Result.allArrayM(configJson.commands.map(dtoToCommand));
    return res;
}


/**
 * Converts a command DTO from the configuration file to a Command instance.
 *
 * @param commandDto - The DTO from the configuration file
 * @return If successful, the validated Command instance.
 */
function dtoToCommand(commandDto: unknown): Result<Command, string> {

    if (isICommandExecutable(commandDto)) {
        return new SucceededResult(commandDto);
    }
    else if (isCommandUrl(commandDto)) {
        return new SucceededResult(commandDto);
    }
    else if (isCommandFileExplorer(commandDto)) {
        return new SucceededResult(commandDto);
    }
    else {
        return new FailedResult(`Unknown command "${JSON.stringify(commandDto)}".`);
    }
}


/**
 * Executes the specified command.
 *
 * @param cmd - The Command to be executed.
 * @return Status of the executed command.
 */
async function executeCommand(cmd: Command): Promise<Result<string, string>> {

    if (cmd.type === "executable") {
        const spawnOut = spawn(cmd.executable, cmd.args);
        const spawnRes = await spawnOut.closePromise;
        return Result.mapError(spawnErrorToString, spawnRes);
    }
    else if (cmd.type === "url") {
        const executable = "start";
        const spawnOut = spawn(executable, [cmd.url], {shell: true});
        const spawnRes = await spawnOut.closePromise;
        return Result.mapError(spawnErrorToString, spawnRes);
    }
    else if (cmd.type === "file explorer") {
        const executable = "explorer";
        const __spawnOut = spawn(executable, [cmd.path], { shell: true, windowsVerbatimArguments: true });
        // const spawnRes = await spawnOut.closePromise;
        // Don't trust the exit code.
        return new SucceededResult("");
    }
    else {
        assertNever(cmd);
    }
}
