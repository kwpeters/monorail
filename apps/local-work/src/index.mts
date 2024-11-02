import * as url from "node:url";
import * as os from "node:os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { PromiseResult } from "@repo/depot/promiseResult";
import { indent } from "@repo/depot/stringHelpers";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { GitRepo } from "@repo/depot-node/gitRepo";


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
    dir: Directory
}


async function main(): Promise<Result<number, string>> {

    const configRes = await getConfiguration();
    if (configRes.failed) {
        return configRes;
    }

    const repos = await getRepos(configRes.value.dir);
    console.log(`Found ${repos.length} repos.`);
    let numProjectsWithLocalWork = 0;
    for (const curRepo of repos) {
        numProjectsWithLocalWork += await report(curRepo) ? 1 : 0;
    }

    if (numProjectsWithLocalWork > 0) {
        return new FailedResult(`❌ Projects with local work: ${numProjectsWithLocalWork}`);
    }
    else {
        console.log("✅ No local work exists.");
        return new SucceededResult(0);
    }
}


async function getConfiguration(): Promise<Result<IConfig, string>> {
    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Searches for local Git work that has not been committed or pushed.",
            "",
            "localWork"
        ].join(os.EOL)
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    const dirArg = argv._[0] as string;
    const dir = dirArg ? new Directory(dirArg) : new Directory(".");
    if (!dir.existsSync()) {
        return new FailedResult(`Directory does not exist: ${dirArg}`);
    }

    return new SucceededResult({dir});
}


/**
 * Searches the current working directory recursively for Git repositories.
 *
  * @param dir - The directory to search within
 * @returns An array of the found Git repositories
 */
async function getRepos(dir: Directory): Promise<Array<GitRepo>> {
    const repos: Array<GitRepo> = [];

    const cwdRepoRes = await GitRepo.fromDirectory(dir);
    if (cwdRepoRes.succeeded) {
        repos.push(cwdRepoRes.value);
    }

    await dir.walk(async (item) => {
        // Not interested in files.
        if (item instanceof File) { return false; }

        const repoRes = await GitRepo.fromDirectory(item);
        if (repoRes.succeeded) {
            repos.push(repoRes.value);
            // We found the repo.  Don't recurse any further.
            return false;
        }
        else if (item.toString().includes("node_modules")) {
            return false;
        }
        else {
            return true;
        }

    });
    return repos;
}


/**
 * Prints a status report for the specified project.
 *
 * @param repo - The repo to print a report for
 * @returns A boolean indicating whether the specified project contains local
 * work.
 */
async function report(repo: GitRepo): Promise<boolean> {
    const warnings: Array<string> = [];

    const modifiedFiles = await repo.modifiedFiles();
    if (modifiedFiles.length > 0) {
        warnings.push(`Modified files:    ${modifiedFiles.length}`);
    }

    const untrackedFiles = await repo.untrackedFiles();
    if (untrackedFiles.length > 0) {
        warnings.push(`Untracked files:   ${untrackedFiles.length}`);
    }

    try {
        const {ahead} = await repo.getCommitDeltas();
        if (ahead > 0) {
            warnings.push(`Unpushed commits:  ${ahead}`);
        }
    }
    catch (err) {
        // Intentionally empty.
    }

    const containsLocalWork = warnings.length > 0;
    if (containsLocalWork) {
        console.log(repo.directory.toString());
        console.log(warnings.map((str) => indent(str, 4)).join(os.EOL));
    }
    return containsLocalWork;
}
