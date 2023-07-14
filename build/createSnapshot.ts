import * as url from "url";
import { FailedResult, Result, SucceededResult } from "../packages/depot/src/result.js";
import { PromiseResult } from "..//packages/depot/src/promiseResult.js";
import { getRepoDir, getSnapshotDir, getOutDir } from "./monorepoSettings.js";


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

    const repoDirRes = await getRepoDir();
    if (repoDirRes.failed) {
        return repoDirRes;
    }

    const outDirRes = await getOutDir(repoDirRes.value);
    if (outDirRes.failed) {
        return outDirRes;
    }

    // If the output directory does not exist, do not proceed.
    const outDirExists = await outDirRes.value.exists();
    if (!outDirExists) {
        return new FailedResult(`Cannot create snapshot because output directory "${outDirRes.value.toString()}" does not exist.`);
    }

    const snapshotDirRes = await getSnapshotDir(repoDirRes.value);
    if (snapshotDirRes.failed) {
        return snapshotDirRes;
    }

    // Empty the snapshot directory.
    await snapshotDirRes.value.empty();

    await outDirRes.value.copy(snapshotDirRes.value, false);

    return new SucceededResult(0);
}
