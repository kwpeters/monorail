import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { spawn } from "./spawn2.mjs";
import { File } from "./file.mjs";
import { Directory } from "./directory.mjs";
import { type FsItem } from "./fsItem.mjs";
import { OperatingSystem, getOs } from "./os.mjs";


export async function launchAdmin(executable: File, cwd: Directory | undefined = undefined): Promise<boolean> {
    // pwsh.exe -Command "Start-Process -Verb RunAs <executable>"
    const cmd = "pwsh.exe";
    const args = [
        "-Command",
        `Start-Process -Verb RunAs "${executable.toString()}"`
    ];

    const options = cwd ? { cwd: "c:\\" } : undefined;

    const spawnRes = await spawn(cmd, args, options).closePromise;
    return spawnRes.succeeded;
}


/**
 * Gets the UNC path to an item in the filesystem.
 *
 * @param fsItem - The item to get the UNC path to
 * @return A Promise that always resolves with a Result.  Successful results
 * contain the UNC path of fsItem.  Failed results contain an error message.
 */
export async function getUncPath(fsItem: FsItem): Promise<Result<string, string>> {

    // Because this function uses the "net use" command, this functionality is
    // currently only supported on Windows.
    if (getOs() !== OperatingSystem.Windows) {
        return new FailedResult(`getUncPath() only supports Windows.`);
    }

    const abspath = fsItem.absPath();

    const driveLetterRegex = /^(?<driveLetter>[a-z]):/i;
    const driveMatch = driveLetterRegex.exec(abspath);
    if (!driveMatch) {
        return new FailedResult(`Path "${abspath}" does not start with a drive letter.`);
    }

    const driveLetter = driveMatch.groups!.driveLetter;
    const spawnRes = await spawn("net", ["use", `${driveLetter}:`], { cwd: "c:\\" }).closePromise;

    if (spawnRes.failed) {
        return new FailedResult(`The path "${abspath}" is not a network path.`);
    }

    const remoteNameRegex = /^.*Remote name\s+\\\\(?<server>\w+)\\(?<share>\w+)$/im;
    const remoteMatch = remoteNameRegex.exec(spawnRes.value);
    if (!remoteMatch) {
        return new FailedResult(`Could not find server and share in "net use" output.`);
    }

    const server = remoteMatch.groups!.server;
    const share = remoteMatch.groups!.share;

    const unc = `\\\\${server}\\${share}${abspath.slice(2)}`;
    return new SucceededResult(unc);
}
