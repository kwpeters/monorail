import { FailedResult, Result, SucceededResult } from "../../depot/src/result.js";
import { spawn } from "./spawn2.js";
import { File } from "./file.js";
import { Directory } from "./directory.js";
import { FsItem } from "./fsItem.js";


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


export async function getUncPath(fsItem: FsItem): Promise<Result<string, string>> {
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
