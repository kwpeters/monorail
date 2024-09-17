import * as os from "os";
import * as url from "url";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { FailedResult, Result, SucceededResult } from "../packages/depot/src/result.js";
import { PromiseResult } from "../packages/depot/src/promiseResult.js";
import { Directory } from "../packages/depot-node/src/directory.js";
import { TsProject } from "../packages/depot-node/src/tsProject.js";
import { File } from "../packages/depot-node/src/file.js";


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
    packageDir: Directory;
}


async function main(): Promise<Result<number, string>> {

    // Get the configuration for this app.
    const configRes = await getConfiguration();
    if (configRes.failed) {
        return configRes;
    }

    // Get the TS project's output directory.
    const tsProjectRes = await TsProject.fromDirectory(configRes.value.packageDir);
    if (tsProjectRes.failed) {
        return tsProjectRes;
    }

    const tsOutputDirRes = await tsProjectRes.value.getOutDir();
    if (tsOutputDirRes.failed) {
        return tsOutputDirRes;
    }
    const tsOutputDir = tsOutputDirRes.value;
    const tsOutputDirExists = await tsOutputDir.exists();
    if (!tsOutputDirExists) {
        return new FailedResult(`TS project output directory "${tsOutputDir.toString()}" does not exist.`);
    }

    // Copy the project's package.json file to the output directory.
    const packageJson = new File(configRes.value.packageDir, "package.json");
    const packageJsonExists = await packageJson.exists();
    if (!packageJsonExists) {
        return new FailedResult(`Package directory "${configRes.value.packageDir.toString()}" does not contain a package.json file.`);
    }
    await packageJson.copy(tsOutputDir);

    // If there is a node_modules directory in the TS project directory, then
    // copy it to the output directory.  It is not an error if this node_modules
    // folder does not exist.
    const nodeModulesDir = new Directory(configRes.value.packageDir, "node_modules");
    const nodeModulesDirExists = await nodeModulesDir.exists();
    if (nodeModulesDirExists) {
        await nodeModulesDir.copy(tsOutputDir, true);
    }

    return new SucceededResult(0);
}


async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Performs post-build steps.",
            "",
            "postBuild <packageDir>"
        ].join(os.EOL)
    )
    .positional("packageDir", {
        describe: "The package directory for which post-build steps will be run",
        type:     "string"
    })
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    if (!argv._[0]) {
        return new FailedResult("Package directory not specified.");
    }

    const packageDir = new Directory(argv._[0] as string);
    const stats = await packageDir.exists();
    if (!stats) {
        return new FailedResult(`The package directory "${packageDir.toString()}" does not exist.`);
    }

    return new SucceededResult({packageDir});
}
