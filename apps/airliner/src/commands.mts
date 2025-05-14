// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
// eslint-disable-next-line import/no-unresolved
import * as vscode from "vscode";
import { SucceededResult } from "@repo/depot/result";

export const foo = new SucceededResult(5);

interface ICommandDefinition {
    name: string;
    fn:   () => void | Promise<void>;
}


export const commands: Array<ICommandDefinition> = [];

commands.push({
    name: "extension.airlinerHelloWorld",
    fn:   () => {
        // The code you place here will be executed every time your command is executed
        // Display a message box to the user
        vscode.window.showInformationMessage("Hello World from airliner - 5");
    }
});
