import * as path from "node:path";
import { type Argv, type Arguments } from "yargs";
import { elideEqual } from "@repo/depot/stringDiff";
import { type PathPart } from "@repo/depot-node/pathHelpers";
import { Directory } from "@repo/depot-node/directory";
import { promptForChoice } from "@repo/depot-node/prompts";
import { showVsCodeDiff } from "@repo/depot-node/fileDiff";
import { FilePair } from "./filePair.mjs";
import { getFileMap } from "./fileMap.mjs";


export const command = "diff <sourceDir> <destDir>";
export const describe = "Diff the files in sourceDir and destDir";
export function builder(argv: Argv): Argv {
    return argv
    .positional("sourceDir", {
        describe: "The source directory",
        type:     "string"
    })
    .positional("destDir", {
        describe: "The destination directory",
        type:     "string"
    })
    .check(
        (argv: Arguments) => {
            const sourceDir = new Directory(argv.sourceDir as PathPart);
            const destDir = new Directory(argv.destDir as PathPart);

            if (!sourceDir.existsSync()) {
                throw new Error(`The source directory "${sourceDir.toString()}" does not exist.`);
            }

            if (!destDir.existsSync()) {
                throw new Error(`The destination directory "${destDir.toString()}" does not exist.`);
            }

            // If we got this far, everything is valid.
            return true;
        },
        false
    );
}

export async function handler(args: Arguments): Promise<void> {

    // Get file maps for both the source and destination directories.
    const [srcMap, dstMap] = await Promise.all([
        getFileMap(new Directory(args.sourceDir as PathPart)),
        getFileMap(new Directory(args.destDir as PathPart))
    ]);

    // Take all of the file names found in the destination directory, and
    // transform it into an array of file pairs when there is a source file with
    // the same name.
    const filePairs = Array.from(dstMap.keys()).reduce<Array<FilePair>>(
        (acc, curDstFileName) => {
            // If the current destination file is also a source file, create a
            // filePair.
            if (srcMap.has(curDstFileName)) {
                const filePair = new FilePair(srcMap.get(curDstFileName)!, dstMap.get(curDstFileName)!);
                acc.push(filePair);
            }
            return acc;
        },
        []
    );

    // If no file pairs were found, we are done.
    if (filePairs.length === 0) {
        console.log(`No similarly named files found.`);
        return undefined;
    }

    // Iterate over the file pairs and let the user interactively choose what to
    // do.
    for (const curFilePair of filePairs) {

        const [aAbbrevParts, bAbbrevParts] =
            elideEqual(curFilePair.fileA.toString(), curFilePair.fileB.toString(), path.sep, "...", 1, 1);

        const aAbbrev = aAbbrevParts.join(path.sep);
        const bAbbrev = bAbbrevParts.join(path.sep);

        console.log(``);
        console.log(aAbbrev);
        console.log(bAbbrev);

        let done = false;
        while (!done) {

            // If the files are identical, just print a message and move to the next.
            if (await curFilePair.filesAreIdentical()) {
                console.log(`Files are identical.`);
                done = true;
                continue;
            }

            const value = await promptForChoice(
                `File: ${curFilePair.fileB.fileName}`,
                [
                    {name: "diff", value: "diff"},
                    {name: "next", value: "next"},
                    {name: "end", value: "end"}
                ]
            );

            if (value === "diff") {
                await showVsCodeDiff(curFilePair.fileA, curFilePair.fileB, false, true);
            }
            else if (value === "next") {
                done = true;
            }
            else if (value === "end") {
                return undefined;
            }
        }


    }
}
