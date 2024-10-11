import * as os from "node:os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { PromiseResult } from "@repo/depot/promiseResult";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { Result, SucceededResult } from "@repo/depot/result";
import { File } from "@repo/depot-node/file";
import { getUncPath } from "@repo/depot-node/windowsHelpers";


////////////////////////////////////////////////////////////////////////////////
// Bootstrap
////////////////////////////////////////////////////////////////////////////////

const res = await PromiseResult.forceResult(main());
if (res.failed) {
    console.error(res.error);
    process.exit(-1);
}
else if (res.value !== 0) {
    console.error(`Script exited with code ${res.value}.`);
    process.exit(res.value);
}


async function main(): Promise<Result<number, string>> {
    return pipeAsync(
        getConfiguration(),

        (configRes) => Result.tapSuccess(
            async (config) => {
                // Loop through the files in the configuration and print
                // their information.
                for (const curFile of config.files) {
                    // Print the file's absolute path.
                    console.log(curFile.absPath());

                    // If we can get a UNC path for the file, print that too.
                    const uncRes = await getUncPath(curFile);
                    if (uncRes.succeeded) {
                        console.log(uncRes.value);
                    }
                }
            },
            configRes
        ),


        // (configRes) => PromiseResult.bind(
        //     (config) => {
        //         const absPaths = config.files.map((file) => file.absPath());
        //         return new SucceededResult(absPaths);
        //     },
        //     configRes
        // ),
        // (absPathsRes) => Result.tapSuccess(
        //     (absPaths) => {
        //         // Print the absolute path.
        //         console.log(absPaths.join("\n"));
        //
        //         // If we can get a UNC path, print it too.
        //         const uncRes = getUncPath()
        //
        //     },
        //     absPathsRes
        // ),
        (res) => Result.mapSuccess(() => 0, res)
    );
}


interface IConfig {
    files: File[];
}


/**
 * Gets the configuration for this script from the command line arguments.
 *
 * @return A Promise that always resolves with a Result.  If successful, the
 * Result contains the app configuration.  Otherwise the Result contains an
 * error message.
 */
async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv =
        await yargs(hideBin(process.argv))
        .usage(
            [
                "Converts the specified paths to absolute paths.",
                "",
                "abspath <path1> <path2>..."
            ].join(os.EOL)
        )
        .help()
        .wrap(process.stdout.columns ?? 80)
        .argv;

    const files = await pipeAsync(
        argv._,
        // Silently disregard any number arguments.
        (args) => args.filter((arg): arg is string => typeof arg === "string"),
        (strArgs) => strArgs.map((strArg) => new File(strArg))
    );

    return new SucceededResult({ files });
}
