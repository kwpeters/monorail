import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { getStdoutColumns } from "@repo/depot-node/ttyHelpers";
import * as commandDetectChapters from "./commandDetectChapters.mjs";
import * as commandBuild from "./commandBuild.mjs";


export async function main(): Promise<number> {
    await yargs(hideBin(process.argv))
    .scriptName("pdf-to-context")
    .command(commandDetectChapters)
    .command(commandBuild)
    .demandCommand(1)
    .strict()
    .help()
    .wrap(getStdoutColumns())  // Use 80 cols when undefined or 0.
    .parseAsync();

    return 0;
}
