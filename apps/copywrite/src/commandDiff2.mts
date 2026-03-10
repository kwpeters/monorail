// import * as path from "node:path";
import { type Argv, type Arguments } from "yargs";
// import { elideEqual } from "@repo/depot/stringDiff";
import { type PathPart } from "@repo/depot-node/pathHelpers";
import { Directory } from "@repo/depot-node/directory";
// import { promptForChoice } from "@repo/depot-node/prompts";
// import { showVsCodeDiff } from "@repo/depot-node/fileDiff";
// import { FilePair } from "./filePair.mjs";
// import { getFileMap } from "./fileMap.mjs";


export const command = "diff2 <sourceDir> <destDir>";
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
    await Promise.resolve(0);
}
