import { insertIf } from "../../depot/src/arrayHelpers.mjs";
import { File } from "./file.mjs";
import { getOs, OperatingSystem } from "./os.mjs";
import {spawn} from "./spawn2.mjs";


export async function showVsCodeDiff(fileA: File, fileB: File, useExisting = false, wait = true): Promise<void> {

    const cmd = getOs() === OperatingSystem.Windows ? "code.cmd" : "code";

    const args = [
        ...insertIf(!useExisting, "-n"),
        ...insertIf(wait, "--wait"),
        "--diff",
        fileA.toString(),
        fileB.toString()
    ];

    const spawnOut = spawn(cmd, args);
    await spawnOut.closePromise;
    return undefined;
}
