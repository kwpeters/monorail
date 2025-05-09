import * as os from "node:os";
import * as url from "node:url";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { pipe } from "@repo/depot/pipe";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { spawn } from "@repo/depot-node/spawn2";


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

interface IConfig {
    left:  Directory | File;
    right: Directory | File;
}


async function main(): Promise<Result<number, string>> {

    const configRes = await getConfiguration();
    if (configRes.failed) {
        return configRes;
    }

    const ideRes = await findIde();
    if (ideRes.failed) {
        return ideRes;
    }
    else {
        console.log(`Found IDE: ${ideRes.value.toString()}`);
    }

    const spawnRes =
        spawn(
            ideRes.value.absPath(),
            ["diff", configRes.value.left.absPath(), configRes.value.right.absPath()]
        );
    await spawnRes.closePromise;

    return new SucceededResult(0);
}


async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Diffs two directories or two files.",
            "",
            "idea-diff <file_or_dir_1> <file_or_dir_2>"
        ].join(os.EOL)
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    function isDirOrFile(val: string): Result<Directory | File, string> {
        const dir = new Directory(val);
        if (dir.existsSync()) { return new SucceededResult(dir); }

        const file = new File(val);
        if (file.existsSync()) { return new SucceededResult(file); }

        return new FailedResult(`${val} is not a directory or file.`);
    }

    function argToDirOrFile(arg: string | undefined) {
        return pipe(arg)
        .pipe((arg) => arg === undefined ? new FailedResult("File or directory not specified.") : new SucceededResult(arg))
        .pipe((res) => Result.bind(isDirOrFile, res))
        .end();
    }

    return pipe(Result.allArrayM(
        [
            argToDirOrFile(argv._[0] as string | undefined),
            argToDirOrFile(argv._[1] as string | undefined)
        ]
    ))
    .pipe((res) => Result.bind(
        ([left, right]) => {
            return left!.constructor.name === right!.constructor.name ?
                new SucceededResult({ left: left!, right: right! }) :
                new FailedResult("Both arguments must be either a directory or a file.");
        },
        res
    ))
    .end();
}


async function findIde(): Promise<Result<File, string>> {
    const progFilesDir = new Directory("c:", "Program Files", "JetBrains");
    let foundExe: File | undefined = undefined;

    await progFilesDir.walk((item) => {
        if (item instanceof File) {
            if (item.fileName === "rider64.exe" ||
                item.fileName === "webstorm64.exe") {
                foundExe = item;
            }
        }
        // Only recurse into directories when an exe has not been found.
        return foundExe === undefined;
    });

    return foundExe === undefined ?
        new FailedResult("Could not find JetBrains IDE executable.") :
        new SucceededResult(foundExe);
}
