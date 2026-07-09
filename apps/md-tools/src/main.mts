import { hideBin } from "yargs/helpers";
import yargs from "yargs/yargs";
import * as commandPreview from "./commandPreview.mjs";
import * as commandPrune from "./commandPrune.mjs";


export async function main(): Promise<number> {
    try {
        await yargs(hideBin(process.argv))
        .scriptName("md-tools")
        .command(commandPreview)
        .command(commandPrune)
        .demandCommand(1)
        .strict()
        .help()
        .parseAsync();
        return 0;
    }
    catch (err) {
        console.error("Fatal error while running md-tools.");
        console.error(err instanceof Error ? `${err.name}: ${err.message}` : String(err));
        return 2;
    }
}
