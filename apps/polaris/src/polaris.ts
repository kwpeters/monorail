import * as os from "os";
import * as url from "url";
import stripJsonComments from "strip-json-comments";
import inquirer, {Answers} from "inquirer";
import inquirerPrompt from 'inquirer-autocomplete-prompt';
import fuzzy from "fuzzy";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { pipe } from "../../../packages/depot/src/pipe.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { spawn } from "../../../packages/depot-node/src/spawn2.js";


// TODO: Use Zod to parse the external config file to make sure it is valid.
// https://stackoverflow.com/questions/75556846/zod-parse-external-json-file



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


interface ICommandExecutableDto {
    type: "executable";
    name: string;
    description: string;
    executable: string;
    args: Array<string>;
}

function isICommandExecutableDto(obj: unknown): obj is ICommandExecutableDto {
    const testObj = obj as ICommandExecutableDto;
    return testObj.type === "executable" &&
        typeof testObj.name === "string" &&
        typeof testObj.description === "string" &&
        typeof testObj.executable === "string" &&
        testObj.args.every((cur) => typeof cur === "string");
}

interface ICommandExecutable {
    type: "executable";
    name: string;
    description: string;
    executable: string;
    args: Array<string>;

}


interface ICommandUrlDto {
    type: "url";
    name: string;
    description: string;
    url: string;
}

function isCommandUrlDto(obj: unknown): obj is ICommandUrlDto {
    const testObj = obj as ICommandUrlDto;
    return testObj.type === "url" &&
           typeof testObj.name === "string" &&
           typeof testObj.description === "string" &&
           typeof testObj.url === "string";
}

interface ICommandUrl {
    type: "url";
    name: string;
    description: string;
    url: string;
}


type Command = ICommandExecutable | ICommandUrl;


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
        type:    "autocomplete",
        name:    "command",
        message: "command:",
        source:  choiceFilterFn
    };

    const answers = await inquirer.prompt<{ command: Command; }>([questionCommand]);

    console.log(JSON.stringify(answers, undefined, 4));

    return new SucceededResult(0);
}


function commandToChoice(cmd: Command): { name: string, value: Command} {
    return {
        name:  cmd.name,
        value: cmd
    };
}

function commandsToChoices(cmds: Array<Command>): Array<{ name: string, value: Command}> {
    return cmds.map(commandToChoice);
}


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

    const configFile = new File(new Directory(homeDirStr), "polaris.json");
    const configFileStats = await configFile.exists();
    if (!configFileStats) {
        return new FailedResult(`Configuration file "${configFile.toString()}" does not exist.`);
    }

    const configJsonStr = await configFile.read();
    const configJson = JSON.parse(stripJsonComments(configJsonStr)) as {commands: Array<unknown>};

    const res = Result.allArrayM(configJson.commands.map(dtoToCommand));
    return res;
}


function dtoToCommand(obj: unknown): Result<Command, string> {

    if (isICommandExecutableDto(obj)) {
        return new SucceededResult(obj);
    }
    else if (isCommandUrlDto(obj)) {
        return new SucceededResult(obj);
    }
    else {
        return new FailedResult(`Unknown command "${JSON.stringify(obj)}".`);
    }
}
