import { promisify } from "node:util";
import * as childProcess from "node:child_process";
import { type ArgumentsCamelCase, type Argv } from "yargs";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { pipeAsync } from "@repo/depot/pipeAsync2";
import { File } from "@repo/depot-node/file";
import { PromiseResult } from "@repo/depot/promiseResult";


const exec = promisify(childProcess.exec);

const commandDescription = [
    "Bundles the specified CJS app into a Node Single Executable Application (SEA). ",
    "See: https://nodejs.org/dist/latest-v20.x/docs/api/single-executable-applications.html"
].join("");


/**
  * A type that describes the properties that are added to the Yargs arguments
  * object once the command line has been parsed.  This must be kept in sync with
  * the builder.
  */
interface IArgsCommand {
    inputCjsFile: string;
    exeBaseName: string;
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
    main: string;
    output: string;
    disableExperimentalSEAWarning: boolean;
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
    const blobFile = new File(
        config.inputCjsFile.directory,
        bundleFile.baseName + ".blob"
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
        (res) => PromiseResult.bind(() => createSeaConfigFile(bundleFile, blobFile, true, seaConfigFile), res),
        (res) => PromiseResult.tapSuccess(console.log, res),
        (res) => PromiseResult.bind(() => createBlob(seaConfigFile), res),
        (res) => PromiseResult.tapSuccess(console.log, res),
        (res) => PromiseResult.bind(() => copyNodeExecutable(exeFile), res),
        (res) => PromiseResult.tapSuccess(console.log, res),
        (res) => PromiseResult.bind(() => removeSignature(exeFile), res),
        (res) => PromiseResult.tapSuccess(console.log, res),
        (res) => PromiseResult.bind(() => injectBlob(blobFile, exeFile), res),
        (res) => PromiseResult.tapSuccess(console.log, res)
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
    blobFile: File,
    disableExperimentalSEAWarning: boolean,
    seaConfigFile: File
): Promise<Result<string, string>> {
    const seaConfig: ISeaConfig = {
        main:                          bundleFile.fileName,
        output:                        blobFile.fileName,
        disableExperimentalSEAWarning: disableExperimentalSEAWarning
    };
    await seaConfigFile.writeJson(seaConfig);
    return new SucceededResult(`✅ Created Node.js SEA config file ${seaConfigFile.toString()}.`);
}


async function createBlob(seaConfigFile: File): Promise<Result<string, string>> {
    const cmd = `node --experimental-sea-config ${seaConfigFile.fileName}`;
    try {
        await exec(cmd, {cwd: seaConfigFile.directory.absPath()});
        return new SucceededResult(`✅ SEA blob successfully created.`);
    }
    catch (err) {
        const errTyped = err as childProcess.ExecException & { stdout: string, stderr: string; };
        return new FailedResult(`❌ Blob creation failed. Node exited with ${errTyped.code}. ${errTyped.stderr}`);
    }
}


async function copyNodeExecutable(exeFile: File): Promise<Result<string, string>> {
    const escapedExeFile = exeFile.toString().replace("\\", "\\\\");
    const cmd = `node -e "require('fs').copyFileSync(process.execPath, '${escapedExeFile}')"`;
    try {
        // Don't use process.execPath from this process.  It may be tsx.
        await exec(cmd);
        return new SucceededResult("✅ Successfully copied Node executable.");
    }
    catch (err) {
        const errTyped = err as childProcess.ExecException & { stdout: string, stderr: string; };
        return new FailedResult(`❌ Failed to copy node executable. Node exited with ${errTyped.code}. ${errTyped.stderr}`);
    }
}


async function removeSignature(exeFile: File): Promise<Result<string, string>> {
    try {
        await exec(`signtool remove /s ${exeFile.toString()}`);
        return new SucceededResult(`✅ Successfully removed executable signature.`);
    }
    catch (err) {
        const errTyped = err as childProcess.ExecException & { stdout: string, stderr: string; };
        return new FailedResult(`❌ Signtool failed to remove signature. Signtool exited with ${errTyped.code}. ${errTyped.stderr}`);
    }
}


async function injectBlob(blobFile: File, exeFile: File): Promise<Result<string, string>> {
    try {
        await exec(`npx postject ${exeFile.toString()} NODE_SEA_BLOB ${blobFile.toString()} --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2`);
        return new SucceededResult(`✅ Successfully injected blob into Node executable.`);
    }
    catch (err) {
        const errTyped = err as childProcess.ExecException & { stdout: string, stderr: string; };
        return new FailedResult(`❌ Blob injection failed. Postject exited with ${errTyped.code}. ${errTyped.stderr}`);
    }
}


/**
 * Config object for this subcommand.
 */
interface IConfig {
    inputCjsFile: File;
    exeBaseName: string;
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
    command:     "cjsToSeaApp",
    description: commandDescription,
    builder:     builder,
    handler:     handler
};
