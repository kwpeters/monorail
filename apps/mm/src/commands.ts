import { spawn } from "../../../packages/depot-node/src/spawn2.js";


////////////////////////////////////////////////////////////////////////////////
// Executable

export function isICommandExecutableDto(obj: unknown): obj is ICommandExecutable {
    const testObj = obj as ICommandExecutable;
    return testObj.type === "executable" &&
        typeof testObj.name === "string" &&
        typeof testObj.description === "string" &&
        typeof testObj.executable === "string" &&
        testObj.args.every((cur) => typeof cur === "string");
}

export interface ICommandExecutable {
    type: "executable";
    name: string;
    description: string;
    executable: string;
    args: Array<string>;

}


////////////////////////////////////////////////////////////////////////////////
// URL

export function isCommandUrlDto(obj: unknown): obj is ICommandUrl {
    const testObj = obj as ICommandUrl;
    return testObj.type === "url" &&
        typeof testObj.name === "string" &&
        typeof testObj.description === "string" &&
        typeof testObj.url === "string";
}

export interface ICommandUrl {
    type: "url";
    name: string;
    description: string;
    url: string;
}
