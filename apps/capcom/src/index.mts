import * as url from "node:url";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { pipe } from "@repo/depot/pipe2";
import { insertIf } from "@repo/depot/arrayHelpers";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { openInEmacs } from "@repo/depot-node/editor";
import { appendToCaptlogIfNeeded } from "./captlog.mjs";
import { getFortyThreeFoldersFile } from "./fortyThreeFolders.mjs";


if (runningThisScript()) {

    const res = await PromiseResult.forceResult(main());
    if (res.failed) {
        console.error(`❌ ${res.error}`);
        process.exit(-1);
    }
    else if (res.value !== 0) {
        console.error(`Script exited with code ${res.value}.`);
        process.exit(res.value);
    }
}


function runningThisScript(): boolean {
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]!).href;
    return runningThisScript;
}


async function main(): Promise<Result<number, string>> {

    const results: Array<Result<File | Directory, string>> = [
        // The last item in the list is the active buffer in Emacs.
        getClipPaletteFile(),
        getNotesFolder(),
        ...insertIf(isWorkPc(), getLogixFile()),
        await getFortyThreeFoldersFile(),
        getTodoFile(),
        await appendToCaptlogIfNeeded()
    ];

    const allRes = Result.allArrayM(results);
    if (allRes.failed) {
        return allRes;
    }

    openInEmacs([...allRes.value], false);
    return new SucceededResult(0);
}


function getTodoFile(): Result<File, string> {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const cloudHome = process.env.CLOUDHOME;
    if (!cloudHome) {
        return new FailedResult(`CLOUDHOME environment variable is not set.`);
    }

    return new SucceededResult(new File(cloudHome, "data", "todo.org"));
}


function getClipPaletteFile(): Result<File, string> {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const cloudHome = process.env.CLOUDHOME;
    if (!cloudHome) {
        return new FailedResult(`CLOUDHOME environment variable is not set.`);
    }

    return new SucceededResult(new File(cloudHome, "data", "clippalette.org"));
}


function getNotesFolder(): Result<Directory, string> {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
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
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    return !!process.env.WORK_PC;
}

// function isHomePc(): boolean {
//     // eslint-disable-next-line turbo/no-undeclared-env-vars
//     return !process.env.WORK_PC;
// }
