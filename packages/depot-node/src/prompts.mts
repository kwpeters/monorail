import * as _ from "lodash-es";
import inquirer from "inquirer";
import { NoneOption, Option, SomeOption } from "@repo/depot/option";
import { type ValidatorFunc, validate, alwaysValid } from "@repo/depot/validator";
import { File } from "./file.mjs";


/**
 * Prompts the user to confirm whether they want to continue.
 * @param message - The message to display
 * @param defaultToConfirm - true to make confirmation the default response.
 * false to make canceling the default.
 * @return A promise that is resolved with a boolean indicating whether the user
 * has confirmed (true) or not (false).
 */
export async function promptToContinue(
    message:          string,
    defaultToConfirm: boolean
): Promise<boolean> {
    const questionConfirmation = {
        type:    "confirm",
        name:    "confirm",
        default: defaultToConfirm,
        message: message || "Continue?"
    };

    const answers = await inquirer.prompt<{ confirm: boolean; }>([questionConfirmation]);
    return answers.confirm;
}


/**
 * Prompts the user to enter a string.
 * @param message - The prompt message to display
 * @param defaultValue - The default input value
 * @return A promise that resolves with the string the user entered.
 */
export async function promptForString(
    message: string,
    defaultValue?: string
): Promise<string> {
    const question = {
        type:    "input",
        name:    "inputValue",
        message: message,
        default: defaultValue
    };

    const answers = await inquirer.prompt<{ inputValue: string; }>([question]);
    return answers.inputValue;
}


/**
 * Interface defining the properties of a choice of type string.
 */
export interface IChoiceString {
    name:  string;
    value: string;
}


/**
 * Prompts the user to choose one of the specified choices.
 * @param message - The prompt to display
 * @param choices - The choices to present to the user.
 * @return A promise that resolves with the chosen choice's value.
 */
export async function promptForChoice(
    message: string,
    choices: Array<IChoiceString>
): Promise<string> {
    const actualChoices =
        choices.map((curChoice) => ({name: curChoice.name, value: curChoice.value, short: curChoice.name}));

    const question = {
        type:    "list",
        name:    "inputValue",
        message: message,
        choices: actualChoices
    };

    const answers = await inquirer.prompt<{inputValue: string}>([question]);
    return answers.inputValue;
}


/**
 * Prompts the user to choose one of the provided choices or to enter their own
 * "other" string value.
 * @param message - The prompt to display
 * @param choices - The provided choices to present along with "other"
 * @return A promise that resolves with the entered string. If the user selected
 * from the choices, the choice's value is returned.  If the user chose to enter
 * another value, that value is returned.
 */
export async function promptForStringWithChoices(
    message: string,
    choices: Array<IChoiceString>
): Promise<string> {
    const otherValue = "otherValueXyzzy";
    const actualChoices =
        _.chain(choices)
        .map((curChoice) => ({name: curChoice.name, value: curChoice.value, short: curChoice.name}))
        .concat({name: "other", value: otherValue, short: "other"})
        .value();

    const question = {
        type:    "list",
        name:    "inputValue",
        message: message,
        choices: actualChoices
    };

    const answers = await inquirer.prompt<{inputValue: string}>([question]);
    return answers.inputValue === otherValue ?
        promptForString(message) :
        answers.inputValue;
}


/**
 * Prompts the user to enter a string via their default editor.
 * @param message - The prompt message to display
 * @param defaultValue - The default input value
 * @return A promise that resolves with the string the user entered.
 */
export async function promptForStringInEditor(
    message: string,
    defaultValue?: string
): Promise<string> {
    const question = {
        type:    "editor",
        name:    "editorInput",
        message: message,
        default: defaultValue
    };

    const answers = await inquirer.prompt<{ editorInput: string; }>([question]);
    return answers.editorInput;
}


/**
 * Prompts the user to choose one of the provided files or to specify the path
 * of an existing file.
 * @param message - The prompt to display
 * @param fileChoices - The provided choices to present along with "other"
 * @param fileMustExist - If true, the function will keep prompting the user
 *      until they have chosen an existing file.
 * @return A promise that resolves with the selected File.
 */
export async function promptForFileWithChoices(
    message: string,
    fileChoices: Array<File>,
    fileMustExist = true
): Promise<File> {
    const inquirerChoices =
        _.chain(fileChoices)
        .map((curFile) => (
            {
                name:  curFile.toString(),
                value: new SomeOption(curFile) as Option<File>,
                short: curFile.toString()
            }
        ))
        // The "other" option that will result in answers.inputValue ===
        // NoneOption.get().
        .concat({ name: "other", value: NoneOption.get(), short: "other" })
        .value();

    const question = {
        type:    "list",
        name:    "inputValue",
        message: message,
        choices: inquirerChoices
    };

    const fileExistsValidator = async (file: File) => {
        const exists = !!(await file.exists());
        return exists;
    };

    const validators: Array<ValidatorFunc<File>> = fileMustExist ? [fileExistsValidator] : [alwaysValid];

    // Keep prompting the user until we get a valid answer (i.e. selectedFile is
    // a Some value).
    let selectedFile: Option<File> = NoneOption.get();
    while (selectedFile.isNone) {
        const answers = await inquirer.prompt<{ inputValue: Option<File>; }>([question]);

        let tmpFile: File;
        if (answers.inputValue.isSome) {
            // The user has chosen an item from the provided choices.
            tmpFile = answers.inputValue.value;
        }
        else {
            // The user has chosen the "other" option.  Prompt them to manually
            // enter the File path.
            const str = await promptForString(message);
            tmpFile = new File(str);
        }

        // If tmpFile meets the caller's requirements, assign selectedFile to
        // the corresponding SomeOption.
        const isValid = await validate(tmpFile, validators);
        selectedFile = isValid ? new SomeOption(tmpFile) : NoneOption.get();
    }

    return selectedFile.value;
}
