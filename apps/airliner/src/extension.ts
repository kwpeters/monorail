// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
// eslint-disable-next-line import/no-unresolved
import * as vscode from "vscode";


////////////////////////////////////////////////////////////////////////////////






// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext): Promise<void> {

    // const d = vscode.commands.registerCommand("extension.airlinerHelloWorld", () => {
    //     vscode.window.showInformationMessage("Hello World from airliner!");
    // });
    // context.subscriptions.push(d);

    return import("./activate.mjs")
    .then(
        (mod) => {
            mod.activate(context);
        },
        () => {
            throw new Error("Failed to load esm module.");
        }
    );

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    // console.log('Congratulations, your extension "airliner" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    // const disposable = vscode.commands.registerCommand("airliner.helloWorld", () => {
    //     // The code you place here will be executed every time your command is executed
    //     // Display a message box to the user
    //     vscode.window.showInformationMessage("Hello World from airliner!");
    // });
    // context.subscriptions.push(disposable);

    // commands.forEach((curCommandDef) => {
        // const disposable = vscode.commands.registerCommand(curCommandDef.name, curCommandDef.fn);
        // context.subscriptions.push(disposable);
    // });
}

// This method is called when your extension is deactivated
export function deactivate(): void {}
