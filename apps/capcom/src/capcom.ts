import * as url from "url";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { pipe } from "../../../packages/depot/src/pipe2.js";
import { insertIf } from "../../../packages/depot/src/arrayHelpers.js";
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
        process.exit(res.value);
    }
}


function runningThisScript(): boolean {
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]).href;
    return runningThisScript;
}


async function main(): Promise<Result<number, string>> {

    const results: Array<Result<File | Directory, string>> = [
        // The last item in the list is the active buffer in Emacs.
        getClipPaletteFile(),
        getNotesFolder(),
        getLogixFile(),
        ...insertIf(isHomePc(), await getFortyThreeFoldersFile()),
        getTodoFile(),
        ...insertIf(isWorkPc(), await appendToCaptlogIfNeeded())
    ];

    const allRes = Result.allArrayM(results);
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


function getLogixFile(): Result<File, string> {
    return pipe(
        getNotesFolder(),
        (dirRes) => Result.mapSuccess((dir) => new File(dir, "rockwell", "logix.org"), dirRes)
    );
}


function isWorkPc(): boolean {
    return !!process.env.WORK_PC;
}

function isHomePc(): boolean {
    return !process.env.WORK_PC;
}
