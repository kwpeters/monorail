import * as os from "os";
import * as url from "url";
import stripJsonComments from "strip-json-comments";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { pipe } from "../../../packages/depot/src/pipe.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { spawn } from "../../../packages/depot-node/src/spawn2.js";


// TODO: Use Zod to parse the external config file to make sure it is valid.
// https://stackoverflow.com/questions/75556846/zod-parse-external-json-file



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


interface IConfig {
    configFile: File;
}


async function main(): Promise<Result<number, string>> {

    const configRes = await getConfiguration();
    if (configRes.failed) {
        return configRes;
    }

    return new SucceededResult(0);
}


async function getConfiguration(): Promise<Result<IConfig, string>> {

    let homeDirStr: string;
    if (process.env.CLOUDHOME) {
        homeDirStr = process.env.CLOUDHOME;
    }
    else if (process.env.HOME) {
        homeDirStr = process.env.HOME;
    }
    else {
        return new FailedResult("No CLOUDHOME or HOME environment variable is set.");
    }

    const configFile = new File(new Directory(homeDirStr), "polaris.json");
    const configFileStats = await configFile.exists();
    if (!configFileStats) {
        return new FailedResult(`Configuration file "${configFile.toString()}" does not exist.`);
    }

    return new SucceededResult({configFile});
}
