import * as url from "url";
import * as os from "os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { insertIf } from "../../../packages/depot/src/arrayHelpers.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { GitRepo } from "../../../packages/depot-node/src/gitRepo.js";
import { spawn, spawnErrorToString } from "../../../packages/depot-node/src/spawn2.js";


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
    check: boolean;
}


async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv = await yargs(hideBin(process.argv))
    .usage([
        "Runs Fantomas F# style checker on all staged and modified .fs files.",
        "",
        "fantomasModified [options]",

    ].join(os.EOL))
    .help()
    .option(
        "check",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "Only check the files.  Do not fix them."
        }
    )
    .wrap(process.stdout.columns ?? 80)
    .argv;

    return new SucceededResult({check: argv.check});
}


async function main(): Promise<Result<number, string>> {

    const configRes = await getConfiguration();
    if (configRes.failed) {
        return new FailedResult("Invalid configuration.");
    }

    const repoRes = await GitRepo.fromDirectory(new Directory(process.cwd()));
    if (repoRes.failed) {
        return repoRes;
    }
    const repo = repoRes.value;

    const stagedFilesRes = await repo.getStagedFiles("cwd");
    if (stagedFilesRes.failed) {
        return stagedFilesRes;
    }

    const modifiedFiles = await repo.modifiedFiles();

    let inputFiles = stagedFilesRes.value.concat(modifiedFiles);
    inputFiles = inputFiles.filter((file) => file.extName === ".fs");

    if (inputFiles.length === 0) {
        console.log("No staged or modified files found.");
        return new SucceededResult(0);
    }

    console.log("Processing:");
    inputFiles.forEach((file) => console.log(file.toString()));

    const spawnOutputs = inputFiles.map((inputFile) => {
        const args = [
            "fantomas",
            ...insertIf(configRes.value.check, "--check"),
            inputFile.toString()
        ];

        return spawn("dotnet", args);
    });

    const res = Result.allArrayM(await Promise.all(spawnOutputs.map((so) => so.closePromise)));
    if (res.failed) {
        return new FailedResult(spawnErrorToString(res.error));
    }

    console.log(res.value);

    return new SucceededResult(0);
}
