import * as _ from "lodash-es";
import {removeBlankLines, splitIntoLines, numInitial, isBlank, getEol} from "./stringHelpers.mjs";
import { insertIf } from "./arrayHelpers.mjs";
import { pipe } from "./pipe2.mjs";


function getCommentToken(): string {
    return "//";
}


/**
 * Transform `linesToComment` into lines that are properly commented out.
 * @param linesToComment - The source to be commented
 * @param precedingLine - The line preceding the source to be commented.  Used
 *     to infer preceding comment indentation.
 * @return A new string representing the commented version of the source.
 * `undefined` is returned if there was an error and the original source should
 * not be replaced.
 */
export function comment(
    linesToComment: string,
    precedingLine?: string
): string | undefined {
    // TODO: Convert the regex to used named captures.
    // eslint-disable-next-line prefer-named-capture-group
    const commentedLineRegex = /^(?<begin_ws>\s*)(?<comment_token>(\/\/)|(#))(?<post_comment_ws>\s*)(?<text>.*)/;

    if (linesToComment.length === 0 || /^\s*$/.test(linesToComment)) {
        if (precedingLine) {
            const match = commentedLineRegex.exec(precedingLine);
            if (match) {
                return `${match.groups!.begin_ws}${match.groups!.comment_token}`;
            }
            else {
                return undefined;
            }
        }
        else {
            // There is nothing to comment and nothing to continue from above.
            return undefined;
        }
    }

    const sourceLines = splitIntoLines(linesToComment, true);
    const nonEmptyLines = splitIntoLines(removeBlankLines(linesToComment), true);
    if (nonEmptyLines.length === 0) {
        // All lines were empty.  There really isn't a need to comment them.
        return undefined;
    }

    let indentStr: string;

    // If the first character is non-whitespace, the comment must start in
    // column 0.
    if (!/\s/.test(nonEmptyLines[0]![0]!)) {
        indentStr = "";
    }
    else {
        // We will assume the the whitespace used for indentation is the first
        // character of the first non-empty line.  This will (hopefully) figure
        // out whether the user is using spaces or tabs.
        const indentChar = nonEmptyLines[0]![0]!;

        const linesToConsider: Array<string> = [
            ...nonEmptyLines,
            ...insertIf(precedingLine && commentedLineRegex.test(precedingLine), precedingLine!)
        ];

        // The amount of indentation will be determined by the line with the
        // least indentation characters at the beginning.
        const numIndentChars = pipe(
            linesToConsider.map((curLine) => numInitial(curLine, indentChar)),
            (numIndents) => Math.min(...numIndents)
        );

        indentStr = _.repeat(indentChar, numIndentChars);
    }

    const result = pipe(
        sourceLines.map((curLine) => {
            // The original text that will follow the comment token.
            // If the current line is a blank one, it may be zero-length, so we will
            // use the whole line in order to get the EOL.  If it is not blank, it
            // will be everything following the common indent.
            const blank = isBlank(curLine);
            const sourceText = blank ? getEol(curLine) || "" :
                                    curLine.slice(indentStr.length);

            // The whitespace that will follow the comment token.
            const postCommentSpace = blank ? "" : " ";

            return `${indentStr}${getCommentToken()}${postCommentSpace}${sourceText}`;
        }),
        (lines) => lines.join("")
    );

    return result;
}

/**
 * Transform `linesToUncomment` into lines that are no longer commented out.
 * @param linesToUncomment - The source to be uncommented
 * @return A new string representing the uncommented version of the source.
 * `undefined` is returned if there was an error and the original source should
 * not be replaced.
 */
export function uncomment(linesToUncomment: string): string | undefined {
    if (linesToUncomment.length === 0 || /^\s*$/.test(linesToUncomment)) {
        // There is nothing in need of uncommenting.
        return undefined;
    }

    const sourceLines = splitIntoLines(linesToUncomment, true);
    // eslint-disable-next-line prefer-named-capture-group
    const commentedLineRegex = /^(?<begin_ws>\s*)(?<comment_token>(\/\/)|(#))(?<post_comment_ws>\s*)(?<text>.*)/;

    const resultLines = sourceLines.map((curLine) => {
        const match = commentedLineRegex.exec(curLine);
        if (!match) {
            return curLine;
        }

        const beginWs = match.groups!.begin_ws;
        // For the post-comment whitespace, we will use all of it except the
        // first character.  We are assuming that the first whitespace character
        // was add with the comment token itself.
        const postCommentWs = match.groups!.post_comment_ws!;
        const newPostCommentWs =
            isBlank(postCommentWs) && isBlank(match.groups!.text!) ?
            "" :
            postCommentWs.slice(1);
        const text             = match.groups!.text;
        const eol              = getEol(curLine) || "";
        let uncommented      = beginWs + newPostCommentWs + text + eol;
        if (isBlank(uncommented)) {
            uncommented = eol;
        }
        return uncommented;
    });

    return resultLines.join("");
}


/**
 * Toggles the commented state of `linesToToggle`
 * @param linesToToggle - The source lines to be toggled
 * @param precedingLine - The line preceding `linesToToggle`.  Used as context.
 * @return A new string representing the toggled source.  `undefined` is
 * returned if there was an error and the original source should not be
 * replaced.
 */
export function toggleComment(linesToToggle: string, precedingLine?: string): string | undefined {
    // TODO: Convert the following regex to use named capture groups.
    // eslint-disable-next-line prefer-named-capture-group
    const firstNonWhitespace = /\s*(\S\S)/m;
    const match = firstNonWhitespace.exec(linesToToggle);
    if (match && match[1] === "//") {
        return uncomment(linesToToggle);
    }
    else {
        return comment(linesToToggle, precedingLine);
    }
}
