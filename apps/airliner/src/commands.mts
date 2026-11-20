// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as _ from "lodash-es";
import { toggleComment } from "@repo/depot/comment";
import { Timeout } from "@repo/depot-node/timers";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { findGitRepoRootDir } from "@repo/depot-node/gitRepo";
import {
    enumerateDirectories,
    enumerateFiles,
    enumerateProjects,
    formatPath,
    type PathBase,
    type SlashStyle
} from "@repo/depot-node/repoEnumeration";


interface ICommandDefinition {
    name: string;
    fn:   () => void | Promise<void>;
}


const helloWorldCommand = {
    name: "extension.airlinerHelloWorld",
    fn:   async (): Promise<void> => {
        await Promise.resolve(0);
        vscode.window.showInformationMessage("Hello World from airliner - 7");
    }
};


////////////////////////////////////////////////////////////////////////////////
//
// Comments/uncomments the current selection or line.
//
////////////////////////////////////////////////////////////////////////////////
const toggleCommentCommand = {
    name: "extension.airlinerToggleComment",
    fn:   async (): Promise<void> => {
        // vscode.window.showInformationMessage("Airliner Toggle Comment");

        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }

        // If the selection is reversed, reverse it.
        if (editor.selection.isReversed) {
            editor.selection = new vscode.Selection(editor.selection.active, editor.selection.anchor);
        }

        // Extend the selection to column 0 of the first line and the end of the
        // line on the last line.
        editor.selection = new vscode.Selection(editor.selection.anchor.line, 0,
                                                editor.selection.active.line, 1000);

        // Figure out what text is in the previous line (if there is a previous
        // line).
        let precedingLine: string | undefined;
        if (editor.selection.anchor.line > 0) {
            const prevLineNum = editor.selection.anchor.line - 1;
            precedingLine = editor.document.getText(new vscode.Range(prevLineNum, 0, prevLineNum, 1000));
        }
        const selectedLines = editor.document.getText(editor.selection);

        const newText = toggleComment(selectedLines, precedingLine);

        if (newText) {
            await editor.edit((editBuilder: vscode.TextEditorEdit) => {
                editBuilder.replace(editor.selection, newText);
            });
        }

        // Get rid of the editor's selection.
        editor.selection = new vscode.Selection(
            editor.selection.active,
            editor.selection.active
        );

        await vscode.commands.executeCommand("cursorDown");
        await vscode.commands.executeCommand("cursorHome");
    }
};


////////////////////////////////////////////////////////////////////////////////
//
// Removes tab characters from the current document.
//
////////////////////////////////////////////////////////////////////////////////
const untabifyCommand = {
    name: "extension.airlinerUntabify",
    fn:   async (): Promise<void> => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }

        const tabSize = editor.options.tabSize;
        if (typeof tabSize === "string" || typeof tabSize === "undefined") {
            vscode.window.showInformationMessage("Tab size could not be determined.");
            return;
        }

        // Remember the current cursor location so it can be restored.
        const cursorPos: vscode.Position = editor.selection.active;

        const numLines = editor.document.lineCount;
        const docText  = editor.document.getText();
        const expanded = _.repeat(" ", tabSize);
        const newDocText = docText.replace(/\t/g, expanded);

        // Select the entire document.
        const wholeDocRange = new vscode.Range(0, 0, numLines - 1, 1000);

        await editor.edit((editBuilder: vscode.TextEditorEdit) => {
            editBuilder.replace(wholeDocRange, newDocText);
        });

        // Restore the cursor position.
        editor.selection = new vscode.Selection(cursorPos, cursorPos);
    }
};


////////////////////////////////////////////////////////////////////////////////
//
// Cuts selected text or the text between the cursor and the end of the line
// (if no text is selected).  If this command is executed repeatedly without
// more than a 2 second delay, the cut text is appended to the text already
// on the clipboard, thus accruing it.
//
////////////////////////////////////////////////////////////////////////////////

// If the user executes this command within this timeout period, this
// command will keep adding cut text to the clipboard.  Once the timeout
// expires, this command will replace the clipboard's contents.
const accrueTimeout = new Timeout(2 * 1000);
const textWithLeadingWhitespace = /^(?<leadingWhitespace>\s+)\S+/;


