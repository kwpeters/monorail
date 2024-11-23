#!/usr/bin/env node
import * as os from "node:os";
// eslint-disable-next-line @typescript-eslint/naming-convention
import React from "react";
import { render } from "ink";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
// eslint-disable-next-line @typescript-eslint/naming-convention
import App from "./app.js";


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

    const resConfig = await getConfiguration();
    if (resConfig.failed) {
        return resConfig;
    }

    render(<App name={resConfig.value.name} />);
    return new SucceededResult(0);
}


interface IConfig {
    name: string;
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
                "Greets the user.",
                "",
                "ink-sample-app-xyzzy [options]"
            ].join(os.EOL)
        )
        .option(
            "name",
            {
                demandOption: false,
                type:         "string",
                default:      "",
                describe:     "The user's name"
            }
        )
        .help()
        .wrap(process.stdout.columns ?? 80)
        .argv;

    return new SucceededResult({ name: argv.name });
}
