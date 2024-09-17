import * as url from "url";
import * as os from "os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { launchAdmin } from "../../../packages/depot-node/src/windowsHelpers.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";


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
    executable: File;
    cwd: Directory | undefined;
}

async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Runs the specified executable as admin.",
            "",
            "runAdmin [options] <executable>"
        ].join(os.EOL)
    )
    .option(
        "cwd",
        {
            demandOption: false,
            type:         "string",
            describe:     "the current working directory when running the executable"
        }
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    const executableStr = argv._[0] as string | undefined;
    if (!executableStr) {
        return new FailedResult("Executable not specified.");
    }

    const executable = new File(executableStr);
    // Can't do the following check, because the executable may be somewhere in
    // the PATH environment variable.
    // if (!executable.existsSync()) {
    //     return new FailedResult(`"${executableStr}" does not exist.`);
    // }

    return new SucceededResult({
        executable,
        cwd: argv.cwd ? new Directory(argv.cwd) : undefined
    });
}


async function main(): Promise<Result<number, string>> {
    const configRes = await getConfiguration();
    if (configRes.failed) {
        return configRes;
    }
    const succeeded = await launchAdmin(configRes.value.executable, configRes.value.cwd);
    return succeeded ? new SucceededResult(0) : new FailedResult("Failed to run executable.");
}
