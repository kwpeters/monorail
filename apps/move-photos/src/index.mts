import * as url from "node:url";
import * as path from "node:path";
import * as _ from "lodash-es";
import { matchesAny } from "@repo/depot/regexpHelpers";
import { mapAsync, zipWithAsyncValues } from "@repo/depot/promiseHelpers";
import { Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { promptToContinue } from "@repo/depot-node/prompts";
import { FileComparer } from "@repo/depot-node/diffDirectories";
import { datestampStrategyFilePath, applyDatestampStrategies } from "./datestampStrategy.mjs";
import { ConfidenceLevel } from "./datestampDeduction.mjs";


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
    const srcDir = new Directory("\\\\floyd\\chandratmp");
    const destDir = new Directory("\\\\floyd\\photo");

    console.log(`srcDir: ${srcDir.toString()}`);
    console.log(`destDir: ${destDir.toString()}`);

    console.log(`Finding all files in ${srcDir.toString()}...`);
    let srcFiles = (await srcDir.contents(true)).files;
    console.log(`Source files found: ${srcFiles.length}`);

    //
    // Delete unwanted source files
    //
    srcFiles = await deleteUnwantedSourceFiles(srcFiles);

    //
    // From this point on, we will need the deductions that result from applying
    // the various datestamp strategies.
    //
    const strategies = [datestampStrategyFilePath];
    const srcAndDeductionAggregates = await zipWithAsyncValues(srcFiles, async (curSrcFile) => {
        return applyDatestampStrategies(curSrcFile, destDir, strategies);
    });


    ////////////////////////////////////////////////////////////////////////////////



    const highConfidence = _.remove(srcAndDeductionAggregates, (curSrcAndDeductionAggregate) => {
        const highestConfidenceDeductions = curSrcAndDeductionAggregate[1].getHighestConfidenceDeductions();
        return highestConfidenceDeductions.length > 0 &&
               !curSrcAndDeductionAggregate[1].isConflicted() &&
               highestConfidenceDeductions[0]!.confidence >= ConfidenceLevel.Medium;
    });

    console.log(`There are ${highConfidence.length} high confidence files.`);
    console.log(`There are ${srcAndDeductionAggregates.length} files still unaccounted for.`);
    process.exit(-1);

    ////////////////////////////////////////////////////////////////////////////////

    const __fileComparers = _.map(srcFiles, (curSrcFile) => {
        return FileComparer.create(
            curSrcFile,
            new File(destDir, path.relative(srcDir.toString(), curSrcFile.toString()))
        );
    });

    //
    // Delete source files that are exactly the same in the destination.
    //

    // LEFT OFF HERE: The following code that attempts to remove identical files
    // is having no effect, because the files' path is not the same in the
    // source and destination.  These paths are set above when the FileComparers
    // are instantiated.  What I need is a function that takes a file and an
    // array of IFileDatestampStrategy objects and gives back the path where
    // that file would be found in _destDir_.

    // const identicals = await removeAsync(fileComparers, (fc) => fc.bothExistAndIdentical());
    // console.log(`There are ${identicals.length} identical files.`);
    // for (const curIdentical of identicals) {
    //     const doDeletion = await promptToContinue(`${curIdentical.leftFile.toString()} is identical.  Delete?`, true, true);
    //     if (doDeletion) {
    //         // TODO: Uncomment this code when we're sure it works.
    //         // await curIdentical.leftFile.delete();
    //         console.log("Fake deletion here.");
    //     }
    // }

    // TODO: Keep writing this code until all files in _srcDir_ are accounted for.
    // Some additional ideas for strategies that I may need:
    // - Using EXIF data from photo (high confidence level in resulting date)
    // - Using date in the file's path (already implemented)
    // - Using dates of other files in the same folder.
    //    - Especially useful for video files.

    // TODO: Do an additional copy of files from _chandra_, because I think I may
    // have accidentally deleted a few in _\\floyd\chandratmp_.

    return new SucceededResult(0);
}


/**
 * Prompts the user whether they wish to delete unwanted files from `srcFiles`.
 * @param srcFiles - The source files to be processed.
 * @return A new array containing only the wanted files.
 */
async function deleteUnwantedSourceFiles(srcFiles: Array<File>): Promise<Array<File>> {
    const unwantedPatterns = [
        /Thumbs\.db$/i,
        /\.DS_Store$/i
    ];

    console.log("Searching for unwanted files...");
    const [unwantedFiles, wantedFiles] = _.partition(
        srcFiles,
        (srcFile) => matchesAny(srcFile.toString(), unwantedPatterns)
    );

    await promptAndDeleteFiles(unwantedFiles, "Delete unwanted files?");
    return wantedFiles;
}


/**
 * Prompts the user whether they wish to delete the specified files.
 * @param files - The files that may be deleted.
 * @param prompt - The prompt that will be displayed.  If confirmed, the
 * specified files will be deleted.
 * @return A promise that resolves to true when the user confirms the file
 * deletions.  A promise that resolves to false when the user cancels.
 */
async function promptAndDeleteFiles(files: Array<File>, prompt: string): Promise<boolean> {
    if (files.length === 0) {
        return true;
    }

    // Print the files to be deleted.
    _.forEach(files, (curFile) => console.log(`  ${curFile.toString()}`));

    const enhancedPrompt = `${prompt} (${files.length} files)`;

    // Ask the user if they wish to delete the files.
    try {
        await promptToContinue(enhancedPrompt, true);

    }
    catch (error) {
        // The user did not confirm the deletion.  Do nothing.
        return false;
    }

    await mapAsync(files, async (curFile) => curFile.delete());
    return true;
}
