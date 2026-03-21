import { promisify } from "node:util";
import * as childProcess from "node:child_process";
import { type ArgumentsCamelCase, type Argv } from "yargs";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { File } from "@repo/depot-node/file";
import { getNodeExePath } from "@repo/depot-node/nodeUtil";


const exec = promisify(childProcess.exec);


const commandDescription = [
    "Bundles the specified ESM app into a Node Single Executable Application (SEA) ",
    "using the Node.js 21.7.0+ ESM SEA support. ",
    "Use this command instead of cjsToSeaApp2 when the app (or its dependencies) ",
    "uses top-level await or other ESM-only features that cannot be bundled as CJS. ",
    "See: https://nodejs.org/docs/latest/api/single-executable-applications.html"
].join("");


/**
  * A type that describes the properties that are added to the Yargs arguments
  * object once the command line has been parsed.  This must be kept in sync with
  * the builder.
  */
interface IArgsCommand {
    inputEsmFile: string;
    exeBaseName:  string;
}


// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
const builder = (yargs: Argv) => {
    return  yargs
    .usage(commandDescription)
    .option(
        "inputEsmFile",
        {
            describe:     "Path to ESM app entry point",
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
        config.inputEsmFile.directory,
        config.inputEsmFile.baseName + "-bundle.mjs"
    );
    const seaConfigFile = new File(
        config.inputEsmFile.directory,
        config.inputEsmFile.baseName + "-sea-config.json"
    );
    const exeFile = new File(
        config.inputEsmFile.directory,
        config.exeBaseName + ".exe"
    );

    const res = await pipeAsync(
        createBundle(config.inputEsmFile, bundleFile),
        (res) => res.tapSuccess(console.log),
        (res) => res.bindAsync(() => createSeaConfigFile(bundleFile, exeFile, seaConfigFile)),
        (res) => res.tapSuccess(console.log),
        (res) => res.bindAsync(() => createSeaExe(seaConfigFile)),
        (res) => res.tapSuccess(console.log),
    );

    if (res.failed) {
        throw new Error(res.error);
    }

    return new SucceededResult(0);
}


/**
 * Bundles the ESM entry point with esbuild using ESM output format, which
 * supports top-level await.
 *
 * @param inputEsm - The ESM entry point file
 * @param bundleFile - The output bundle file
 * @return If successful, a success message; otherwise, an error message
 */
async function createBundle(
    inputEsm: File,
    bundleFile: File
): Promise<Result<string, string>> {
    // Mark react-devtools-core as external: it is a dev-only optional dependency
    // that Ink conditionally imports and is never needed in production bundles.
    const externals = ["react-devtools-core"].map((e) => `--external:${e}`).join(" ");
    try {
        await exec(
            `npx esbuild ${inputEsm.toString()} --bundle --platform=node --format=esm ${externals} --outfile=${bundleFile.toString()}`
        );
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
 * Runs node with the --build-sea option to create a SEA application.
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
    inputEsmFile: File;
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

    const inputEsmFile = new File(argv.inputEsmFile);
    const exeBaseName = argv.exeBaseName;

    // Validate the exe base name.
    if (exeBaseName.length === 0) {
        return new FailedResult(`Base name of output executable cannot be empty.`);
    }

    // Validate the input ESM JavaScript file.
    const inputEsmExists = await inputEsmFile.exists();
    if (!inputEsmExists) {
        return new FailedResult(`Input ESM file "${inputEsmFile.toString()}" does not exist.`);
    }
    else {
        return new SucceededResult({inputEsmFile, exeBaseName});
    }
}


/**
 * Definition of this subcommand.
 */
export const def = {
    command:     "esmToSeaApp",
    description: commandDescription,
    builder:     builder,
    handler:     handler
};
