import * as os from "node:os";
import * as fsp from "node:fs/promises";
import * as _ from "lodash-es";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { fromError } from "zod-validation-error";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { mapAsync } from "@repo/depot/promiseHelpers";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { isBlank, splitIntoLines } from "@repo/depot/stringHelpers";
import { File } from "@repo/depot-node/file";
import { FsPath } from "@repo/depot-node/fsPath";
import { readableStreamToText } from "@repo/depot-node/streamHelpers";
import { schemaFlashcardDeck, type Flashcard } from "./quizDomain.mjs";


export async function main(): Promise<number> {
    const res = await mainImpl();
    if (res.succeeded) {
        return res.value;
    }
    else {
        console.error(res.error);
        return -1;
    }
}


async function mainImpl(): Promise<Result<number, string>> {

    //
    // Get the configuration.
    //
    const resConfig = await getConfiguration();
    if (resConfig.failed) {
        return resConfig;
    }
    const config = resConfig.value;

    const resFlashcards = await pipeAsync(
        mapAsync(config.inputFiles, getFlashcardsFromFile),
        (results) => Result.allArrayM(results),
        (res) => Result.mapSuccess((decks) => decks.flat(), res)
    );
    if (resFlashcards.failed) {
        return resFlashcards;
    }
    const flashcards = resFlashcards.value;
    console.log(flashcards);
    return new SucceededResult(0);
}


/**
 * Reads a JSON file and parses it into an array of flashcards.
 *
 * @param file - The file to read and parse.
 * @returns A promise that resolves to a Result containing an array of
 * flashcards or an error message.
 */
async function getFlashcardsFromFile(file: File): Promise<Result<Array<Flashcard>, string>> {
    const unk = await file.readJson<unknown>();
    const resDeck = await schemaFlashcardDeck.safeParseAsync(unk);

    if (resDeck.success) {
        const flashcards = resDeck.data.flashcards;
        return new SucceededResult(flashcards);
    }
    else {
        const zodErrStr = fromError(resDeck.error).toString();
        const errStr = `${file.toString()}: ${zodErrStr}`;
        return new FailedResult(errStr);
    }
}


/**
 * The configuration for the quiz app.
 */
interface IConfig {
    inputFiles:         Array<File>;
    numFlashcardsToAsk: number | undefined;
}


/**
 * Gets the configuration for the quiz app from the command line.
 *
 * @return If the command line configuration is valid, a successful Result
 * containing the app configuration.  Otherwise, an error message.
 */
async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv =
        await yargs(hideBin(process.argv))
        .usage(
            [
                "Quizzes the user by asking questions from the specified files.",
                "",
                "Specifying input files via command line arguments:",
                "quiz <file_1> <file_2>",
                "",
                "Specifying input files by piping input into this app:",
                "splat **/*.json | quiz",
            ].join(os.EOL)
        )
        .option(
            "numFlashcards",
            {
                demandOption: false,
                type:         "number",
                describe:     "specifies the number of flashcards to ask. If not specified, all flashcards will be asked.",
            }
        )
        .help()
        .wrap(process.stdout.columns ?? 80)
        .argv;

    const inputStrings = argv._.filter((cur) => typeof cur === "string");
    inputStrings.push(...(await getStdinPipedLines()));

    const [nonExtantFiles, extantFiles] = await stringsToFiles(inputStrings);

    if (nonExtantFiles.length > 0) {
        console.error(`${nonExtantFiles.length} items are not files and will be skipped:`);
        nonExtantFiles.forEach((nonFile) => {
            console.log(`    ${nonFile}`);
        });
    }

    if (extantFiles.length === 0) {
        return new FailedResult("No valid input files specified.");
    }

    return new SucceededResult({
        inputFiles:         extantFiles,
        numFlashcardsToAsk: argv.numFlashcards
    });
}


/**
 * Gets lines of text that are piped into this app's stdin, if any.
 *
 * @return Lines of text that are being piped into this process, if any.
 */
async function getStdinPipedLines(): Promise<Array<string>> {
    const lines: Array<string> = [];
    const inputIsPiped = !process.stdin.isTTY;
    if (inputIsPiped) {
        const text = await readableStreamToText(process.stdin);
        const lines = splitIntoLines(text, false).filter((curLine) => !isBlank(curLine));
        lines.push(...lines);
    }
    return lines;
}


/**
 * Converts an array of strings to a tuple containing the strings that do not
 * represent extant files and File instances that represent extant files.
 *
 * @param fileCandidates - The strings that represent possible file paths
 * @return A tuple.  The first element contains the strings that represent non
 * extant files.  The second element contains File instances that represent
 * extant files.
 */
async function stringsToFiles(
    fileCandidates: Array<string>
): Promise<[Array<string>, Array<File>]> {

    const fsPaths = fileCandidates.map((curStr) => new FsPath(curStr));

    const [extantFiles, nonExtantFiles] = await pipeAsync(
        mapAsync(fsPaths, async (fsPath) => {
            let isFile = false;
            try {
                const stats = await fsp.stat(fsPath.toString());
                isFile = !!stats && stats.isFile();
            }
            catch (err) {
                isFile = false;
            }
            return { fsPath, isFile };
        }),
        (objs) => _.partition(objs, (obj) => !!obj.isFile)
    );

    return pipeAsync(
        extantFiles.map((extantFileObj) => extantFileObj.fsPath),
        // Map to File objects.
        (paths) => paths.map((curPath) => new File(curPath.toString())),
        (files) => [nonExtantFiles.map((x) => x.fsPath.toString()), files]
    );

}
