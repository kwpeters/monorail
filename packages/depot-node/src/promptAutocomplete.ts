import inquirerPrompt from "inquirer-autocomplete-prompt";
import fuzzy from "fuzzy";
import inquirer, { Answers } from "inquirer";


/**
 * Registers the underlying Inquirer component used by promptForChoiceFuzzy().
 */
export function registerFuzzyPrompt(): void {
    inquirer.registerPrompt("autocomplete", inquirerPrompt);
}


/**
 * Prompts the user to make a choice from a list.  User input performs a fuzzy
 * search.
 *
 * Before using this function, the underlying Inquirer component must be
 * registered by calling registerFuzzyPrompt().
 *
 * @param message - The prompt to display
 * @param items - The items to choose from
 * @param nameFn - A function that converts each item to its display string
 * @return A Promise for the chosen item
 */
export async function promptForChoiceFuzzy<TItem>(
    message: string,
    items: Array<TItem>,
    nameFn: (item: TItem) => string
): Promise<TItem> {

    const itemsToChoices = (items: Array<TItem>): Array<{name: string, value: TItem}> => {
        return items.map((item) => ({ name: nameFn(item), value: item }));
    };

    const choiceFilterFn = (previousAnswers: Answers, searchStr: string) => {
        if (!searchStr) {
            return itemsToChoices(items);
        }

        const fuzzyMatches = fuzzy.filter(
            searchStr,
            items,
            {
                extract: (item: TItem) => nameFn(item)
            }
        );
        const matchingSubjects = fuzzyMatches.map((fuzzyMatch) => fuzzyMatch.original);
        return Promise.resolve(itemsToChoices(matchingSubjects));
    };

    const questionCommand = {
        type:     "autocomplete",
        name:     "fuzzyPrompt",
        message:  message,
        source:   choiceFilterFn,
        pageSize: 25,
        loop:     false
    };

    const answers = await inquirer.prompt<{ fuzzyPrompt: TItem}>([questionCommand]);
    return answers.fuzzyPrompt;
}
