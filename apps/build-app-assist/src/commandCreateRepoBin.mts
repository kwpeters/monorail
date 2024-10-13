import { type ArgumentsCamelCase, type Argv } from "yargs";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { pipe } from "@repo/depot/pipe2";
import { PromiseResult } from "@repo/depot/promiseResult";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { NodePackage } from "@repo/depot-node/nodePackage";
import { getLaunchScriptCode } from "@repo/depot-node/nodeUtil";
import { mapAsync } from "@repo/depot/promiseHelpers";


const commandDescription = [
    "Creates a 'bin' directory that contains app launchers for all apps in ",
    "this monorepo."
].join("");


/**
  * A type that describes the properties that are added to the Yargs arguments
  * object once the command line has been parsed.  This must be kept in sync with
  * the builder.
  */
interface IArgsCommand {
    repoRootDir: string;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const builder = (yargs: Argv<NonNullable<unknown>>) => {
    return  yargs
    .usage(commandDescription)
    .option(
        "repoRootDir",
        {
            describe:     "The root directory of the monorepo",
            type:         "string",
            demandOption: true
        }
    );
};

async function handler(argv: ArgumentsCamelCase<IArgsCommand>): Promise<Result<number, string>> {

    const configRes = await argsToConfig(argv);
    if (configRes.failed) {
        return configRes;
    }

    const config = configRes.value;

    //
    // Make sure the "bin" directory exists and is empty.
    //
    const binDir = new Directory(config.repoRootDir, "bin");
    await binDir.empty();

    const packagesRes = await NodePackage.find(config.repoRootDir, false);
    if (packagesRes.failed) {
        return packagesRes;
    }

    const resCreateLaunchers = await pipeAsync(
        packagesRes.value,
        (packages) => mapAsync(packages, (pkg) => creatLaunchScriptsForPackage(binDir, pkg)),
        (results) => Result.allArrayM(results)
    );
    if (resCreateLaunchers.failed) {
        return resCreateLaunchers;
    }

    pipe(
        resCreateLaunchers.value,
        (fileArrArr) => fileArrArr.flat(1),
        (launcherFiles) => {
            console.log(`✅ Successfully created ${launcherFiles.length} launch scripts:`);
            console.log(launcherFiles.map((launcherFile) => `    ${launcherFile.toString() }`).join("\n"));
        }
    );

    return new SucceededResult(0);
}


async function creatLaunchScriptsForPackage(
    launchScriptDir: Directory,
    pkg: NodePackage
): Promise<Result<File[], string>> {

    return pipeAsync(
        pkg.binFiles,
        (binFilesMap) => Array.from(binFilesMap.entries()),
        (entries) => {
            return mapAsync(entries, ([binName, pkgRelativeFile]) => {
                return createLaunchScript(launchScriptDir, pkg.directory, pkgRelativeFile, binName);
            });
        },
        (results) => Result.allArrayM(results)
    );
}


async function createLaunchScript(
    launchScriptDir: Directory,
    pkgDir: Directory,
    pkgRelativeFile: File,
    launcherBaseName: string
): Promise<Result<File, string>> {
    const absTargetFile = new File(pkgDir, pkgRelativeFile.toString());
    const resLauncherInfo = getLaunchScriptCode(launchScriptDir, absTargetFile, launcherBaseName);
    if (resLauncherInfo.failed) {
        return resLauncherInfo;
    }

    const launcherInfo = resLauncherInfo.value;
    const resWrite = await PromiseResult.fromPromiseWith(
        launcherInfo.scriptFile.write(launcherInfo.scriptCode),
        () => `Failed to write launch script "${launcherInfo.scriptFile.toString()}".`
    );
    if (resWrite.failed) {
        return resWrite;
    }
    return new SucceededResult(launcherInfo.scriptFile);
}


/**
 * Config object for this subcommand.
 */
interface IConfig {
    repoRootDir: Directory;
}


/**
 * Converts this subcommand's arguments to its configuration object.
 *
 * @param argv - This subcommand's arguments
 * @return If successful, a successful Result containing the config object.
 */
async function argsToConfig(
    argv: ArgumentsCamelCase<IArgsCommand>
): Promise<Result<IConfig, string>> {

    const repoRootDir = new Directory(argv.repoRootDir);

    // Validate the repo root dir.
    const repoRootDirStats = await repoRootDir.exists();
    if (!repoRootDirStats) {
        return new FailedResult(`Repo root directory "${repoRootDir.toString()}" does not exist.`);
    }

    return new SucceededResult({repoRootDir});
}


/**
 * Definition of this subcommand.
 */
export const def = {
    command:     "createRepoBin",
    description: commandDescription,
    builder:     builder,
    handler:     handler
};
