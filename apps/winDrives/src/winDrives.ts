////////////////////////////////////////////////////////////////////////////////
//
// A script that maps most frequently used folders to drive letters.
//
////////////////////////////////////////////////////////////////////////////////

import * as os from "os";
import * as url from "url";
import * as _ from "lodash-es";
import table from "text-table";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
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


interface IDriveMapping {
    driveLetter: string;
    dir:         Directory;
}


function getMappings(): Result<IDriveMapping[], string> {

    const homeRes = Result.requireTruthy("HOME environment variable does not exist.", process.env.HOME);
    if (homeRes.failed) {
        return homeRes;
    }

    const mappings: IDriveMapping[] = [
        {
            driveLetter: "D",
            dir:         new Directory(homeRes.value, "OneDrive - Rockwell Automation, Inc", "Desktop")
        },
        {
            driveLetter: "O",
            dir:         new Directory(homeRes.value, "OneDrive - Rockwell Automation, Inc", "home", "rok_data")
        },
        {
            driveLetter: "S",
            dir:         new Directory(homeRes.value, "SynologyDrive", "Drive", "home", "data")
        },
    ];

    return new SucceededResult(mappings);
}


async function main(): Promise<Result<number, string>> {

    // This app doesn't use any command line arguments.  This is here for usage
    // information only.
    await yargs(hideBin(process.argv))
    .usage(
        [
            "Maps frequently used folders to drive letters.",
            "",
            "winDrives"
        ].join(os.EOL)
    )
    .help()
    .wrap(80)
    .argv;


    const mappingsRes = getMappings();
    if (mappingsRes.failed) {
        return mappingsRes;
    }

    // Print the mapping information.
    const rows = mappingsRes.value.map((mapping) => [`${mapping.driveLetter}:`, mapping.dir]);
    console.log(table(rows, {hsep: " ==> "}));
    console.log("");

    // Create the mappings.
    const results = await createMappings(mappingsRes.value);
    const [successes, failures] = _.partition(results, (curRes) => curRes.succeeded);

    // Print info about the successful mappings.
    successes.forEach((curSuccess) => {
        console.log(`Successfully mapped ${curSuccess.value.driveLetter} to "${curSuccess.value.dir.toString()}".`);
    });

    // Print info about failed mappings.
    failures.forEach((curFailure) => {
        console.error(curFailure.error);
    });

    if (failures.length > 0) {
        return failures[0];
    }
    else {
        return new SucceededResult(0);
    }
}


async function createMappings(mappings: IDriveMapping[]): Promise<Array<Result<IDriveMapping, string>>> {
    return Promise.all(mappings.map(createMapping));
}


async function createMapping(mapping: IDriveMapping): Promise<Result<IDriveMapping, string>> {

    const driveStr = `${mapping.driveLetter}:`;

    const driveDir = new Directory(driveStr);
    if (driveDir.existsSync()) {
        return new FailedResult(`Drive letter ${driveStr} is already in use.`);
    }

    if (!mapping.dir.existsSync()) {
        return new FailedResult(`The directory "${mapping.dir.toString()}" does not exist.`);
    }

    const res = await spawn("subst", [driveStr, mapping.dir.absPath()]).closePromise;
    return res.succeeded ?
        new SucceededResult(mapping) :
        new FailedResult(spawnErrorToString(res.error));
}
