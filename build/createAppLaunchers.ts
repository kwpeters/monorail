import * as url from "url";
import { FailedResult, Result, SucceededResult } from "../packages/depot/src/result.js";
import { PromiseResult } from "../packages/depot/src/promiseResult.js";
import { Directory } from "../packages/depot-node/src/directory.js";
import { pipeAsync } from "../packages/depot/src/pipeAsync.js";
import { NodePackage } from "../packages/depot-node/src/nodePackage.js";
import { getLaunchScriptCode } from "../packages/depot-node/src/nodeUtil.js";
import { getRepoDir, getOutDir, getBinDir } from "./monorepoSettings.js";


if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
    await pipeAsync(PromiseResult.forceResult(main()))
    .pipe((res) => {
        if (res.failed) {
            console.error(res.error);
            process.exit(-1);
        }
        else if (res.value !== 0) {
            console.error(`Script exited with code ${res.value}.`);
            process.exit(-1);
        }
    })
    .end();
}


async function main(): Promise<Result<number, string>> {

    const repoDirRes = await getRepoDir();
    if (repoDirRes.failed) {
        return repoDirRes;
    }

    // Make sure this script is being run from the root directory.
    const cwd = new Directory(process.cwd());
    if (!cwd.equals(repoDirRes.value)) {
        return new FailedResult(`This script must be run from the root directory of this repo.`);
    }

    const outDirRes = await getOutDir(repoDirRes.value);
    if (outDirRes.failed) {
        return outDirRes;
    }

    //
    // Find all of the packages in the output directory.
    //
    const packagesRes = await NodePackage.find(outDirRes.value, false);

    if (packagesRes.failed) {
        return packagesRes;
    }

    //
    // Make the binaries in each package executable.
    //
    const binMapsRes = await PromiseResult.allArrayM(
        packagesRes.value.map(async (curPkg) => curPkg.makeBinsExecutable())
    );
    if (binMapsRes.failed) {
        return new FailedResult(binMapsRes.error.item);
    }

    //
    // Get the .bin directory that will contain launch scripts for the binaries.
    //
    const binDirRes = await getBinDir(outDirRes.value);
    if (binDirRes.failed) {
        return binDirRes;
    }

    // Empty the .bin directory.
    await binDirRes.value.empty();

    // Create a single array of all .js bin files across all packages.
    const binFiles =
        binMapsRes.value
        .flatMap((curMap) => Array.from(curMap.values()))
        .filter((curFile) => curFile.extName === ".js");

    // Create a launcher script for each .js bin file.
    const launcherPRs =
        binFiles.map(async (curJsBinFile): Promise<Result<void, string>> => {
            const launcherRes = getLaunchScriptCode(binDirRes.value, curJsBinFile);
            if (launcherRes.failed) {
                return launcherRes;
            }

            const launcherInfo = launcherRes.value;
            return PromiseResult.fromPromise(launcherInfo.scriptFile.write(launcherInfo.scriptCode));
        });

    const overallLauncherRes = await PromiseResult.allArrayM(launcherPRs);
    if (overallLauncherRes.failed) {
        return new FailedResult(overallLauncherRes.error.item);
    }

    return new SucceededResult(0);
}
