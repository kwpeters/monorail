import { spawn } from "./spawn2.js";
import { File } from "./file.js";
import { Directory } from "./directory.js";


export async function launchAdmin(executable: File, cwd: Directory | undefined = undefined): Promise<boolean> {
    // pwsh.exe -Command "Start-Process -Verb RunAs <executable>"
    const cmd = "pwsh.exe";
    const args = [
        "-Command",
        `Start-Process -Verb RunAs "${executable.toString()}"`
    ];

    // const options = cwd ? {cwd: cwd.toString()} : undefined;
    const options = cwd ? { cwd: "c:\\" } : undefined;

    const spawnRes = await spawn(cmd, args, options).closePromise;
    return spawnRes.succeeded;
}
