import * as url from "node:url";
import * as os from "node:os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { getRandomInt } from "@repo/depot/random";
import { Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { Directory } from "@repo/depot-node/directory";
import { getOs, OperatingSystem } from "@repo/depot-node/os";
import { spawn } from "@repo/depot-node/spawn2";


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


interface IConfig {
    open: boolean;
    show: boolean;
}


async function getConfiguration(): Promise<IConfig> {
    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Selects a random file from within the current working directory.",
            "",
            "randomFile [options]"
        ].join(os.EOL)
    )
    .help()
    .option(
        "open",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "open the randomly selected file"
        }
    )
    .option(
        "show",
        {
            demandOption: false,
            type:         "boolean",
            default:      false,
            describe:     "show the file"
        }
    )
    .wrap(process.stdout.columns ?? 80)
    .argv;

    return {
        open: argv.open,
        show: argv.show
    };
}

async function main(): Promise<Result<number, string>> {
    const cwd = new Directory(".");
    const os = getOs();
    const { files } = await cwd.contents(true);
    const randomInt = getRandomInt(0, files.length);
    const randomFile = files[randomInt]!;
    const randomFileQuoted = `"${randomFile.toString()}"`;
    const config = await getConfiguration();

    console.log(`Files:      ${files.length}`);
    console.log(`Random Int: ${randomInt}`);
    console.log(`Selected:   ${randomFileQuoted}`);

    if (os === OperatingSystem.Windows) {

        if (config.show) {
            // TODO: Create a show() method on File.
            // TODO: Create a show() method on Directory.
            spawn("explorer.exe", ["/select,", randomFile.absPath()]);
        }

        if (config.open) {
            // TODO: Create a open() method on File.
            // TODO: Create a open() method on Directory.
            spawn("start", [`""`, randomFileQuoted], {shell: true, cwd: cwd.toString()});
        }

    }

    return new SucceededResult(0);
}
