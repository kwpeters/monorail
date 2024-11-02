import * as os from "node:os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult } from "@repo/depot/result";
import {def as defImport} from "./importCommand.mjs";
import {def as defFix} from "./fixCommand.mjs";


export async function main(): Promise<number> {
    const res = await mainImpl();
    if (res.succeeded) {
        return res.value;
    }
    else {
        console.error(res.error);
        return -1;
    }
}


async function mainImpl(): Promise<Result<number, string>> {

    let retVal: Result<number, string> = new SucceededResult(0);

    const __argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Provides several commands related to maintaining a photo library."
        ].join(os.EOL)
    )
    .command(
        defImport.command,
        defImport.description,
        defImport.builder,
        async (argv) => {
            retVal = await defImport.handler(argv);
        }
    )
    .command(
        defFix.command,
        defFix.description,
        defFix.builder,
        async (argv) => {
            retVal = await defFix.handler(argv);
        }
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    return retVal;
}
