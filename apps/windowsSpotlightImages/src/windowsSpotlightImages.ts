////////////////////////////////////////////////////////////////////////////////
//
// Usage: node.exe windowsSpotlightImages.js <path\to\output\directory>
//
// It is recommended that you use the %USERPROFILE% environment variable to
// specify an output directory within your user directory.
//
// Example:
// node.exe %USERPROFILE%\dev\path\to\windowsSpotlightImages.js %USERPROFILE%\blah\blah\Windows_Spotlight
//
// Note:  If this script is run using Windows Task Scheduler, that task will
// have to be updated whenever your password changes.
//
////////////////////////////////////////////////////////////////////////////////

import * as url from "url";
import * as os from "os";
import * as _ from "lodash-es";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { mapAsync, filterAsync, getTimerPromise, removeAsync } from "../../../packages/depot/src/promiseHelpers.js";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { FileComparer } from "../../../packages/depot-node/src/diffDirectories.js";


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


async function main(): Promise<Result<number, string>> {
    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Copies the images used by Windows Spotlight to the specified directory.",
            "",
            "windowsSpotlightImages <destination_dir>"
        ].join(os.EOL)
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    const outDirStr = argv._[0] as string;
    if (!outDirStr) {
        return new FailedResult("Destination directory not specified.");
    }

    const outDir = new Directory(outDirStr);
    if (outDir.existsSync()) {
        console.log(`Using existing output directory '${outDir.toString()}'`);
    }
    else {
        outDir.ensureExistsSync();
        console.log(`Created output directory '${outDir.toString()}'.`);
    }

    const spotlightAssetsDir1 = new Directory(
        os.homedir(), "AppData", "Local", "Packages", "Microsoft.Windows.ContentDeliveryManager_cw5n1h2txyewy", "LocalState", "Assets"
    );
    const spotlightAssetsDir2 = new Directory(
        "C:", "Windows", "SystemApps", "MicrosoftWindows.Client.CBS_cw5n1h2txyewy", "DesktopSpotlight", "Assets", "Images"
    );

    let assetFiles = spotlightAssetsDir1.contentsSync(false).files.concat(
        spotlightAssetsDir2.contentsSync(false).files
    );

    // Keep only the files greater than a certain size.  This gets rid of icons
    // that are also kept in this directory.
    assetFiles = await filterAsync(assetFiles, async (curFile) => {
        const stats = (await curFile.exists())!;
        return stats.size > 200 * 1024;
    });

    const fileComparers = _.map(assetFiles, (curSrcFile) => {
        const destFile = new File(outDir, curSrcFile.baseName + ".jpg");
        return FileComparer.create(curSrcFile, destFile);
    });

    const removed = await removeAsync(fileComparers, async (curFileComparer) => {
        const areIdentical = await curFileComparer.bothExistAndIdentical();
        return areIdentical;
    });

    console.log(`Identical files: ${removed.length}`);
    console.log(`New files:       ${fileComparers.length}`);

    const __destFiles = await mapAsync(fileComparers, (curFileComparer) => {
        return curFileComparer.leftFile.copy(curFileComparer.rightFile);
    });

    await getTimerPromise(5 * 1000, true);
    return new SucceededResult(0);
}
