import * as url from "url";
import * as os from "os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { CompareResult, compareStrI } from "../../../packages/depot/src/compare.js";
import { PathPart } from "../../../packages/depot-node/src/pathHelpers.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { getMostRecentlyModified } from "../../../packages/depot-node/src/filesystemHelpers.js";


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
                "copyLatestShareXImg <destination>"
            ].join(os.EOL)
        )
        .help()
        .wrap(80)
        .argv;

    // Get the destination image file positional parameter.
    const dstImgFile = new File(argv._[0] as PathPart);
    return new SucceededResult({dstImgFile});
}


async function getMostRecentSharexScreenCapture(): Promise<Result<File, string>> {

    // Get the directory where ShareX saves its files.
    const homeDir = new Directory(process.env.HOME!);
    if (!homeDir.existsSync()) {
        return new FailedResult(`Home directory "${homeDir.toString() }" does not exist.`);
    }

    const docsDir = new Directory(homeDir, "Documents");
    if (!docsDir.existsSync()) {
        return new FailedResult(`Documents directory ${docsDir.toString()} does not exist.`);
    }

    const screenshotsDir = new Directory(docsDir, "ShareX", "Screenshots");

    if (!screenshotsDir.existsSync()) {
        return new FailedResult(`ShareX screenshots directory "${screenshotsDir.toString()}" does not exist.`);
    }

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
