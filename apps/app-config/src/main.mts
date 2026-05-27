import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { getStdoutColumns } from "@repo/depot-node/ttyHelpers";
import * as commandReview from "./commandReview.mjs";


export function buildCli(argvInput: Array<string>): ReturnType<typeof yargs> {
    return yargs(argvInput)
    .scriptName("app-config")
    .usage("Usage: app-config <command>")
    .command(commandReview)
    .demandCommand(1, "A command is required.")
    .strict()
    .help()
    .wrap(getStdoutColumns());
}


export async function main(
    argvInput: Array<string> = hideBin(process.argv)
): Promise<number> {
    await buildCli(argvInput).argv;

    return 0;
}
