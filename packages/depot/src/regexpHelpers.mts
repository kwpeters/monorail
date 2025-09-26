import * as _ from "lodash-es";
import { FailedResult, Result, SucceededResult } from "./result.mjs";
import { NoneOption, Option, SomeOption } from "./option.mjs";
import { pipe } from "./pipe2.mjs";


/**
 * Creates a new regular expression capable of detecting EOL.  Because regular
 * expressions have state, a function is used here to create new instances for
 * clients.
 * @param flags - Any RegExp flag that should be used when creating the regex.
 * @return The newly created regex
 */
export function createEolRegex(flags?: string): RegExp {
    return new RegExp("\\r?\\n", flags);
}


/**
 * Determines whether the specified string matches any of the specified regular
 * expressions.
 * @param str - The string to test.
 * @param regexes - The regexes to test.
 * @return true if one or more of the regular expressions match `str`; false
 * otherwise.
 */
export function matchesAny(str: string, regexes: Array<RegExp>): boolean {
    const matchesAny = _.some(regexes, (curRegex) => str.match(curRegex));
    return matchesAny;
}


/**
 * Determines whether the specified collection of strings includes the specified
 * string or contains a string that matches the specified regular expression.
 *
 * @param strings - The collection of strings to be searched
 * @param strOrRegex - The string or regular expression to search for
 * @return An Option containing the found string, or NoneOption if not found
 */
export function includesOrIncludesMatch(strings: Iterable<string>, strOrRegex: string | RegExp): Option<string> {

    if (typeof strOrRegex === "string") {
        // The caller provided a string to search the `strings` array for.  We
        // can just use Array's includes() methods.
        return pipe(
            Array.from(strings),
            (strings) => {
                const foundStr = strings.find((curStr) => curStr === strOrRegex);
                return Option.fromNullable(foundStr);
            }
        );
    }

    // strOrRegex is a RegExp.  We have to iterate through the strings and see
    // if any match.
    for (const curStr of strings) {
        if (curStr.match(strOrRegex)) {
            return new SomeOption(curStr);
        }
    }

    // If we got here, no strings matched.
    return NoneOption.get();
}


type RegExpFlag = "d" | "g" | "i" | "m" | "s" | "u" | "y";


/**
 * Creates a new RegExp without the specified flags.
 * @param srcRegex - The source regex
 * @param flagsToClear - The flag to clear
 * @returns A new RegExp without the specified flag.
 */
export function clearFlags(srcRegex: RegExp, flagsToClear: Array<RegExpFlag>): RegExp {
    let newFlags = srcRegex.flags;
    flagsToClear.forEach((curFlag) => {
        newFlags = newFlags.replace(curFlag, "");
    });
    const newRegex = new RegExp(srcRegex, newFlags);
    return newRegex;
}


/**
 * Creates a new RegExp with the specified flags set.
 * @param srcRegex - The source regex
 * @param flagsToSet - The flag to set
 * @returns A new RegExp with the specified flag set
 */
export function setFlags(srcRegex: RegExp, flagsToSet: Array<RegExpFlag>): RegExp {
    let newFlags = srcRegex.flags;
    flagsToSet.forEach((curFlag) => {
        newFlags = newFlags.replace(curFlag, "") + curFlag;
    });
    const newRegex = new RegExp(srcRegex, newFlags);
    return newRegex;
}


/**
 * Gets a RegExp used to match regular expression expressions.  Wrapped in
 * this function to avoid problems with the instance's state.
 * @returns A regular expression that matches regular expression expressions.
 */
function getRegExpStrRegExp(): RegExp {
    const regexStrRegex = /^\/(?<pattern>.*)\/(?<flags>[dgimsuy]*)$/g;
    return regexStrRegex;
}


/**
 * Converts a string to a RegExp instance.
 * @param str - The string to convert to a RegExp.  May be of the form
 * "/<pattern>/<flags>" or "<pattern>".
 * @returns A Result for the RegExp instance.  Upon failure, the error
 * contains a descriptive error message.
 */
export function strToRegExp(str: string): Result<RegExp, string> {
    const matches = getRegExpStrRegExp().exec(str);
    try {
        if (matches) {
            const regex = new RegExp(matches.groups!.pattern!, matches.groups!.flags);
            return new SucceededResult(regex);
        }
        else {
            const regex = new RegExp(str);
            return new SucceededResult(regex);
        }
    }
    catch (err) {
        return new FailedResult((err as Error).message);
    }
}


/**
 * Matches _regex_ against _text_ and returns the text matched by the specified
 * named capture group.
 *
 * @param regex - The pattern to match
 * @param param - The group name that is to be extracted upon a successful match
 * @param text - The text to match against
 * @return If the match was successful, a SomeOption containing the text matched
 *     by the specified named group.  Otherwise, a NoneOption.
 */
export function extractNamedGroup(
    regex: RegExp,
    groupName: string,
    text: string
): Option<string> {
    const matches = regex.exec(text);
    if (!matches) {
        return NoneOption.get();
    }

    const groups = matches.groups;
    if (groups === undefined) {
        return NoneOption.get();
    }

    const groupText = groups[groupName];
    if (groupText === undefined) {
        return NoneOption.get();
    }

    return new SomeOption(groupText);
}
