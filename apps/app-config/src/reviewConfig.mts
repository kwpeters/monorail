import * as path from "node:path";
import { z } from "zod";
import stripJsonComments from "strip-json-comments";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";
import { safeParse } from "@repo/depot/zodHelpers";
import { normalizePathSeparators } from "@repo/depot/schemaUtility";
import { Directory } from "@repo/depot-node/directory";
import { File } from "@repo/depot-node/file";
import { getOs, OperatingSystem } from "@repo/depot-node/os";
import { type IReviewConfig, type IReviewMapping } from "./reviewTypes.mjs";


const schemaMapping = z.object({
    repoRelativePath:     z.string().trim().min(1),
    deployedAbsolutePath: z.string().trim().min(1)
}).strict();

const schemaConfig = z.object({
    mappings: z.array(schemaMapping).min(1)
}).strict();


type RawConfig = z.infer<typeof schemaConfig>;


function containsGlob(value: string): boolean {
    return /[*?[\]]/.test(value);
}


function getPathSeparatorForCurrentOs(): "/" | "\\" {
    const os = getOs();
    return os === OperatingSystem.Windows ? "\\" : "/";
}


export function normalizePathForCurrentOs(pathValue: string): string {
    return normalizePathSeparators(pathValue, getPathSeparatorForCurrentOs());
}


export function expandDeployedPathEnvVars(pathValue: string): Result<string, string> {
    if (/%[A-Za-z_][A-Za-z0-9_]*%/.test(pathValue)) {
        return new FailedResult("Environment variables must use " + "$" + "{VAR} syntax; %VAR% is not supported.");
    }

    if (/\$[A-Za-z_][A-Za-z0-9_]*/.test(pathValue)) {
        return new FailedResult("Environment variables must use " + "$" + "{VAR} syntax; $VAR is not supported.");
    }

    const missingNames = new Set<string>();

    const expanded = pathValue.replace(/\$\{(?<varName>[A-Za-z_][A-Za-z0-9_]*)\}/g, (_full, varName: string) => {
        if (!Object.prototype.hasOwnProperty.call(process.env, varName)) {
            missingNames.add(varName);
            return "";
        }

        return process.env[varName] ?? "";
    });

    if (missingNames.size > 0) {
        const missing = [...missingNames].join(", ");
        return new FailedResult(`Undefined environment variable(s): ${missing}`);
    }

    return new SucceededResult(expanded);
}


function validateRepoRelativePath(repoRelativePath: string): Result<string, string> {
    if (repoRelativePath.includes("${") || /%[A-Za-z_][A-Za-z0-9_]*%/.test(repoRelativePath) || /\$[A-Za-z_]/.test(repoRelativePath)) {
        return new FailedResult("repoRelativePath does not support environment-variable expansion.");
    }

    if (containsGlob(repoRelativePath)) {
        return new FailedResult("repoRelativePath must be a single file path; glob patterns are not allowed.");
    }

    const normalized = normalizePathForCurrentOs(repoRelativePath);
    if (path.isAbsolute(normalized)) {
        return new FailedResult("repoRelativePath must be repository-relative, not absolute.");
    }

    const normalizedNoTraversal = path.normalize(normalized);
    const pathSegments = normalizedNoTraversal.split(path.sep);
    if (pathSegments.includes("..")) {
        return new FailedResult("repoRelativePath must not include parent-directory traversal (..).");
    }

    return new SucceededResult(normalizedNoTraversal);
}


async function resolveMapping(
    rawMapping: RawConfig["mappings"][number],
    repoRootDir: Directory,
    mappingIndex: number
): Promise<Result<IReviewMapping, string>> {
    const mappingLabel = `mapping #${mappingIndex + 1}`;

    const repoPathResult = validateRepoRelativePath(rawMapping.repoRelativePath);
    if (repoPathResult.failed) {
        return new FailedResult(`Invalid ${mappingLabel} repoRelativePath "${rawMapping.repoRelativePath}": ${repoPathResult.error}`);
    }

    if (containsGlob(rawMapping.deployedAbsolutePath)) {
        return new FailedResult(`Invalid ${mappingLabel} deployedAbsolutePath "${rawMapping.deployedAbsolutePath}": deployedAbsolutePath must be a single file path; glob patterns are not allowed.`);
    }

    const deployedExpandedResult = expandDeployedPathEnvVars(rawMapping.deployedAbsolutePath);
    if (deployedExpandedResult.failed) {
        return new FailedResult(`Invalid ${mappingLabel} deployedAbsolutePath "${rawMapping.deployedAbsolutePath}": ${deployedExpandedResult.error}`);
    }

    const deployedAbsolutePath = normalizePathForCurrentOs(deployedExpandedResult.value);
    if (!path.isAbsolute(deployedAbsolutePath)) {
        return new FailedResult(`Invalid ${mappingLabel} deployedAbsolutePath "${rawMapping.deployedAbsolutePath}": deployedAbsolutePath must be absolute after environment expansion.`);
    }

    const repoFile = new File(repoRootDir, repoPathResult.value);
    const repoFileStats = await repoFile.exists();
    if (repoFileStats === undefined) {
        return new FailedResult(`Invalid ${mappingLabel}: repository file does not exist at ${repoFile.toString()}.`);
    }

    return new SucceededResult({
        repoRelativePath:     repoPathResult.value,
        deployedAbsolutePath: deployedAbsolutePath,
        repoFile:             repoFile,
        deployedFile:         new File(deployedAbsolutePath)
    });
}


export async function parseReviewConfig(
    configFile: File,
    repoRootDir: Directory
): Promise<Result<IReviewConfig, string>> {
    const configFileStats = await configFile.exists();
    if (configFileStats === undefined) {
        return new FailedResult(`Configuration file does not exist: ${configFile.toString()}`);
    }

    let rawJson: unknown;
    try {
        const configText = await configFile.read();
        rawJson = JSON.parse(stripJsonComments(configText, { trailingCommas: true })) as unknown;
    }
    catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "Failed to parse configuration file.";
        return new FailedResult(`Failed to parse config file JSONC at ${configFile.toString()}: ${errMsg}`);
    }

    const parsedResult = safeParse(schemaConfig, rawJson);
    if (parsedResult.failed) {
        return new FailedResult(`Failed to validate config file at ${configFile.toString()}: ${parsedResult.error}`);
    }

    const mappings: Array<IReviewMapping> = [];
    for (const [idx, mapping] of parsedResult.value.mappings.entries()) {
        const mappingResult = await resolveMapping(mapping, repoRootDir, idx);
        if (mappingResult.failed) {
            return mappingResult;
        }

        mappings.push(mappingResult.value);
    }

    return new SucceededResult({ mappings });
}
