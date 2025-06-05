import {constants} from "node:fs";
import {EOL} from "node:os";
import * as _ from "lodash-es";
import { mapAsync } from "@repo/depot/promiseHelpers";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { Directory } from "./directory.mjs";
import { File } from "./file.mjs";
import { getOs, OperatingSystem } from "./os.mjs";
import { spawn, spawnErrorToString } from "./spawn2.mjs";


const SHEBANG = "#!";
const NODEJS_SHEBANG = "#!/usr/bin/env node";


/**
 * Makes the specified script file executable by prepending a shebang line and
 * setting file permissions.
 *
 * @param file - The file to make executable
 * @return A promise that resolves with the file that was made executable
 */
export async function makeNodeScriptExecutable(file: File): Promise<File> {

    const res = await addShebang(file);
    if (res.failed) {
        throw new Error(res.error);
    }

    // We need to set the access mode of the file to the current mode with
    // execute permissions OR'ed in (for owner, group and other).  So first
    // get the current mode bits.
    const stats = await file.exists();
    if (stats === undefined) {
        throw new Error("Unexpected error.");
    }

    // Turn on all execute bits.
    const newMode = stats.mode | constants.S_IXUSR | constants.S_IXGRP | constants.S_IXOTH;
    return file.chmod(newMode);
}


/**
 * Adds a Node.js shebang line to the specified script file.
 *
 * @param file - The file to be modified
 * @return A failed result containing an error message if the specified file
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
 *
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
 *
 * @param nodeBinFile - The node binary symbolic link file that exists in
 * `node_modules/.bin/`.
 * @return The node script file that should be executed for the current OS.
 */
export function nodeBinForOs(nodeBinFile: File | string): File {
    const inputFile: File = nodeBinFile instanceof File ? nodeBinFile : new File(nodeBinFile);

    if (getOs() === OperatingSystem.windows) {
        return new File(inputFile.directory, inputFile.baseName + ".cmd");
    }
    else {
        return inputFile;
    }
}


/**
 * DEPRECATED.  See getLaunchScriptCode().  Creates a Windows .cmd file that
 * will launch the specified .js file using Node.
 *
 * @param jsFile - The JavaScript file to be launched by node.exe
 * @return A File object representing the created .cmd file.  If not running on
 *   Windows, a successful result containing undefined is returned.
 */
export async function createCmdLaunchScript(jsFile: File): Promise<Result<File | undefined, string>> {

    if (getOs() !== OperatingSystem.windows) {
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


interface ILaunchScript {
    scriptFile: File;
    scriptCode: string;
}

/**
 * Generates script code that will launch the specified target .js file.
 *
 * @param launchScriptDir - Where this launch script will eventually reside
 * within the filesystem
 * @param targetJsFile - The .js file that will be run by this script
 * @return The platform
 */
export function getLaunchScriptCode(
    launchScriptDir: Directory,
    targetJsFile: File,
    launcherBaseName: string
): Result<ILaunchScript, string> {

    // Currently, only Windows is supported.  Will need to generate a bash
    // script on other operating systems, but I'm not going to worry about it
    // right now.
    if (getOs() !== OperatingSystem.windows) {
        return new FailedResult(`getLaunchScriptCode() is currently only supported on Windows.`);
    }

    // I could test to make sure the target file exists, but that seems like
    // an unnecessary restriction.  I don't need it to exist in order to do what
    // this function requires.

    // Get the relative path from the launch script to the target .js file.
    // Within the script code (below), this relative path will be appended to
    // the launch script's path (%~dp0 (drive and path of argument 0)).
    const targetRelPath = File.relative(launchScriptDir, targetJsFile);

    const lines = [
        `@IF EXIST "%~dp0\\node.exe" (`,
        `    "%~dp0\\node.exe"  "%~dp0\\${targetRelPath.toString()}" %*`,
        `) ELSE (`,
        `    @SETLOCAL`,
        `    @SET PATHEXT=%PATHEXT:;.JS;=;%`,
        `    node  "%~dp0\\${targetRelPath.toString() }" %*`,
        `)`
    ];

    const baseName = launcherBaseName || targetJsFile.baseName;
    return new SucceededResult({
        scriptFile: new File(launchScriptDir, `${baseName}.cmd` ),
        scriptCode: lines.join(EOL)
    });
}


/**
 * Gets the path to the Node.js executable.  This works even when this process
 * is being run by tsx.  This is done by running Node.js itself.
 *
 * @return A promise that resolves with a Result containing the Node.js
 * executable file if successful, or an error message if it fails.
 */
export async function getNodeExecutable(): Promise<Result<File, string>> {

    const cmd = "node";
    const args = ["-e", '"console.log(process.execPath);"'];

    const res = await spawn(cmd, args, { shell: true }).closePromise;
    if (res.failed) {
        return new FailedResult(spawnErrorToString(res.error));
    }

    const nodeExePath = res.value;
    const nodeExe = new File(nodeExePath);

    const exists = await nodeExe.exists();
    return exists ?
        new SucceededResult(nodeExe) :
        new FailedResult(`Node executable "${nodeExe.toString()}" does not exist.`);
}
