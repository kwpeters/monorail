import * as os from "node:os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult, FailedResult } from "@repo/depot/result";
import { Option, NoneOption, SomeOption } from "@repo/depot/option";
import { runResolutionPipeline } from "@repo/depot/resolutionPipeline";
import { getStdoutColumns } from "@repo/depot-node/ttyHelpers";
import { File } from "@repo/depot-node/file";
import { Directory } from "@repo/depot-node/directory";


export interface ICliConfig {
    subjectsConfigFile: File;
}


/**
 * Gets the configuration for this script from the command line arguments.
 *
 * @return A Promise that always resolves with a Result.  If successful, the
 * Result contains the app configuration.  Otherwise the Result contains an
 * error message.
 */
export async function getCliConfiguration(): Promise<Result<ICliConfig, string>> {
    //
    // Currently, there are no command line options or arguments.
    //
    const argv =
        await yargs(hideBin(process.argv))
        .usage(
            [
                "Launch common actions.",
                "",
                "mm <options>"
            ].join(os.EOL)
        )
        .option(
            "subjectsConfigFile",
            {
                demandOption: false,
                type:         "string",
                describe:     "path to the subjects configuration file"
            }
        )
        .help()
        .wrap(getStdoutColumns())
        .argv;


    const resSubjectsConfigFile = await runResolutionPipeline<File, string>(
        [
            // Strategy 1: path explicitly provided on the command line.
            async () => {
                if (!argv.subjectsConfigFile) {
                    return new SucceededResult(NoneOption.get());
                }

                const subjectsConfigFile = new File(argv.subjectsConfigFile);
                const exists = await subjectsConfigFile.exists();
                return exists ?
                    new SucceededResult(new SomeOption(subjectsConfigFile)) :
                    new FailedResult(`The file "${argv.subjectsConfigFile}" does not exist.`);
            },

            // Strategy 2: mm.json in the CLOUDHOME directory.
            () => getSubjectsConfigFileFromEnvVar("CLOUDHOME"),

            // Strategy 3: mm.json in the HOME directory.
            () => getSubjectsConfigFileFromEnvVar("HOME")
        ],
        {
            onExhausted: () => [
                "Could not locate the subjects configuration file.",
                "Consider doing one of the following:",
                "- Specify the path to the configuration file using the --subjectsConfigFile option.",
                "- Create a mm.json file in the directory specified by the CLOUDHOME environment variable.",
                "- Create a mm.json file in the directory specified by the HOME environment variable."
            ].join(os.EOL)
        }
    );

    if (resSubjectsConfigFile.failed) {
        return resSubjectsConfigFile;
    }

    return new SucceededResult({ subjectsConfigFile: resSubjectsConfigFile.value });
}


async function getSubjectsConfigFileFromEnvVar(
    envVarName: string
): Promise<Result<Option<File>, string>> {
    const dirRes = await Directory.fromEnvVar(envVarName);
    if (dirRes.failed) {
        return new SucceededResult(NoneOption.get());
    }

    const subjectsFile = new File(dirRes.value, "mm.json");
    const exists = await subjectsFile.exists();
    return exists ?
        new SucceededResult(new SomeOption(subjectsFile)) :
        new SucceededResult(NoneOption.get());
}
