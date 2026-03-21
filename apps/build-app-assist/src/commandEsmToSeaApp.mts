/* eslint-disable prefer-named-capture-group */
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
    "Use this command instead of cjsToSeaApp when the app (or its dependencies) ",
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

    const esmBundleFile = new File(
        config.inputEsmFile.directory,
        config.inputEsmFile.baseName + "-bundle.mjs"
    );
    const cjsBundleFile = new File(
        config.inputEsmFile.directory,
        config.inputEsmFile.baseName + "-bundle.cjs"
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
        createBundle(config.inputEsmFile, esmBundleFile),
        (res) => res.tapSuccess(console.log),
        (res) => res.bindAsync(() => convertEsmBundleToCjsBundle(esmBundleFile, cjsBundleFile)),
        (res) => res.tapSuccess(console.log),
        (res) => res.bindAsync(() => createSeaConfigFile(cjsBundleFile, exeFile, seaConfigFile)),
        (res) => res.tapSuccess(console.log),
        (res) => res.bindAsync(() => createSeaExe(seaConfigFile)),
        (res) => res.tapSuccess(console.log),
        (res) => res.tapSuccess(() => console.log(`✅ Successfully created ${exeFile.toString()}.`)),
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
    // Ink optionally imports react-devtools-core (a dev-only package not
    // installed at runtime).  We provide a no-op stub via --alias so esbuild
    // bundles the stub in place of the real package.
    const stubFile = new File(bundleFile.directory, "__react-devtools-stub.mjs");
    await stubFile.write("export default { connectToDevTools: () => {} };\n");

    try {
        // Bundle as ESM so esbuild can handle top-level await in dependencies
        // like Ink (reconciler.js) and yoga-layout.
        await exec(
            `npx esbuild ${inputEsm.toString()} --bundle --platform=node --format=esm --alias:react-devtools-core=${stubFile.absPath()} --outfile=${bundleFile.toString()}`
        );
        return new SucceededResult(`✅ ESBuild successfully bundled ${bundleFile.toString()}.`);
    }
    catch (err) {
        const errTyped = err as childProcess.ExecException & { stdout: string, stderr: string; };
        return new FailedResult(`❌ Bundling failed. ESBuild exited with ${errTyped.code}. ${errTyped.stderr}`);
    }
    finally {
        await stubFile.delete().catch(() => { /* ignore cleanup errors */ });
    }
}


/**
 * Converts an esbuild ESM bundle (produced with --platform=node) to a CJS
 * bundle compatible with Node.js SEA.
 *
 * esbuild's --format=esm --platform=node output keeps node built-ins as static
 * ES import declarations, but also uses require() internally (via __require)
 * for all bundled CJS dependencies.  When the injected main script is treated
 * as ESM, dynamic require() calls in the bundled code fail because they cannot
 * be resolved in ESM context.  Converting to CJS and wrapping in an async IIFE
 * allows require() to work while preserving top-level await support from
 * dependencies like Ink and yoga-layout.
 *
 * @param esmBundle - The ESM bundle produced by createBundle()
 * @param cjsBundle - Output path for the CJS bundle
 * @return If successful, a success message; otherwise an error message
 */
async function convertEsmBundleToCjsBundle(
    esmBundle: File,
    cjsBundle: File
): Promise<Result<string, string>> {
    try {
        let content = await esmBundle.read();

        // Named imports (with optional "as" alias):
        //   import { X, Y as Z } from "pkg"  =>  const { X, Y: Z } = require("pkg");
        // ES import uses "as"; JS destructuring uses ":".
        content = content.replace(
            /^import \{ ([^}]+) \} from ["']([^"']+)["'];$/mg,
            (_match, names: string, mod: string) => {
                const converted = names.replace(/(\w+)\s+as\s+(\w+)/g, "$1: $2");
                return `const { ${converted} } = require("${mod}");`;
            }
        );

        // Namespace imports:  import * as X from "pkg"  =>  const X = require("pkg");
        content = content.replace(
            /^import \* as (\w+) from ["']([^"']+)["'];$/mg,
            (_match, name: string, mod: string) => `const ${name} = require("${mod}");`
        );

        // Default imports:  import X from "pkg"  =>  const X = require("pkg");
        content = content.replace(
            /^import (\w+) from ["']([^"']+)["'];$/mg,
            (_match, name: string, mod: string) => `const ${name} = require("${mod}");`
        );

        // Side-effect imports:  import "pkg"  =>  require("pkg");
        content = content.replace(
            /^import ["']([^"']+)["'];$/mg,
            (_match, mod: string) => `require("${mod}");`
        );

        // Remove ESM export declarations (this is an app bundle; nothing needs
        // to be exported in the CJS SEA context).
        //   export { X, Y }  (single-line or multi-line)
        //   export default X;
        content = content.replace(/^export \{[\s\S]*?\};/gm, "");
        content = content.replace(/^export default [^;]+;$/mg, "");

        // Replace import.meta.url with the CJS equivalent (file URL of the
        // current module).  Node built-ins like yoga-layout use it for path
        // resolution, but their base64 WASM variant embeds the data directly so
        // the actual path is not critical.  yargs has a catch-based fallback.
        content = content.replace(
            /\bimport\.meta\.url\b/g,
            "require('url').pathToFileURL(__filename || process.execPath).href"
        );

        // Wrap the entire bundle in an async IIFE to handle top-level await
        // expressions at the ESM module root level (e.g., yoga-layout's WASM
        // init, ink's devtools dynamic import).  require() remains accessible
        // inside the IIFE via closure over the outer CJS module scope.
        const wrapped = [
            `"use strict";`,
            `(async () => {`,
            content,
            `})().catch((err) => {`,
            `    process.stderr.write(String(err) + "\\n");`,
            `    process.exit(1);`,
            `});`,
            ``
        ].join("\n");
        await cjsBundle.write(wrapped);
        return new SucceededResult(`✅ Converted ESM bundle to CJS: ${cjsBundle.toString()}.`);
    }
    catch (err) {
        return new FailedResult(`❌ Failed to convert ESM bundle to CJS: ${String(err)}`);
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
