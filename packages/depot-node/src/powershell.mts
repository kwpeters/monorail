import { glob } from "glob";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { FailedResult, Result } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { insertIf } from "@repo/depot/arrayHelpers";
import { File } from "./file.mjs";
import { spawn, spawnErrorToString } from "./spawn2.mjs";


/**
 * Gets the executable file that runs legacy PowerShell.  Typically, this is:
 * %SystemRoot%\system32\WindowsPowerShell\v1.0\powershell.exe
 *
 * @return If the legacy executable can be found, a successful Result containing
 * a File representing that executable.  Otherwise, a failure Result containing
 * an error message.
 */
export async function getLegacyPowerShellExecutable(): Promise<Result<File, string>> {
    // Try to find the old PowerShell (powershell.exe).
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    let systemRoot = process.env.SystemRoot || ["C:", "Windows"].join("/");
    systemRoot = systemRoot.replace(/\\/g, "/");
    const legacyPowershellPattern = [systemRoot, "System32", "WindowsPowerShell", "**", "powershell.exe"].join("/");

    return pipeAsync(
        glob(legacyPowershellPattern),
        // Convert the array to a Result.
        (matchingPaths) => Result.requireNonEmptyArray(matchingPaths, "Legacy PowerShell (powershell.exe) could not be found."),
        // Take the first path.
        (resPaths) => Result.mapSuccess((paths) => paths[0]!, resPaths),
        // Convert the path to a File instance.
        (resPath) => Result.mapSuccess((path) => new File(path), resPath)
    );
}


/**
 * Gets the executable file that runs modern PowerShell.  Typically, this is:
 * C:\Program Files\PowerShell\7\pwsh.exe
 *
 * @return If the modern executable can be found, a successful Result containing
 * a File representing that executable.  Otherwise, a failure Result containing
 * an error message.
 */
export async function getModernPowerShellExecutable(): Promise<Result<File, string>> {
    const modernPowershellPattern = ["C:", "Program Files", "PowerShell", "**", "pwsh.exe"].join("/");
    return pipeAsync(
        glob(modernPowershellPattern),
        // Sort so the highest version number pwsh.exe will be last in the array.
        (matchingPaths) => matchingPaths.sort(),
        // Convert the array to a Result.
        (matchingPaths) => Result.requireNonEmptyArray(matchingPaths, "No modern PowerShell (pwsh.exe) could not be found."),
        // Take the last path.  It should be the one with the greatest version number.
        (resPaths) => Result.mapSuccess((paths) => paths[paths.length - 1]!, resPaths),
        // Convert the path to a File instance.
        (resPath) => Result.mapSuccess((path) => new File(path), resPath)
    );
}


/**
 * Finds the most recent PowerShell executable.
 *
 * @return If any PowerShell executables could be found, a successful Result
 * containing the found File.  Otherwise, an error Result containing an error
 * message.
 */
export async function getPowerShellExecutable(): Promise<Result<File, string>> {
    return pipeAsync(
        getModernPowerShellExecutable(),
        (resExecutable) => PromiseResult.bindError(() => getLegacyPowerShellExecutable(), resExecutable)
    );
}


export interface IPowerShellCommandOptions {
    loadProfile: boolean;
}

const defaultPowerShellCommandOptions: IPowerShellCommandOptions = {
    loadProfile: false
};



export async function runPowerShell(
    command: string,
    opts: Partial<IPowerShellCommandOptions> = {}
): Promise<Result<string, string>> {

    const resExec = await getPowerShellExecutable();
    if (resExec.failed) {
        return resExec;
    }

    // Fill in the options with default values.
    const newOpts = { ...defaultPowerShellCommandOptions, ...opts };

    const args = [
        ...insertIf(!newOpts.loadProfile, "-NoProfile"),
        "-Command",
        command
    ];

    const spawnOutput = spawn(resExec.value.absPath(), args);
    const resFinalOutput = await spawnOutput.closePromise;
    if (resFinalOutput.failed) {
        return new FailedResult(spawnErrorToString(resFinalOutput.error));
    }

    return resFinalOutput;
}
