import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { type Option } from "@repo/depot/option";
import { type File } from "@repo/depot-node/file";


/**
 * The repeating per-page lines stripped from extracted text by default.  Ported
 * verbatim from the PowerShell `build.ps1` noise patterns (tuned for the CIP
 * specification's license footer and running header).
 */
export const defaultNoisePatterns: Array<RegExp> = [
    /^\s*This subscription copy is .*licensed to/,
    /^\s*SUBSCRIPTION TERMS AND CONDITIONS/,
    /^\s*Edition\s+[\d.]+\s*$/,
    /^\s*Volume\s+\d+:.*\bChapter\b/
];


/**
 * Resolves the noise patterns to use.  When an override file is provided, its
 * contents (one regular expression per line; blank lines and `#` comments
 * ignored) **replace** the defaults — matching the PowerShell
 * `input/noise.regex.txt` mechanism.
 *
 * @param noiseFile - An optional override file
 * @return The patterns to strip, or a failure if a line is not a valid regex.
 */
export async function loadNoisePatterns(noiseFile: Option<File>): Promise<Result<Array<RegExp>, string>> {
    if (noiseFile.isNone) {
        return new SucceededResult(defaultNoisePatterns);
    }

    let text: string;
    try {
        text = await noiseFile.value.read();
    }
    catch (err) {
        return new FailedResult(`Failed to read noise file "${noiseFile.value.toString()}": ${(err as Error).message}`);
    }

    const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

    const patterns: Array<RegExp> = [];
    for (const line of lines) {
        try {
            patterns.push(new RegExp(line));
        }
        catch {
            return new FailedResult(`Invalid regular expression in noise file: ${line}`);
        }
    }
    return new SucceededResult(patterns);
}
