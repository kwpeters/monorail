import { Result, SucceededResult } from "@repo/depot/result";
import { insertIf } from "@repo/depot/arrayHelpers";
import { File } from "./file.mjs";
import { Directory } from "./directory.mjs";
import { launch } from "./launch.mjs";


/**
 * Open the specified file in Emacs.
 *
 * @param filesAndDirs - The file to be opened
 * @param openInExistingEditor - Whether to reuse an existing Emacs instance.
 *     Note: You must start the Emacs server using M-x server-start for this to
 *     work.
 */
export function openInEmacs(filesAndDirs: Array<File | Directory>, openInExistingEditor: boolean = false): void {
    let cmd: string;
    let args: Array<string> = [];

    if (openInExistingEditor) {
        cmd = "emacsclient";
        args.push("-n");
    }
    else {
        cmd = "emacs";
    }

    const argsAbsPaths = filesAndDirs.map((fileOrDir) => fileOrDir.absPath());
    args = args.concat(argsAbsPaths);
    launch(cmd, args);
}


/**
 * Launches a vscode diff for the specified files.
 *
 * @param left - File that will be on the left side
 * @param right - File that will be on the right side
 * @param newWindow - Whether to open a new instance of vscode
 * @return If successful, a string stating that vscode has been launched.
 * Otherwise, an error message.
 */
export function openVscodeDiff(left: File, right: File, newWindow = true): Result<string, string> {
    const cmd = "code";
    const args = [
        ...insertIf(newWindow, "--new-window"),
        "--diff",
        left.toString(),
        right.toString()
    ];
    launch(cmd, args, { shell: true });
    return new SucceededResult(`Opening vscode diff for "${left.toString()}" and "${right.toString()}".`);
}
