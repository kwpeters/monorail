import { Argv, Arguments } from "yargs";
import { PathPart } from "../../../packages/depot-node/src/pathHelpers.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";


export const command = "full <sourceDir> <destDir>";
export const describe = "Empty destDir and copy all contents of sourceDir into it";
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
    .option(
        "allownonexistent",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "allows sourceDir and destDir to not exist and returns with a successful exit code"
        }
    )
    .check(
        (argv: Arguments) => {

            if (argv.allownonexistent) {
                // Don't bother checking to see if sourceDir and destDir exist.
                return true;
            }

            // Make sure sourceDir and destDir exist.  If either don't exist
            // exit with a non-zero exit code.
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

    const sourceDir = new Directory(args.sourceDir as PathPart);

    // If the source directory does not exist, there is nothing to do.
    if (!sourceDir.existsSync()) {
        return;
    }

    const destDir = new Directory(args.destDir as PathPart);

    await destDir.empty()
    .then(() => {
        // destDir will be created if non-existent
        return sourceDir.copy(destDir, false);
    });
}