const cutToEolCommand = {
    name: "extension.airlinerCutToEol",
    fn:   async (): Promise<void> => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }

        // If we are accruing copied text (due to the timeout timer), then the
        // text we need to copy should start with the current clipboard
        // contents.
        let textToCopy = "";
        if (accrueTimeout.isRunning()) {
            textToCopy = await vscode.env.clipboard.readText();
        }

        const activePos = editor.selection.active;
        const eolPos = new vscode.Position(editor.selection.active.line, 1000);
        const toEolRange = new vscode.Range(activePos, eolPos);

        const toEolText =  editor.document.getText(toEolRange);
        if (toEolText.length > 0) {

            // If the text remaining on the line is whitespace followed by
            // non-whitespace, then kill just the leading whitespace.  By
            // removing just the whitespace, we will make joining two lines
            // easier.
            const match = textWithLeadingWhitespace.exec(toEolText);
            if (match) {
                const leadingWhitespace = match.groups!.leadingWhitespace!;
                textToCopy += leadingWhitespace;

                const whitespaceRange = new vscode.Range(
                    activePos,
                    new vscode.Position(activePos.line, activePos.character + leadingWhitespace.length)
                );

                // Remove the kill text from the document.
                await editor.edit((editBuilder: vscode.TextEditorEdit) => {
                    editBuilder.replace(whitespaceRange, "");
                });
            }
            else {
                textToCopy += toEolText;

                // Remove the kill text from the document.
                await editor.edit((editBuilder: vscode.TextEditorEdit) => {
                    editBuilder.replace(toEolRange, "");
                });
            }
        }
        else {
            textToCopy += "\n";
            vscode.commands.executeCommand("deleteRight");
        }

        await vscode.env.clipboard.writeText(textToCopy);

        // Restart the accrue timeout.
        accrueTimeout.start();
    }
};


////////////////////////////////////////////////////////////////////////////////
//
// Appends a semicolon onto the end of the current line.  Pretty simple.
//
////////////////////////////////////////////////////////////////////////////////
const appendSemicolonCommand = {
    name: "extension.airlinerAppendSemicolon",
    fn:   async (): Promise<void> => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }

        await editor.edit((editBuilder: vscode.TextEditorEdit) => {
            editBuilder.insert(new vscode.Position(editor.selection.active.line, 10000), ";");
        });
    }
};



////////////////////////////////////////////////////////////////////////////////
//
// Deletes whitespace characters to the left of the cursor until either a
// non-whitespace character is encountered or the beginning of the line.
//
////////////////////////////////////////////////////////////////////////////////
const hungryBackspaceCommand = {
    name: "extension.airlinerHungryBackspace",
    fn:   async (): Promise<void> => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }

        let done = false;
        let numDeletionsMade = 0;
        // A helper function that helps keep track of how many deletions have
        // been made.
        const doBackspace = async function (): Promise<void> {
            await vscode.commands.executeCommand("deleteLeft");
            numDeletionsMade++;
        };

        while (!done) {
            const activePos = editor.selection.active;
            if (numDeletionsMade === 0 && activePos.character === 0) {
                // If we are just starting and in column 0, backspace to the end
                // of the preceding line.  In this case, we are not done and may
                // delete whitespace at the end of the preceding line.
                await doBackspace();
                continue;
            }

            if (activePos.character === 0) {
                // Deletions have already been made and we have reached the
                // beginning of the line.  Stop deleting.
                done = true;
                continue;
            }

            const prevCharRange = new vscode.Range(
                activePos.line, activePos.character - 1,
                activePos.line, activePos.character
            );

            const prevChar = editor.document.getText(prevCharRange);

            if (!/\s/.test(prevChar)) {
                if (numDeletionsMade === 0) {
                    // The user has backspaced over a non-whitespace character.
                    // Behave like a normal backspace.
                    await doBackspace();
                }
                done = true;
                continue;
            }

            // The previous character is whitespace.  Delete it. We are not done
            // yet.
            await doBackspace();
        }
    }
};


