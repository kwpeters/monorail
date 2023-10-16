
////////////////////////////////////////////////////////////////////////////////
// Executable

export interface ICommandExecutable {
    type: "executable";
    name: string;
    executable: string;
    args: Array<string>;
}


export function isICommandExecutable(obj: unknown): obj is ICommandExecutable {
    const testObj = obj as ICommandExecutable;
    return testObj.type === "executable" &&
        typeof testObj.name === "string" &&
        typeof testObj.executable === "string" &&
        testObj.args.every((cur) => typeof cur === "string");
}


////////////////////////////////////////////////////////////////////////////////
// URL

export interface ICommandUrl {
    type: "url";
    name: string;
    url: string;
}


export function isCommandUrl(obj: unknown): obj is ICommandUrl {
    const testObj = obj as ICommandUrl;
    return testObj.type === "url" &&
        typeof testObj.name === "string" &&
        typeof testObj.url === "string";
}


////////////////////////////////////////////////////////////////////////////////
// File Explorer

export interface ICommandFileExplorer {
    type: "file explorer";
    name: string;
    path: string;
}

export function isCommandFileExplorer(obj: unknown): obj is ICommandFileExplorer {
    const testObj = obj as ICommandFileExplorer;
    return testObj.type === "file explorer" &&
        typeof testObj.name === "string" &&
        typeof testObj.path === "string";
}


////////////////////////////////////////////////////////////////////////////////
// Clipboard

export interface ICommandClipboard {
    type: "clipboard";
    name: string;
    text: string;
}

export function isCommandClipboard(obj: unknown): obj is ICommandClipboard {
    const testObj = obj as ICommandClipboard;
    return testObj.type === "clipboard" &&
        typeof testObj.name === "string" &&
        typeof testObj.text === "string";
}
