import { z } from "zod";
import clipboard from "clipboardy";
import { Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { pipeAsync } from "../../../packages/depot/src/pipeAsync2.js";
import { spawn as spawn2, spawnErrorToString } from "../../../packages/depot-node/src/spawn2.js";
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
            return pipeAsync(
                subject,
                (s) => {
                    launch(s.executable, s.args);
                    return new SucceededResult("");
                }
                // (spawnOut) => spawnOut.closePromise,
                // (res) => Result.mapError(spawnErrorToString, res)
            );
        }
    },
    {
        name: "run and copy output",
        fn:   (subject) => {
            return pipeAsync(
                subject,
                (s) => spawn2(s.executable, s.args, { cwd: s.cwd ?? "." }),
                (spawnOut) => spawnOut.closePromise,
                (res) => Result.mapError(spawnErrorToString, res),
                (res) => Result.tapSuccess((outputText) => clipboard.writeSync(outputText), res)
            );
        }
    },
    {
        name: "copy command line",
        fn:   (subject) => {
            return pipeAsync(
                subject,
                (s) => {
                    const text = `${s.executable} ${s.args.join(" ")}`;
                    clipboard.writeSync(text);
                    return text;
                },
                (text) => new SucceededResult(text)
            );
        }
    }
] as Array<ICommandDefinition<ExecutableSubject>>;


export const fsItemCommandDefinitions = [
    {
        name: "copy path",
        fn:   (subject) => {
            return pipeAsync(
                subject,
                (s) => {
                    clipboard.writeSync(s.path);
                    return s.path;
                },
                (path) => new SucceededResult(path)
            );
        }
    }
] as Array<ICommandDefinition<FsItemSubject>>;


export const urlCommandDefinitions = [
    {
        name: "copy",
        fn:   (subject) => {
            return pipeAsync(
                subject,
                (s) => {
                    clipboard.writeSync(s.url);
                    return s.url;
                },
                (url) => new SucceededResult(url)
            );
        }
    }
] as Array<ICommandDefinition<UrlSubject>>;


export const clipboardCommandDefinitions = [
    {
        name: "copy",
        fn:   (subject) => {
            return pipeAsync(
                subject,
                (s) => {
                    clipboard.writeSync(s.text);
                    return s.text;
                },
                (text) => new SucceededResult(text)
            );
        }
    }
] as Array<ICommandDefinition<ClipboardSubject>>;