////////////////////////////////////////////////////////////////////////////////
//
// Deletes whitespace characters to the right of the cursor until either a
// non-whitespace character is encountered or the end of the line.
//
////////////////////////////////////////////////////////////////////////////////
const hungryDeleteRightCommand = {
    name: "extension.airlinerHungryDeleteRight",
    fn:   async (): Promise<void> => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }
        const doc = vscode.window.activeTextEditor!.document;
        let done = false;
        let numDeletionsMade = 0;
        // A helper function that helps keep track of how many deletions have
        // been made.
        const doDeleteRight = async function (): Promise<void> {
            await vscode.commands.executeCommand("deleteRight");
            numDeletionsMade++;
        };
        while (!done) {
            const activePos = editor.selection.active;
            if (numDeletionsMade === 0 && isAtEndOfLine(doc, activePos)) {
                // If we are starting at the end of a line, delete right to pull
                // up the following line.  In this case, we are not done and may
                // delete whitespace at the beginning of the next line.
                await doDeleteRight();
                continue;
            }

            if (isAtEndOfLine(doc, activePos)) {
                // We have reached the end of the line.  Stop deleting.
                done = true;
                continue;
            }

            const nextCharRange = new vscode.Range(
                activePos.line, activePos.character,
                activePos.line, activePos.character + 1
            );

            const nextChar = editor.document.getText(nextCharRange);

            if (!/\s/.test(nextChar)) {
                if (numDeletionsMade === 0) {
                    // The user has deleted a non-whitespace character.
                    // Behave like a normal backspace.
                    await doDeleteRight();
                }
                done = true;
                continue;
            }
            // The next character is whitespace.  Delete it.
            await doDeleteRight();
        }
    }
};


////////////////////////////////////////////////////////////////////////////////
//
// Splits the current editor and takes you to the top of the file.  This is
// convenient when you have to add import statements or a #include to the
// top of you current file and don't want to lose your position.
//
////////////////////////////////////////////////////////////////////////////////
const splitTopCommand = {
    name: "extension.airlinerSplitTop",
    fn:   async (): Promise<void> => {
        // await vscode.commands.executeCommand("workbench.action.splitEditorDown");
        await vscode.commands.executeCommand("extension.airlinerSplitEditorDown");
        await vscode.commands.executeCommand("cursorTop");
    }
};


////////////////////////////////////////////////////////////////////////////////
//
// The normal vscode "workbench.action.splitEditorDown" command does not
// make sure that the cursor is visible in either the original editor nor
// the new editor.  So, if your cursor is in the lower half of the editor
// and you split it, you will have no idea where your cursor is until you
// move it.  This command fixes that.
//
////////////////////////////////////////////////////////////////////////////////
const splitEditorDownCommand = {
    name: "extension.airlinerSplitEditorDown",
    fn:   async (): Promise<void> => {
        const topEditor = vscode.window.activeTextEditor;
        if (!topEditor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }
        const topCursorPos = topEditor.selection.active;

        await vscode.commands.executeCommand("workbench.action.splitEditorDown");
        const bottomEditor = vscode.window.activeTextEditor!;

        topEditor.revealRange(
            new vscode.Range(topCursorPos, topCursorPos),
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );
        bottomEditor.revealRange(
            new vscode.Range(topCursorPos, topCursorPos),
            vscode.TextEditorRevealType.InCenterIfOutsideViewport
        );
    }
};


////////////////////////////////////////////////////////////////////////////////
//
// Prompts the user to switch to a file that is associated with the current
// editor's file.
//
////////////////////////////////////////////////////////////////////////////////
const associatedFilesCommand = {
    name: "extension.airlinerAssociatedFiles",
    fn:   async (): Promise<void> => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showInformationMessage("There is no active editor.");
            return;
        }

        if (activeEditor.document.uri.scheme !== "file") {
            vscode.window.showInformationMessage("Current editor has no associated file.");
            return;
        }

        const activeFile = new File(activeEditor.document.uri.fsPath);

        let baseName = activeFile.baseName;

        // The base name may have additional "." characters in it.  Remove all
        // "dot suffixes" until there are none left, leaving us with the true
        // base name.
        let done = false;
        let lastRemoved = "";
        while (!done) {
            const idx = baseName.lastIndexOf(".");
            if (idx === -1) {
                done = true;
            }
            else {
                lastRemoved = baseName.slice(idx);
                baseName = baseName.slice(0, idx);
            }
        }

        // If the active file started with a "." and we removed everything from
        // the base name, then put then use the leftmost "dot suffix" as the
        // base name.
        if (baseName.length === 0) {
            baseName = lastRemoved;
        }

        // Invoke the quick open command and seed it with the base name.
        await vscode.commands.executeCommand("workbench.action.quickOpen", baseName);
    }
};



