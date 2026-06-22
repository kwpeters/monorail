import * as url from "node:url";
import * as os from "node:os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { pipe } from "@repo/depot/pipe2";
import { File } from "@repo/depot-node/file";
import { showVsCodeDiff } from "@repo/depot-node/vsCode";
import { getStdoutColumns } from "@repo/depot-node/ttyHelpers";


////////////////////////////////////////////////////////////////////////////////
// Bootstrap
////////////////////////////////////////////////////////////////////////////////

if (runningThisScript()) {

    const res = await PromiseResult.forceResult(main());
    if (res.failed) {
        console.error(res.error);
        process.exit(-1);
    }
    else if (res.value !== 0) {
        console.error(`Script exited with code ${res.value}.`);
        process.exit(res.value);
    }
}


function runningThisScript(): boolean {
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]!).href;
    return runningThisScript;
}


////////////////////////////////////////////////////////////////////////////////
// main
////////////////////////////////////////////////////////////////////////////////

async function main(): Promise<Result<number, string>> {

    const resConfig = await getConfiguration();
    if (resConfig.failed) {
        return resConfig;
    }

    const resEnv = checkEnvironment();
    if (resEnv.failed) {
        return resEnv;
    }

    const config = resConfig.value;
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const left = new File(process.env.CLOUDHOME!, `diff-buff-left.${config.ext}`);
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    const right = new File(process.env.CLOUDHOME!, `diff-buf-right.${config.ext}`);

    if (config.reset || !left.existsSync()) {
        left.writeSync("");
    }
    if (config.reset || !right.existsSync()) {
        right.writeSync("");
    }

    console.log("Starting diff on the following files:");
    console.log(`    ${left.toString()}`);
    console.log(`    ${right.toString()}`);
    await showVsCodeDiff(left, right, false, false);

    return new SucceededResult(0);
}


function checkEnvironment(): Result<undefined, string> {
    return pipe(
        // eslint-disable-next-line turbo/no-undeclared-env-vars
        Result.requireTruthy("Environment variable CLOUDHOME is not defined", process.env.CLOUDHOME),
        Result.mapSuccess(() => undefined)
    );
}


interface IConfig {
    reset: boolean;
    ext:   string;
}

/**
 * Gets the configuration for this script from the command line arguments.
 *
 * @return A Promise that always resolves with a Result.  If successful, the
 * Result contains the app configuration.  Otherwise the Result contains an
 * error message.
 */
async function getConfiguration(): Promise<Result<IConfig, string>> {
    //
    // Currently, there are no command line options or arguments.
    //
    const argv =
        await yargs(hideBin(process.argv))
        .usage(
            [
                "Open an editor comparing two files.",
                "",
                "diff-buf <options>"
            ].join(os.EOL)
        )
        .option(
            "reset",
            {
                demandOption: false,
                type:         "boolean",
                default:      false,
                describe:     "clear the contents of temporary diff files"
            }
        )
        .option(
            "ext",
            {
                demandOption: false,
                type:         "string",
                default:      "",
                describe:     "sets the extension of the buffers"
            }
        )
        .help()
        .wrap(getStdoutColumns())
        .argv;

    // If the initial "." was included in the extension, remove it.
    if (argv.ext.startsWith(".")) {
        argv.ext = argv.ext.slice(1);
    }

    return new SucceededResult({
        reset: argv.reset,
        ext:   argv.ext || "txt"
    });
}
