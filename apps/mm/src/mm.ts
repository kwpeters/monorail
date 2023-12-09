import * as url from "url";
import { Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { assertNever } from "../../../packages/depot/src/never.js";
import { promptForChoiceFuzzy, registerFuzzyPrompt } from "../../../packages/depot-node/src/promptAutocomplete.js";
import { clipboardCommandDefinitions, executableCommandDefinitions, fsItemCommandDefinitions, urlCommandDefinitions } from "./subjects.js";
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
    registerFuzzyPrompt();
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


async function main(): Promise<Result<number, string>> {

    const configRes = await getConfiguration();
    if (configRes.failed) {
        return configRes;
    }

    const chosenSubject = await promptForChoiceFuzzy("subject:", configRes.value, (subject) => subject.name);
    let res: Result<string, string>;

    if (chosenSubject.type === "ISubjectExecutable") {
        const chosenCommand = await promptForChoiceFuzzy("command:", executableCommandDefinitions, (commandDef) => commandDef.name);
        res = await Promise.resolve(chosenCommand.fn(chosenSubject));
    }
    else if (chosenSubject.type === "ISubjectFsItem") {
        const chosenCommand = await promptForChoiceFuzzy("command:", fsItemCommandDefinitions, (commandDef) => commandDef.name);
        res = await Promise.resolve(chosenCommand.fn(chosenSubject));
    }
    else if (chosenSubject.type === "ISubjectUrl") {
        const chosenCommand = await promptForChoiceFuzzy("command:", urlCommandDefinitions, (commandDef) => commandDef.name);
        res = await Promise.resolve(chosenCommand.fn(chosenSubject));
    }
    else if (chosenSubject.type === "ISubjectClipboardText") {
        const chosenCommand = await promptForChoiceFuzzy("command:", clipboardCommandDefinitions, (commandDef) => commandDef.name);
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
