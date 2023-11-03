import { z } from "zod";
import clipboard from "clipboardy";
import { Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { pipeAsync } from "../../../packages/depot/src/pipeAsync2.js";
import { spawn, spawnErrorToString } from "../../../packages/depot-node/src/spawn2.js";
import { launch } from "../../../packages/depot-node/src/launch.js";


//
// ExecutableSubject
//
export const executableSubjectSchema = z.object({
    type:       z.literal("ISubjectExecutable"),
    name:       z.string(),
    executable: z.string(),
    args:       z.array(z.string()),
    cwd:        z.string().optional()
}).strict();
export type ExecutableSubject = z.infer<typeof executableSubjectSchema>;


//
// FsItemSubject
//
export const fsItemSubjectSchema = z.object({
    type: z.literal("ISubjectFsItem"),
    name: z.string(),
    path: z.string()
}).strict();
export type FsItemSubject = z.infer<typeof fsItemSubjectSchema>;


//
// UrlSubject
//
export const urlSubjectSchema = z.object({
    type: z.literal("ISubjectUrl"),
    name: z.string(),
    url:  z.string()
}).strict();
export type UrlSubject = z.infer<typeof urlSubjectSchema>;


//
// ClipboardSubject
//
export const clipboardSubjectSchema = z.object({
    type: z.literal("ISubjectClipboardText"),
    name: z.string(),
    text: z.string()
}).strict();
export type ClipboardSubject = z.infer<typeof clipboardSubjectSchema>;


//
// All subjects
//
export const subjectSchema = z.discriminatedUnion(
    "type",
    [
        executableSubjectSchema,
        fsItemSubjectSchema,
        urlSubjectSchema,
        clipboardSubjectSchema
    ]
);
export type Subject = z.infer<typeof subjectSchema>;


////////////////////////////////////////////////////////////////////////////////
// Commands
////////////////////////////////////////////////////////////////////////////////

export type CommandFn<TSubject> = (subject: TSubject) => Result<string, string> | Promise<Result<string, string>>;



export interface ICommandDefinition<TSubject> {
    name: string,
    fn:   CommandFn<TSubject>
}


export const executableCommandDefinitions = [
    {
        name: "run",
        fn:   (subject) => {
            launch(subject.executable, subject.args);
            return new SucceededResult(`${subject.executable} ${subject.args.join(" ")}`);
        }
    },
    {
        name: "run and copy output",
        fn:   (subject) => {
            return pipeAsync(
                subject,
                (s) => spawn(s.executable, s.args, { cwd: s.cwd ?? "." }),
                (spawnOut) => spawnOut.closePromise,
                (res) => Result.mapError(spawnErrorToString, res),
                (res) => Result.tapSuccess((outputText) => clipboard.writeSync(outputText), res)
            );
        }
    },
    {
        name: "copy command line",
        fn:   (subject) => {
            const text = `${subject.executable} ${subject.args.join(" ")}`;
            clipboard.writeSync(text);
            return new SucceededResult(text);
        }
    },
    {
        name: "show executable in Explorer",
        fn:   (subject) => showInExplorer(subject.executable)
    }
] as Array<ICommandDefinition<ExecutableSubject>>;


export const fsItemCommandDefinitions = [
    {
        name: "open in file explorer",
        fn:   (subject) => showInExplorer(subject.path)
    },
    {
        name: "start/open with default application",
        fn:   (subject) => start(subject.path)
    },
    {
        name: "copy path",
        fn:   (subject) => {
            clipboard.writeSync(subject.path);
            return new SucceededResult(subject.path);
        }
    },
    {
        name: "open in vscode",
        fn:   (subject) => openInVisualStudioCode(subject.path)
    }
] as Array<ICommandDefinition<FsItemSubject>>;


export const urlCommandDefinitions = [
    {
        name: "open in browser",
        fn:   (subject) => start(subject.url)
    },
    {
        name: "copy",
        fn:   (subject) => {
            clipboard.writeSync(subject.url);
            return new SucceededResult(subject.url);
        }
    }
] as Array<ICommandDefinition<UrlSubject>>;


export const clipboardCommandDefinitions = [
    {
        name: "copy",
        fn:   (subject) => {
            clipboard.writeSync(subject.text);
            return new SucceededResult(subject.text);
        }
    }
] as Array<ICommandDefinition<ClipboardSubject>>;


function showInExplorer(path: string): Result<string, string> {
    launch("explorer", [path], { shell: true, windowsVerbatimArguments: true });
    return new SucceededResult("path");
}

function openInVisualStudioCode(path: string): Result<string, string> {
    launch("code", [path], {shell: true});
    return new SucceededResult(`Opening "${path}" in vscode...`);
}

function start(path: string): Result<string, string> {
    launch("start", [path], { shell: true });
    return new SucceededResult(`Starting file in default application: "${path}"`);
}
