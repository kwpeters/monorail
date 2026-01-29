import { promisify } from "node:util";
import * as childProcess from "node:child_process";
import { type ArgumentsCamelCase, type Argv } from "yargs";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { PromiseResult } from "@repo/depot/promiseResult";
import { File } from "@repo/depot-node/file";
import { getNodeExePath } from "@repo/depot-node/nodeUtil";


const exec = promisify(childProcess.exec);


const commandDescription = [
    "Bundles the specified CJS app into a Node Single Executable Application (SEA) ",
    "using the Node.js 25.5.0+ `--build-sea` streamlined process. ",
    "See: https://nodejs.org/docs/latest/api/single-executable-applications.html"
].join("");


/**
  * A type that describes the properties that are added to the Yargs arguments
  * object once the command line has been parsed.  This must be kept in sync with
  * the builder.
  */
interface IArgsCommand {
    inputCjsFile: string;
    exeBaseName:  string;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const builder = (yargs: Argv<NonNullable<unknown>>) => {
    return  yargs
    .usage(commandDescription)
    .option(
        "inputCjsFile",
        {
            describe:     "Path to CommonJS app entry point",
            type:         "string",
            demandOption: true
        }
    )
    .option(
        "exeBaseName",
        {
            describe:     "Base name of the output executable (without extension)",
            type:         "string",
            demandOption: true
        }
    );
};


interface ISeaConfig {
    main:   string;
    output: string;
}


async function handler(argv: ArgumentsCamelCase<IArgsCommand>): Promise<Result<number, string>> {

    const configRes = await argsToConfig(argv);
    if (configRes.failed) {
        return configRes;
    }
    const config = configRes.value;

    const bundleFile = new File(
        config.inputCjsFile.directory,
        config.inputCjsFile.baseName + "-bundle" + config.inputCjsFile.extName
    );
    const seaConfigFile = new File(
        config.inputCjsFile.directory,
        config.inputCjsFile.baseName + "-sea-config.json"
    );
    const exeFile = new File(
        config.inputCjsFile.directory,
        config.exeBaseName + ".exe"
    );

    const res = await pipeAsync(
        createBundle(config.inputCjsFile, bundleFile),
        (res) => PromiseResult.tapSuccess(console.log, res),
        (res) => PromiseResult.bind(() => createSeaConfigFile(bundleFile, exeFile, seaConfigFile), res),
        (res) => PromiseResult.tapSuccess(console.log, res),
        (res) => PromiseResult.bind(() => createSeaExe(seaConfigFile), res),
        (res) => PromiseResult.tapSuccess(console.log, res),
    );

    if (res.failed) {
        throw new Error(res.error);
    }

    return new SucceededResult(0);
}


async function createBundle(
    inputCjs: File,
    bundleFile: File
): Promise<Result<string, string>> {
    try {
        await exec(`npx esbuild ${inputCjs.toString()} --bundle --platform=node --outfile=${bundleFile.toString()}`);
        return new SucceededResult(`✅ ESBuild successfully bundled ${bundleFile.toString()}.`);
    }
    catch (err) {
        const errTyped = err as childProcess.ExecException & { stdout: string, stderr: string; };
        return new FailedResult(`❌ Bundling failed. ESBuild exited with ${errTyped.code}. ${errTyped.stderr}`);
    }
}


async function createSeaConfigFile(
    bundleFile: File,
    exeFile: File,
    seaConfigFile: File
): Promise<Result<string, string>> {
    const seaConfig: ISeaConfig = {
        main:   bundleFile.fileName,
        output: exeFile.fileName
    };
    await seaConfigFile.writeJson(seaConfig);
    return new SucceededResult(`✅ Created Node.js SEA config file ${seaConfigFile.toString()}.`);
}


/**
 * Runs node with the --build-sea option to create a SEA application
 *
 * @param seaConfigFile - The SEA config file containing all info about the
 * executable to create
 * @return If successful, a message describing the completed task; otherwise, an
 * error message
 */
async function createSeaExe(
    seaConfigFile: File
): Promise<Result<string, string>> {

    const nodeExePathRes = await getNodeExePath();
    if (nodeExePathRes.failed) {
        return nodeExePathRes;
    }
    const nodeExePath = nodeExePathRes.value;

    const cmd = `${nodeExePath.toString()} --build-sea ${seaConfigFile.fileName}`;
    try {
        await exec(cmd, {cwd: seaConfigFile.directory.absPath()});
        return new SucceededResult("✅ Successfully created SEA executable.");
    }
    catch (err) {
        const errTyped = err as childProcess.ExecException & { stdout: string, stderr: string; };
        return new FailedResult(`❌ SEA build failed. Node exited with ${errTyped.code}. ${errTyped.stderr}`);
    }
}


/**
 * Config object for this subcommand.
 */
interface IConfig {
    inputCjsFile: File;
    exeBaseName:  string;
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

    const inputCjsFile = new File(argv.inputCjsFile);
    const exeBaseName = argv.exeBaseName;

    // Validate the exe base name.
    if (exeBaseName.length === 0) {
        return new FailedResult(`Base name of output executable cannot be empty.`);
    }

    // Validate the input CJS JavaScript file.
    const inputCjsExists = await inputCjsFile.exists();
    if (!inputCjsExists) {
        return new FailedResult(`Input CJS file "${inputCjsFile.toString()}" does not exist.`);
    }
    else {
        return new SucceededResult({inputCjsFile, exeBaseName});
    }
}


/**
 * Definition of this subcommand.
 */
export const def = {
    command:     "cjsToSeaApp2",
    description: commandDescription,
    builder:     builder,
    handler:     handler
};
