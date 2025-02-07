import * as url from "url";
import * as os from "os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { CompareResult, compareStrI } from "@repo/depot/compare";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { type PathPart } from "@repo/depot-node/pathHelpers";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { getMostRecentlyModified } from "@repo/depot-node/filesystemHelpers";
import { getOneDriveDir, getUserProfileDir } from "@repo/depot-node/windowsHelpers";
import { FsPath } from "@repo/depot-node/fsPath";


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


async function main(): Promise<Result<number, string>> {

    const configRes = await getConfiguration();
    if (configRes.failed) {
        return configRes;
    }

    const sharexCaptureRes = await getMostRecentSharexScreenCapture();
    if (sharexCaptureRes.failed) {
        return sharexCaptureRes;
    }

    // Do a sanity check and make sure the extensions match.
    const extensionsAreEqual =
        compareStrI(
            configRes.value.dstImgFile.extName,
            sharexCaptureRes.value.extName
        ) === CompareResult.EQUAL;
    if (!extensionsAreEqual) {
        return new FailedResult(`Filename extensions differ between "${configRes.value.dstImgFile.toString()}" and "${sharexCaptureRes.value.toString()}".`);
    }

    await sharexCaptureRes.value.copy(configRes.value.dstImgFile);
    return new SucceededResult(0);
}


interface IConfig {
    dstImgFile: File;
}


async function getConfiguration(): Promise<Result<IConfig, string>> {

    const argv =
        await yargs(hideBin(process.argv))
        .usage(
            [
                "Copies the most recently captured ShareX file to the specified",
                "destination.",
                "",
                "copy-latest-sharex-img <destination>"
            ].join(os.EOL)
        )
        .help()
        .wrap(process.stdout.columns ?? 80)
        .argv;

    // Get the destination image file positional parameter.
    const dstImgFile = new File(argv._[0] as PathPart);
    return new SucceededResult({dstImgFile});
}


async function getMostRecentSharexScreenCapture(): Promise<Result<File, string>> {

    const resScreenshotsDir = await PromiseResult.firstSuccess([
        // Attempt to locate the ShareX screenshots directory in the user's
        // Documents folder.
        pipeAsync(
            getUserProfileDir(),
            (resUserProfileDir) => Result.mapSuccess((dir) => new FsPath(dir, "Documents", "ShareX", "Screenshots"), resUserProfileDir),
            (resScreenshotsPath) => PromiseResult.bind((path) => Directory.createIfExtant(path), resScreenshotsPath)
        ),
        // Attempt to locate the ShareX screenshots directory in the users
        // OneDrive folder.
        pipeAsync(
            getOneDriveDir(),
            (resOneDriveDir) => Result.mapSuccess((dir) => new FsPath(dir, "Documents", "ShareX", "Screenshots"), resOneDriveDir),
            (resOneDrivePath) => PromiseResult.bind((path) => Directory.createIfExtant(path), resOneDrivePath)
        )
    ]);

    if (resScreenshotsDir.failed) {
        return new FailedResult(`Failed to locate ShareX screenshots directory.  Encountered the following errors:\n${resScreenshotsDir.error.join("\n")}`);
    }

    const screenshotsDir = resScreenshotsDir.value;

    // Within ShareX's "Screenshots" folder, it creates monthly folders (for example, "2023-02").
    // Find the one that has been modified most recently.
    const monthlyDirs = (await screenshotsDir.contents(false)).subdirs;
    const dirRes = await getMostRecentlyModified(monthlyDirs);
    if (dirRes.failed) {
        return dirRes;
    }

    // Find the most recently modified file within the monthly directory.
    const screenshotFiles = (await dirRes.value.fsItem.contents(false)).files;
    const mostRecentScreenshotFileRes = await getMostRecentlyModified(screenshotFiles);
    if (mostRecentScreenshotFileRes.failed) {
        return mostRecentScreenshotFileRes;
    }

    return new SucceededResult(mostRecentScreenshotFileRes.value.fsItem);
}
