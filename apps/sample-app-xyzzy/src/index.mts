import * as url from "node:url";
import { Result, SucceededResult, FailedResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { Directory } from "@repo/depot-node/directory";
import { resolveFileLocation } from "@repo/depot-node/filesystemHelpers";
import { NodePackage } from "@repo/depot-node/nodePackage";


////////////////////////////////////////////////////////////////////////////////
// Bootstrap
////////////////////////////////////////////////////////////////////////////////

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
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]!).href;
    return runningThisScript;
}


////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////

async function main(): Promise<Result<number, string>> {

    const thisDir = new Directory(import.meta.dirname);

    const res = await resolveFileLocation("package.json", thisDir);
    if (res.failed) {
        return new FailedResult(`Failed to find package.json: ${res.error}`);
    }

    const packageJsonFile = res.value;

    try {
        const nodePackage = await NodePackage.fromDirectory(packageJsonFile.directory);
        console.log(`Hello from the ${nodePackage.projectName} project.`);
    } catch (err) {
        return new FailedResult(`Failed to create NodePackage from directory "${packageJsonFile.directory.toString()}".`);
    }

    return new SucceededResult(0);
}
