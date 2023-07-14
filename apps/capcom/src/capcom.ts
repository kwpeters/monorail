import * as url from "url";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { Directory } from "../../../packages//depot-node/src/directory.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { openInEmacs } from "../../../packages/depot-node/src/editor.js";
import { appendToCaptlogIfNeeded } from "./captlog.js";
import { getFortyThreeFoldersFile } from "./fortyThreeFolders.js";


if (runningThisScript()) {

    const res = await PromiseResult.forceResult(main());
    if (res.failed) {
        console.error(res.error);
        process.exit(-1);
    }
    else if (res.value !== 0) {
        console.error(`Script exited with code ${res.value}.`);
        process.exit(-1);
    }
}


function runningThisScript(): boolean {
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]).href;
    return runningThisScript;
}


async function main(): Promise<Result<number, string>> {
    // Append to the captlog file if needed.
    const captlogRes = await appendToCaptlogIfNeeded();
    const fortyThreeFoldersRes = await getFortyThreeFoldersFile();
    const todoFileRes = getTodoFile();
    const clipPaletteFileRes = getClipPaletteFile();
    const notesDirRes = getNotesFolder();

    const allRes = Result.allM(
        fortyThreeFoldersRes,
        todoFileRes,
        clipPaletteFileRes,
        notesDirRes,
        // Last item will be the one on top in Emacs
        captlogRes
    );
    if (allRes.failed) {
        return allRes;
    }

    openInEmacs([...allRes.value], false);

    return new SucceededResult(0);
}


function getTodoFile(): Result<File, string> {
    const cloudHome = process.env.CLOUDHOME;
    if (!cloudHome) {
        return new FailedResult(`CLOUDHOME environment variable is not set.`);
    }

    return new SucceededResult(new File(cloudHome, "data", "todo.org"));
}


function getClipPaletteFile(): Result<File, string> {
    const cloudHome = process.env.CLOUDHOME;
    if (!cloudHome) {
        return new FailedResult(`CLOUDHOME environment variable is not set.`);
    }

    return new SucceededResult(new File(cloudHome, "data", "clippalette.org"));
}


function getNotesFolder(): Result<Directory, string> {
    const cloudHome = process.env.CLOUDHOME;
    if (!cloudHome) {
        return new FailedResult(`CLOUDHOME environment variable is not set.`);
    }

    return new SucceededResult(new Directory(cloudHome, "data", "notes"));
}
