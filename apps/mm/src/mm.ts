import * as url from "url";
import inquirer, {Answers} from "inquirer";
import inquirerPrompt from "inquirer-autocomplete-prompt";
import fuzzy from "fuzzy";
import { Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { assertNever } from "../../../packages/depot/src/never.js";
import { ICommandDefinition, Subject, clipboardCommandDefinitions, executableCommandDefinitions, fsItemCommandDefinitions, urlCommandDefinitions } from "./subjects.js";
import { getConfiguration } from "./configuration.js";


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


async function main(): Promise<Result<number, string>> {

    const configRes = await getConfiguration();
    if (configRes.failed) {
        return configRes;
    }

    const chosenSubject = await promptForSubject(configRes.value);
    let res: Result<string, string>;

    if (chosenSubject.type === "ISubjectExecutable") {

        const chosenCommand = await promptForCommand(executableCommandDefinitions);
        res = await Promise.resolve(chosenCommand.fn(chosenSubject));
    }
    else if (chosenSubject.type === "ISubjectFsItem") {
        const chosenCommand = await promptForCommand(fsItemCommandDefinitions);
        res = await Promise.resolve(chosenCommand.fn(chosenSubject));
    }
    else if (chosenSubject.type === "ISubjectUrl") {
        const chosenCommand = await promptForCommand(urlCommandDefinitions);
        res = await Promise.resolve(chosenCommand.fn(chosenSubject));
    }
    else if (chosenSubject.type === "ISubjectClipboardText") {
        const chosenCommand = await promptForCommand(clipboardCommandDefinitions);
        res = await Promise.resolve(chosenCommand.fn(chosenSubject));
    }
    else {
        assertNever(chosenSubject);
    }

    if (res.failed) {
        console.error(`Command failed: ${res.error}`);
    }

    return new SucceededResult(0);
}


async function promptForSubject(subjects: Subject[]): Promise<Subject> {

    const choiceFilterFn = (previousAnswers: Answers, searchStr: string) => {
        if (!searchStr) {
            return subjectsToChoices(subjects);
        }

        const fuzzyMatches = fuzzy.filter(searchStr, subjects, { extract: (subject: Subject) => subject.name });
        const matchingSubjects = fuzzyMatches.map((fuzzyMatch) => fuzzyMatch.original);
        return Promise.resolve(subjectsToChoices(matchingSubjects));
    };

    const questionSubject = {
        type:     "autocomplete",
        name:     "subject",
        message:  "subject:",
        source:   choiceFilterFn,
        pageSize: 25
    };

    const answers = await inquirer.prompt<{ subject: Subject; }>([questionSubject]);
    return answers.subject;
}


async function promptForCommand<TSubject>(
    commandDefs: Array<ICommandDefinition<TSubject>>
): Promise<ICommandDefinition<TSubject>> {
    const choiceFilterFn = (previousAnswers: Answers, searchStr: string) => {
        if (!searchStr) {
            return commandDefsToChoices(commandDefs);
        }

        const fuzzyMatches = fuzzy.filter(
            searchStr,
            commandDefs,
            {
                extract: (commandDef: ICommandDefinition<TSubject>) => commandDef.name
            }
        );
        const matchingCommands = fuzzyMatches.map((fuzzyMatch) => fuzzyMatch.original);
        return Promise.resolve(commandDefsToChoices(matchingCommands));
    };

    const questionCommand = {
        type:     "autocomplete",
        name:     "commandDef",
        message:  "command:",
        source:   choiceFilterFn,
        pageSize: 25
    };

    const answers = await inquirer.prompt<{ commandDef: ICommandDefinition<TSubject>; }>([questionCommand]);
    return answers.commandDef;
}

function commandDefsToChoices<TSubject>(
    commandDefs: Array<ICommandDefinition<TSubject>>
): Array<{name: string, value: ICommandDefinition<TSubject>}> {
    return commandDefs.map((curCommandDef) => ({ name: curCommandDef.name, value: curCommandDef}));
}


/**
 * Converts an array of Subjects to an array of Choice instances that can be
 * used by the inquirer library.
 *
 * @param subjects - The Subjects to be converted
 * @return The resulting Choice instances
 */
function subjectsToChoices(subjects: Array<Subject>): Array<{ name: string, value: Subject}> {
    return subjects.map((curSubject) => ({name: curSubject.name, value: curSubject}));
}








/**
 * Executes the specified command.
 *
 * @param subject - The Subject to be executed.
 * @return Status of the executed command.
 */
// async function executeCommand(subject: Command): Promise<Result<string, string>> {
//
//     if (subject.type === "executable") {
//         const spawnOut = spawn(subject.executable, subject.args);
//         const spawnRes = await spawnOut.closePromise;
//         return Result.mapError(spawnErrorToString, spawnRes);
//     }
//     else if (subject.type === "url") {
//         const executable = "start";
//         const spawnOut = spawn(executable, [subject.url], {shell: true});
//         const spawnRes = await spawnOut.closePromise;
//         return Result.mapError(spawnErrorToString, spawnRes);
//     }
//     else if (subject.type === "file explorer") {
//         const executable = "explorer";
//         const __spawnOut = spawn(executable, [subject.path], { shell: true, windowsVerbatimArguments: true });
//         // const spawnRes = await spawnOut.closePromise;
//         // Don't trust the exit code.
//         return new SucceededResult("");
//     }
//     else if (subject.type === "clipboard") {
//         clipboard.writeSync(subject.text);
//         return new SucceededResult("");
//     }
//     else {
//         assertNever(subject);
//     }
// }
