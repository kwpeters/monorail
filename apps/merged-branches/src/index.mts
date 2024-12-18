import * as os from "node:os";
import * as url from "node:url";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { Directory } from "@repo/depot-node/directory";
import { GitBranch } from "@repo/depot-node/gitBranch";
import { GitRepo } from "@repo/depot-node/gitRepo";
import { type IChoiceString, promptForChoice } from "@repo/depot-node/prompts";

//
// This script finds the branches that have been merged into the specified
// target branch.  It also asks the user whether they would like to delete them.
//

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


async function main(): Promise<Result<number, string>> {

    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Lists the branches that have been merged into the specified target branch.",
            "Optionally, the merged branches can be deleted.",
            "",
            "mergedBranches <target_branch>"
        ].join(os.EOL)
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    const destBranch = argv._[0] as string;
    if (!destBranch) {
        throw new Error("Please specify name of destination branch.");
    }

    // Get a repo representing the current working directory.
    const cwd = new Directory(process.cwd());
    const repoResult = await GitRepo.fromDirectory(cwd);
    if (repoResult.failed) {
        throw new Error(repoResult.error);
    }
    const repo = repoResult.value;

    // Get the target branch.
    const targetBranchResult = await GitBranch.create(repo, destBranch);
    if (targetBranchResult.failed) {
        const errMsg = `Failed to find 'develop' branch.  ${targetBranchResult.error}`;
        throw new Error(errMsg);
    }

    // Find the branches that have been merged into the target branch.
    const mergedBranchesResult = await repo.getMergedBranches(targetBranchResult.value, true, false);
    if (mergedBranchesResult.failed) {
        const errMsg = `Failed to get merged branches.  ${mergedBranchesResult.error}`;
        throw new Error(errMsg);
    }

    const mergedBranches = mergedBranchesResult.value;
    console.log(`The following ${mergedBranches.length} branches have been merged to ${targetBranchResult.value.toString()}:`);
    console.log(mergedBranches.join("\n") + "\n");

    for (const curLocalBranch of mergedBranches) {
        const branchesToDelete = await promptToDeleteBranch(curLocalBranch);
        for (const branchToDelete of branchesToDelete) {
            const deleteResult = await branchToDelete.repo.deleteBranch(branchToDelete, true);
            if (deleteResult.succeeded) {
                console.log(`Deleted ${branchToDelete.toString()}.`);
            }
            else {
                console.log(`Failed to delete ${branchToDelete.toString()}. ${deleteResult.error}`);
            }
        }
    }

    return new SucceededResult(0);
}

async function promptToDeleteBranch(branch: GitBranch): Promise<Array<GitBranch>> {
    const choices: Array<IChoiceString> = [];
    choices.push({name: "Skip",                                     value: "none"});
    choices.push({name: `Delete local branch ${branch.toString()}`, value: "local"});

    const remoteBranch = await branch.getTrackedBranch();
    if (remoteBranch) {
        choices.push({name: `Delete remote branch ${remoteBranch.toString()}`, value: "remote"});
        choices.push({name: `Delete local and remote branches`, value: "both"});
    }

    const answer = await promptForChoice("Delete branches?", choices);
    if (answer === "none") {
        return [];
    }
    else if (answer === "local") {
        return [branch];
    }
    else if (answer === "remote") {
        return [remoteBranch!];
    }
    else {
        return [branch, remoteBranch!];
    }
}
