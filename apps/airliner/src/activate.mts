// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
// eslint-disable-next-line import/no-unresolved
import * as vscode from "vscode";

import { commands } from "./commands.mjs";


export function activate(context: vscode.ExtensionContext): void {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('Congratulations, your extension "airliner" is now active!');

    // const d = vscode.commands.registerCommand("extension.airlinerHelloWorld", () => {
    //     vscode.window.showInformationMessage("Hello World from airliner - 2");
    // });
    // context.subscriptions.push(d);

    commands.forEach((curCommandDef) => {
        const disposable = vscode.commands.registerCommand(curCommandDef.name, curCommandDef.fn);
        context.subscriptions.push(disposable);
    });
}
