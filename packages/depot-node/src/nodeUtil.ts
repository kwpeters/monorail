import {constants} from "fs";
import {EOL} from "os";
import * as _ from "lodash-es";
import { mapAsync } from "../../depot/src/promiseHelpers.js";
import { FailedResult, Result, SucceededResult } from "../../depot/src/result.js";
import { PromiseResult } from "../../depot/src/promiseResult.js";
import {Directory} from "./directory.js";
import {File} from "./file.js";
import { getOs, OperatingSystem } from "./os.js";


const SHEBANG = "#!";
const NODEJS_SHEBANG = "#!/usr/bin/env node";


/**
 * Makes the specified script file executable by prepending a shebang line and
 * setting file permissions.
 * @param file - The file to make executable
 * @return A promise that resolves with the file that was made executable
 */
export function makeNodeScriptExecutable(file: File): Promise<File> {
    return file.read()
    .then((text) => {
        const newText = NODEJS_SHEBANG + EOL + text;
        return file.write(newText);
    })
    .then(() => {
        // We need to set the access mode of the file to the current mode with
        // execute permissions OR'ed in (for owner, group and other).  So first
        // get the current mode bits.
        return file.exists();
    })
    .then((stats) => {
        // Turn on all execute bits.
        const newMode = stats!.mode | constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH;
        return file.chmod(newMode);
    })
    .then(() => {
        return file;
    });
}


/**
 * Adds a Node.js shebang line to the scpecified script file.
 *
 * @param file - The file to be modified
 * @return A failed result containning an error message if the specified file
 *   does not exist or if it already contains a shebang line.  A successful
 *   result if the file already contains a Node.js shebang line or if it was
 *   successfully inserted.
 */
export async function addShebang(file: File): Promise<Result<File, string>> {

    const oldTextRes = await PromiseResult.fromPromise(file.read());
    if (oldTextRes.failed) {
        return oldTextRes;
    }

    if (oldTextRes.value.startsWith(SHEBANG)) {

        if (oldTextRes.value.startsWith(NODEJS_SHEBANG)) {
            return new SucceededResult(file);
        }

        return new FailedResult(`The file "${file.toString()}" already has a shebang line.`);

    }
    const newText = NODEJS_SHEBANG + EOL + oldTextRes.value;

    const writeRes = await PromiseResult.fromPromise(file.write(newText));
    if (writeRes.failed) {
        return writeRes;
    }

    return new SucceededResult(file);
}


/**
 * Sets all executable bits for the specified file.
 *
 * @param param - The file to make executable
 * @return If successful, the file (for additional chaining); otherwise, an
 * error message.
 */
export async function makeFileExecutable(file: File): Promise<Result<File, string>> {

    // Get the current mode bits.
    const res = await PromiseResult.fromPromise(file.exists());
    if (res.failed) {
        return res;
    }

    // If the file does not exist, return a failed Result.
    if (res.value === undefined) {
        return new FailedResult(`File "${file.toString()}" does not exist.`);
    }

    // Set the new mode.
    const oldMode = res.value.mode;
    const newMode = oldMode | constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH;
    const changeRes = await PromiseResult.fromPromise(file.chmod(newMode));
    if (changeRes.failed) {
        return changeRes;
    }

    return new SucceededResult(file);
}


/**
 * Makes all .js files in the specified directory executable.
 * @param dir - The directory containing the .js files
 * @param recursive - Whether to search `dir` recursively for .js files
 * @return A promise that resolves with an array of files that were made
 * executable.
 */
export function makeAllJsScriptsExecutable(dir: Directory, recursive = false): Promise<Array<File>> {
    return dir.contents(recursive)
    .then((contents) => {
        const scriptFiles = _.filter(contents.files, (curFile) => curFile.extName === ".js");
        return mapAsync(scriptFiles, (curScriptFile) => makeNodeScriptExecutable(curScriptFile))
        .then(() => {
            return scriptFiles;
        });
    });
}


/**
 * Converts the specified `node_modules/.bin/` script file name to the one
 * that should be executed on the current OS.  On Windows, this means the file
 * with the `.cmd` extension.
 * @param nodeBinFile - The node binary symbolic link file that exists in
 * `node_modules/.bin/`.
 * @return The node script file that should be executed for the current OS.
 */
export function nodeBinForOs(nodeBinFile: File | string): File {
    const inputFile: File = nodeBinFile instanceof File ? nodeBinFile : new File(nodeBinFile);

    if (getOs() === OperatingSystem.Windows) {
        return new File(inputFile.directory, inputFile.baseName + ".cmd");
    }
    else {
        return inputFile;
    }
}


/**
 * Creates a Windows .cmd file that will launch the specified .js file using
 * Node.
 * @param jsFile - The JavaScript file to be launched by node.exe
 * @return A File object representing the created .cmd file.  If not running on
 *   Windows, a successful result containing undefined is returned.
 */
export async function createCmdLaunchScript(jsFile: File): Promise<Result<File | undefined, string>> {

    if (getOs() !== OperatingSystem.Windows) {
        return new SucceededResult(undefined);
    }

    const cmdFileName =  jsFile.baseName + ".cmd";
    const cmdFile = new File(jsFile.directory, cmdFileName);
    const cmdContents = getCmdLauncherCode(jsFile);

    const writeRes = await PromiseResult.fromPromise(cmdFile.write(cmdContents));
    if (writeRes.failed) {
        return writeRes;
    }

    return new SucceededResult(cmdFile);
}


/**
 * Gets the .cmd file code needed to launch the specified .js file using node.
 * @param jsFile - The .js file that will be run
 * @return The .cmd file code needed to launch the specified .js file using node
 */
function getCmdLauncherCode(jsFile: File): string {
    const cmdCode = `@IF EXIST "%~dp0\\node.exe" (` + EOL +
                    `    "%~dp0\\node.exe"  "%~dp0\\${jsFile.fileName}" %*` + EOL +
                    `) ELSE (` + EOL +
                    `    @SETLOCAL` + EOL +
                    `    @SET PATHEXT=%PATHEXT:;.JS;=;%` + EOL +
                    `    node  "%~dp0\\${jsFile.fileName}" %*` + EOL +
                    `)` + EOL;

    return cmdCode;
}
