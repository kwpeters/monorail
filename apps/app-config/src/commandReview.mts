import { type Argv, type Arguments } from "yargs";
import { FailedResult, type Result, SucceededResult } from "@repo/depot/result";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { type PathPart } from "@repo/depot-node/pathHelpers";
import { parseReviewConfig } from "./reviewConfig.mjs";
import { runInteractiveReview } from "./reviewRunner.mjs";


export const command = "review <configFile>";
export const describe = "Review repository files against deployed files from a JSONC config file";


export function builder(argv: Argv): Argv {
    return argv
    .usage("Usage: app-config review <configFile>")
    .positional("configFile", {
        describe: "Path to JSONC configuration file containing mappings",
        type:     "string"
    })
    .example(
        "$0 review app-config.review.json",
        "Review configured mappings and optionally open VS Code diffs for different files."
    );
}


export async function handler(args: Arguments): Promise<void> {
    const configFile = new File(args.configFile as PathPart);
    const repoRootDir = new Directory(process.cwd());

    const runResult = await executeReview(configFile, repoRootDir);
    if (runResult.failed) {
        throw new Error(runResult.error);
    }
}


export async function executeReview(configFile: File, repoRootDir: Directory): Promise<Result<void, string>> {
    const configResult = await parseReviewConfig(configFile, repoRootDir);
    if (configResult.failed) {
        return new FailedResult(configResult.error);
    }

    const reviewResult = await runInteractiveReview(configResult.value);
    if (reviewResult.failed) {
        return reviewResult;
    }

    return new SucceededResult(undefined);
}
