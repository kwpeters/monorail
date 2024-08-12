import * as os from "os";
import { ArgumentsCamelCase, Argv } from "yargs";
import * as _ from "lodash-es";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { pipeAsync } from "../../../packages/depot/src/pipeAsync2.js";
import { matchesAny } from "../../../packages/depot/src/regexpHelpers.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { promptToContinue } from "../../../packages/depot-node/src/prompts.js";
import { TaskQueue } from "../../../packages/depot-node/src/taskQueue.js";
import { datestampStrategyFilePath } from "./datestampStrategy.js";
import { ConfidenceLevel, IDatestampDeductionSuccess } from "./datestampDeduction.js";


/**
 * Files that will be ignored when searching for files to be imported.
 */
const skipFileRegexes = [
    /Thumbs.db/i,
    /ZbThumbnail.info/i,
    /picasa.ini/i,
] as Array<RegExp>;





/**
 * A type that describes the properties that are added to the Yargs arguments
 * object once the command line has been parsed.  This must be kept in sync with
 * the builder.
 */
export interface IArgsImport {
    importDir: string;
    photoLibDir: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const builder = (yargs: Argv<NonNullable<unknown>>) => {
    return  yargs
    .option(
        "importDir",
        {
            describe:     "Path to folder containing photos to be imported",
            type:         "string",
            demandOption: true,
        }
    )
    .option(
        "photoLibDir",
        {
            describe:     "Path to root of photo library",
            type:         "string",
            demandOption: true
        }
    );
};


async function handler(argv: ArgumentsCamelCase<IArgsImport>): Promise<Result<number, string>> {
    const configRes = await argsToConfig(argv);
    if (configRes.failed) {
        return configRes;
    }

    const importFiles = await pipeAsync(
        configRes.value.importDir.contents(true),
        (contents) => contents.files,
        (files) => files.filter((curFile) => !matchesAny(curFile.absPath(), skipFileRegexes))
    );

    console.log(`Found ${importFiles.length} files to import.`);
    if (importFiles.length === 0) {
        return new SucceededResult(0);
    }

    const deductions = await pipeAsync(
        importFiles,
        (files) => Promise.all(files.map((curFile) => datestampStrategyFilePath(curFile, configRes.value.photoLibDir)))
    );

    const lowConfidenceDeductions = deductions.filter((deduction) => deduction.confidence === ConfidenceLevel.NoClue ||
        deduction.confidence === ConfidenceLevel.Low);
    if (lowConfidenceDeductions.length > 0) {

        const lines = [
            "Low or no confidence determining the datestamp for one or more files:",
            ...lowConfidenceDeductions.map((deduction) => "    " + deduction.explanation)
        ];
        return new FailedResult(lines.join(os.EOL));
    }

    const successfulDeductions = deductions as Array<IDatestampDeductionSuccess>;

    const shouldContinue = await promptToContinue(`Ready to import ${successfulDeductions.length} files.  Continue?`, false);
    if (!shouldContinue) {
        return new FailedResult("Import aborted by user.");
    }

    //
    // Move the files.
    //

    // TODO: Check for destination folder existence once and then use fs.rename to move the files.

    // Use a task queue to move the files, because when I try to do this in an
    // unthrottled way I get errors that there are too many open files.
    const taskQueue = new TaskQueue(20, false);

    const tuples = _.zipWith(
        importFiles,
        successfulDeductions,
        (importFile, deduction) => [importFile, deduction] as const
    );

    const taskPromises = tuples.map(([importFile, deduction]) => {
        const task = async () => {
            await importFile.move(deduction.destFile);
            console.log(`${importFile.toString()} --> ${deduction.destFile.toString()}`);
        };
        return taskQueue.push(task);
    });
    await Promise.all(taskPromises);

    console.log(`Successfully imported ${tuples.length} files.`);

    return new SucceededResult(0);
}


/**
 * Config object for this subcommand.
 */
interface IImportConfig {
    importDir: Directory;
    photoLibDir: Directory;
}


/**
 * Converts this subcommand's arguments to its configuration object.
 *
 * @param argv - This subcommand's arguments
 * @return If successful, a successful Result containing the config object.
 */
async function argsToConfig(
    argv: ArgumentsCamelCase<IArgsImport>
): Promise<Result<IImportConfig, string>> {

    const importDir = new Directory(argv.importDir);
    const photoLibDir = new Directory(argv.photoLibDir);

    const [importDirExists, photoLibDirExists] = await Promise.all([importDir.exists(), photoLibDir.exists()]);

    if (!importDirExists) {
        return new FailedResult(`Photo library directory "${photoLibDir.toString()}" does not exist.`);
    }
    else if (!photoLibDirExists) {
        return new FailedResult(`Photo library directory "${photoLibDir.toString()}" does not exist.`);
    }
    else {
        return new SucceededResult({ importDir, photoLibDir });
    }
}


/**
 * Definition of this subcommand.
 */
export const def = {
    command:     "import",
    description: "Imports files into the specified photo library.",
    builder:     builder,
    handler:     handler
};