////////////////////////////////////////////////////////////////////////////////
//
// Opens a new terminal whose working directory is the root of the Git
// repository containing the active editor's file.
//
////////////////////////////////////////////////////////////////////////////////
const openTerminalInRepoRootCommand = {
    name: "extension.airlinerOpenTerminalInRepoRoot",
    fn:   async (): Promise<void> => {
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor) {
            vscode.window.showErrorMessage("There is no active editor.");
            return;
        }

        if (activeEditor.document.uri.scheme !== "file") {
            vscode.window.showErrorMessage("Current editor has no associated file.");
            return;
        }

        const activeFile = new File(activeEditor.document.uri.fsPath);
        const repoRoot = await findGitRepoRootDir(activeFile.directory);
        if (!repoRoot) {
            vscode.window.showErrorMessage(
                `Could not find a Git repository containing ${activeFile.absPath()}.`
            );
            return;
        }

        const terminal = vscode.window.createTerminal({ cwd: repoRoot.absPath() });
        terminal.show();
    }
};


////////////////////////////////////////////////////////////////////////////////
//
// Lets the user pick a project in the repo (or, when there is no repo, in the
// workspace folder) and copies the project's name to the clipboard.
//
////////////////////////////////////////////////////////////////////////////////
const copyRepoProjectNameCommand = {
    name: "extension.airlinerCopyRepoProjectName",
    fn:   async (): Promise<void> => {
        const chosen = await chooseWorkspaceFolder();
        if (!chosen) {
            return;
        }

        const enumerationRoot = chosen.repoRoot ?? chosen.folder;
        let projects: Awaited<ReturnType<typeof enumerateProjects>>;
        try {
            projects = await enumerateProjects(enumerationRoot);
        }
        catch (err) {
            vscode.window.showErrorMessage(
                `Could not enumerate projects in ${enumerationRoot.absPath()}: ${String(err)}`
            );
            return;
        }

        if (projects.length === 0) {
            vscode.window.showInformationMessage("No projects found in this repo.");
            return;
        }

        const items = projects.map((curProject) => ({
            label:       curProject.name,
            description: curProject.relDir === "" ? "." : curProject.relDir
        }));
        const picked = await vscode.window.showQuickPick(items, {
            title:              "Copy repo project name",
            placeHolder:        "Select a project",
            matchOnDescription: true
        });
        if (!picked) {
            return;
        }

        await vscode.env.clipboard.writeText(picked.label);
        vscode.window.setStatusBarMessage(`Copied: ${picked.label}`, 3000);
    }
};


////////////////////////////////////////////////////////////////////////////////
//
// Lets the user pick a file or directory in the repo (or, when there is no
// repo, in the workspace folder) and copies its path to the clipboard.
//
////////////////////////////////////////////////////////////////////////////////
const copyRepoPathCommand = {
    name: "extension.airlinerCopyRepoPath",
    fn:   async (): Promise<void> => {
        const chosen = await chooseWorkspaceFolder();
        if (!chosen) {
            return;
        }

        // Relative paths are relative to the repo root, when there is one.
        const baseDir = chosen.repoRoot ?? chosen.folder;
        let items: Array<vscode.QuickPickItem & { relPath: string }>;
        try {
            const [files, directories] = await Promise.all([
                enumerateFiles(baseDir),
                enumerateDirectories(baseDir)
            ]);
            items = [
                ...files.map((relPath) => ({
                    label:    relPath,
                    iconPath: new vscode.ThemeIcon("file"),
                    relPath
                })),
                ...directories.map((relPath) => ({
                    label:    `${relPath}/`,
                    iconPath: new vscode.ThemeIcon("folder"),
                    relPath
                }))
            ];
        }
        catch (err) {
            vscode.window.showErrorMessage(
                `Could not enumerate files and directories in ${baseDir.absPath()}: ${String(err)}`
            );
            return;
        }

        if (items.length === 0) {
            vscode.window.showInformationMessage(
                `No files or directories found in ${baseDir.absPath()}.`
            );
            return;
        }

        // Sorting by label puts each directory right before its contents.
        items.sort((a, b) => (a.label < b.label ? -1 : (a.label > b.label ? 1 : 0)));

        const picked = await vscode.window.showQuickPick(items, {
            title:       "Copy repo path",
            placeHolder: "Select a file or directory"
        });
        if (!picked) {
            return;
        }

        // Relative paths only make sense when there is a repo root.
        let base: PathBase = "absolute";
        if (chosen.repoRoot) {
            const pickedBase = await vscode.window.showQuickPick(
                [
                    { label: "Repo-relative path", value: "relative" as const },
                    { label: "Absolute path",      value: "absolute" as const }
                ],
                { title: "Path to copy", placeHolder: "Relative to the repo root, or absolute?" }
            );
            if (!pickedBase) {
                return;
            }
            base = pickedBase.value;
        }

        // Other platforms have only one separator.
        let slashStyle: SlashStyle = "forward";
        if (process.platform === "win32") {
            const pickedSlash = await vscode.window.showQuickPick(
                [
                    { label: "Use forward slashes", value: "forward" as const },
                    { label: "Use backslashes",      value: "backward" as const }
                ],
                { title: "Path separator", placeHolder: "Which path separator?" }
            );
            if (!pickedSlash) {
                return;
            }
            slashStyle = pickedSlash.value;
        }

        const text = formatPath(baseDir.absPath(), picked.relPath, base, slashStyle);
        await vscode.env.clipboard.writeText(text);
        vscode.window.setStatusBarMessage(`Copied: ${text}`, 3000);
    }
};


