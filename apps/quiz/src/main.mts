import * as os from "node:os";
import * as _ from "lodash-es";
import yargs from "yargs/yargs";
import wrap from "word-wrap";
import { hideBin } from "yargs/helpers";
import { fromError } from "zod-validation-error";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { mapAsync } from "@repo/depot/promiseHelpers";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { assertNever } from "@repo/depot/never";
import { promptForChoice, promptForString } from "@repo/depot-node/prompts";
import { getStdinPipedLines, hr } from "@repo/depot-node/ttyHelpers";
import { File, stringsToFiles } from "@repo/depot-node/file";
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
    const flashcards = _.shuffle(resFlashcards.value);
    const numFlashcardsToAsk = config.numFlashcardsToAsk ?
        Math.min(config.numFlashcardsToAsk, flashcards.length) :
        flashcards.length;

    console.log(`Starting quiz containing ${numFlashcardsToAsk} flashcards...`);

    let questionsRemaining = numFlashcardsToAsk;
    let numCorrect = 0;

    console.log("");

    while (questionsRemaining > 0) {
        const curFlashcard = flashcards.pop()!;

        const correct = await askFlashcard(curFlashcard);

        console.log(hr("-"));
        console.log("");

        if (correct) {
            numCorrect++;
        }
        questionsRemaining--;
    }

    console.log(`You answered ${numCorrect} of ${numFlashcardsToAsk} flashcards correctly.`);
    console.log("");
    return new SucceededResult(0);
}


async function askFlashcard(
    flashcard: Flashcard,
    allowedAttempts = 3
): Promise<boolean> {

    if (flashcard.prompt.type === "PromptSingleLine") {
        console.log(wrap(flashcard.prompt.prompt));
    }
    else if (flashcard.prompt.type === "PromptMultiLine") {
        flashcard.prompt.prompt.forEach((line) => {
            console.log(wrap(line));
        });
    }
    else {
        assertNever(flashcard.prompt);
    }

    let attemptsRemaining = allowedAttempts;

    while (attemptsRemaining > 0) {

        let correctAnswer = "";
        let userIsCorrect = false;

        if (flashcard.answer.type === "AnswerCandidates") {
            const allCandidates = _.shuffle([
                flashcard.answer.correctCandidate,
                ...flashcard.answer.wrongCandidates
            ]);

            const choices = allCandidates.map((cur) => ({ name: cur, value: cur }));
            const usersAnswer = await promptForChoice("Your answer:", choices);
            correctAnswer = flashcard.answer.correctCandidate;
            userIsCorrect = usersAnswer === correctAnswer;
        }
        else if (flashcard.answer.type === "AnswerText") {
            const usersAnswer = await promptForString("Your answer: ");
            correctAnswer = flashcard.answer.answer;
            userIsCorrect = usersAnswer === correctAnswer;
        }
        else {
            assertNever(flashcard.answer);
        }

        if (userIsCorrect) {
            console.log("Correct!");
            return true;
        }

        attemptsRemaining--;
        const msg = attemptsRemaining > 0 ?
            `Incorrect.  You have ${attemptsRemaining} attempts remaining.` :
            `Incorrect.  The answer was:\n${correctAnswer}`;
        console.log(msg);
    }

    return false;
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
