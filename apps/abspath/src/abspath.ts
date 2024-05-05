import * as os from "os";
import yargs from "yargs/yargs";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { pipeAsync } from "../../../packages/depot/src/pipeAsync2.js";
import { Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { File } from "../../../packages/depot-node/src/file.js";


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
        (configRes) => PromiseResult.bind(
            (config) => {
                const absPaths = config.files.map((file) => file.absPath());
                return new SucceededResult(absPaths);
            },
            configRes
        ),
        (absPathsRes) => Result.tapSuccess(
            (absPaths) => console.log(absPaths.join("\n")),
            absPathsRes
        ),
        (res) => Result.mapSuccess(() => 0, res)
    );
}


interface IConfig {
    files: File[];
}


async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv =
        await yargs(process.argv.slice(2))
        .usage(
            [
                "Converts the specified paths to absolute paths.",
                "",
                "abspath <path1> <path2>..."
            ].join(os.EOL)
        )
        .help()
        .wrap(80)
        .argv;

    const files = await pipeAsync(
        argv._,
        // Silently disregard any number arguments.
        (args) => args.filter((arg): arg is string => typeof arg === "string"),
        (strArgs) => strArgs.map((strArg) => new File(strArg))
    );

    return new SucceededResult({ files });
}