////////////////////////////////////////////////////////////////////////////////
// Helper Functions
////////////////////////////////////////////////////////////////////////////////

/**
 * Has the user choose a workspace folder and finds the Git repository root
 * containing it.  Shows an error message when no workspace folder is open.
 * Prompts only when more than one workspace folder is open.
 *
 * @returns A promise for the chosen folder and the root of the repo that
 * contains it (`undefined` when it is not in a repo), or `undefined` when there
 * is no workspace folder or the user cancelled.
 */
async function chooseWorkspaceFolder(): Promise<
    { folder: Directory; repoRoot: Directory | undefined } | undefined
> {
    const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
    if (workspaceFolders.length === 0) {
        vscode.window.showErrorMessage("There is no open workspace folder.");
        return undefined;
    }

    let chosenFolder: vscode.WorkspaceFolder | undefined = workspaceFolders[0];
    if (workspaceFolders.length > 1) {
        const items = workspaceFolders.map((curFolder) => ({
            label:       curFolder.name,
            description: curFolder.uri.fsPath,
            folder:      curFolder
        }));
        const picked = await vscode.window.showQuickPick(items, {
            title:              "Select a workspace folder",
            placeHolder:        "Select a workspace folder",
            matchOnDescription: true
        });
        chosenFolder = picked?.folder;
    }

    if (!chosenFolder) {
        return undefined;
    }

    const folder = new Directory(chosenFolder.uri.fsPath);
    const repoRoot = await findGitRepoRootDir(folder);
    return { folder, repoRoot };
}


/**
 * Helper function that determines whether `position` is at the end of its line
 * @param doc - The document containing `position`
 * @param position - The position to be tested
 * @returns Whether `position` is at the end of its line
 */
function isAtEndOfLine(
    doc: vscode.TextDocument,
    position: vscode.Position
): boolean {
    const exaggeratedEndOfLine = new vscode.Position(position.line, position.character + 100000);
    const validated = doc.validatePosition(exaggeratedEndOfLine);
    return (position.line === validated.line) &&
           (position.character === validated.character);
}


////////////////////////////////////////////////////////////////////////////////
// Example Code
////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
// An example of how to prompt the user for a choice.
////////////////////////////////////////////////////////////////////////////
//
//     const options = ['Option 1', 'Option 2', 'Option 3'];
//     const selected = await vscode.window.showQuickPick(options, {
//         placeHolder: 'Choose an option',
//     });
//
//     if (selected) {
//         vscode.window.showInformationMessage(`You selected: ${selected}`);
//     } else {
//         vscode.window.showInformationMessage('No option was selected!');
//     }


////////////////////////////////////////////////////////////////////////////////


export const commands: Array<ICommandDefinition> = [
    helloWorldCommand,
    toggleCommentCommand,
    untabifyCommand,
    cutToEolCommand,
    appendSemicolonCommand,
    hungryBackspaceCommand,
    hungryDeleteRightCommand,
    splitTopCommand,
    splitEditorDownCommand,
    associatedFilesCommand,
    openTerminalInRepoRootCommand,
    copyRepoProjectNameCommand,
    copyRepoPathCommand
];
