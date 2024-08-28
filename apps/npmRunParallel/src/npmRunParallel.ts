import * as os from "os";
import * as url from "url";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { toArray } from "../../../packages/depot/src/arrayHelpers.js";
import { mapAsync } from "../../../packages/depot/src/promiseHelpers.js";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { NodePackage } from "../../../packages/depot-node/src/nodePackage.js";
import { NodePackageScript } from "../../../packages/depot-node/src/nodePackageScript.js";
import { hr } from "../../../packages/depot-node/src/ttyHelpers.js";
import { spawnErrorToString } from "../../../packages/depot-node/src/spawn2.js";


const sep = hr("-");


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
    searchDirs: Array<Directory>;
    scriptName: string;
}


async function main(): Promise<Result<number, string>> {

    const configRes = await getConfig();
    if (configRes.failed) {
        return configRes;
    }

    const resPackages = await PromiseResult.allArrayM(
        configRes.value.searchDirs.map((searchDir) => NodePackage.find(searchDir, true))
    );
    if (resPackages.failed) {
        return new FailedResult(resPackages.error.item);
    }

    const allNodePackages = resPackages.value.flat().sort();

    const nodePackagesWithScript = allNodePackages.filter(
        (curPkg) => {
            const resScripts = curPkg.getScripts();
            if (resScripts.failed) {
                return false;
            }

            return resScripts.value.some((script) => script.name === configRes.value.scriptName);
        }
    );

    //
    // Print information about packages found that contain the specified script.
    //
    console.log(`${nodePackagesWithScript.length} of ${allNodePackages.length} packages contain a script named "${configRes.value.scriptName}".`);
    allNodePackages.forEach((curNodePackage) => {
        const hasScript =
            nodePackagesWithScript.some((pkg) => pkg.directory.toString() === curNodePackage.directory.toString());
        const icon = hasScript ? "✔" : " ";
        console.log(`${icon}  ${curNodePackage.directory.toString()}`);
    });

    const scripts = nodePackagesWithScript.reduce(
        (acc, pkg) => {
            const scriptsRes = pkg.getScripts();
            if (scriptsRes.succeeded) {
                const matchingScripts = scriptsRes.value.filter((script) => script.name === configRes.value.scriptName);
                return acc.concat(matchingScripts);
            }
            else {
                return acc;
            }
        },
        [] as Array<NodePackageScript>
    );

    //
    // Get the start time.
    //
    const startMs = Date.now();
    const res = await PromiseResult.allArrayA(scripts.map((script) => script.run().closePromise));
    const stopMs = Date.now();
    const elapsedSeconds = (stopMs - startMs) / 1000;


    //
    // Print the results.
    //
    if (res.succeeded) {
        const allOutput = sep + os.EOL + res.value.join(os.EOL + sep + os.EOL) + os.EOL + sep;
        console.log(allOutput);
    }
    else {
        const errorStrings = res.error.map((err) => spawnErrorToString(err.item));
        const allOutput = sep + os.EOL + errorStrings.join(os.EOL + sep + os.EOL) + os.EOL + sep;
        console.error(allOutput);
    }

    //
    // Print a summary.
    //
    console.log(`Ran ${scripts.length} npm scripts in ${elapsedSeconds} seconds.`);

    if (res.succeeded) {
        console.log(`✅ All ${scripts.length} "${configRes.value.scriptName}" npm scripts succeeded.`);
        return new SucceededResult(0);
    }
    else {
        const failedScripts =
            res.error
            .map((curErr) => curErr.index)
            .map((curIndex) => scripts[curIndex]);
        const msg = [
            `❌ ${failedScripts.length} of ${scripts.length} "${configRes.value.scriptName}" npm scripts failed:`,
            ...failedScripts.map((script) => "    " + script.nodePkg.directory.toString())
        ].join(os.EOL);
        return new FailedResult(msg);
    }
}


async function getConfig(): Promise<Result<IConfig, string>> {

    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Executes the specified npm script in each package within the specified directories.",
            "",
            "Usage:",
            "npmRunParallel [options] <scriptName>",
        ].join(os.EOL)
    )
    .help()
    .option(
        "searchDir",
        {
            demandOption: false,
            type:         "string",
            default:      ".",
            describe:     'Directories to search. Default is ".".  Can be specified multiple times.'
        }
    )
    .positional("scriptName", {
        describe: "The name of the npm script to run",
        type:     "string"
    })
    .wrap(80)
    .argv;

    //
    // Get the search directories.
    //
    const searchDirs = toArray(argv.searchDir).map((str) => new Directory(str));
    const allSearchDirsExist =
        (await mapAsync(searchDirs, (searchDir) => searchDir.exists()))
        .every((stat) => stat !== undefined);
    if (!allSearchDirsExist) {
        return new FailedResult("One or more of the specified search directories do not exist.");
    }

    //
    // Get the script name.
    //
    const scriptName = argv._[0];
    if (typeof scriptName !== "string" || scriptName.length === 0) {
        return new FailedResult("Please specify the script name.");
    }

    return new SucceededResult({
        searchDirs: searchDirs,
        scriptName: scriptName

    });
}
