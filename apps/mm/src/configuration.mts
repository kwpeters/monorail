import * as os from "node:os";
import { z } from "zod";
import stripJsonComments from "strip-json-comments";
import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { File } from "@repo/depot-node/file";
import { Directory } from "@repo/depot-node/directory";
import { type Subject, subjectSchema } from "./subjects.mjs";


export const configFileSchema = z.object({
    subjects: z.array(subjectSchema)
});
export type ConfigFile = z.infer<typeof configFileSchema>;


/**
 * Gets the configuration for this application.
 *
 * @return If the configuration file is successfully read, the array of
 * Subjects defined in it.
 */
export async function getConfiguration(): Promise<Result<Array<Subject>, string>> {
    let homeDirStr: string;
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (process.env.CLOUDHOME) {
        // eslint-disable-next-line turbo/no-undeclared-env-vars
        homeDirStr = process.env.CLOUDHOME;
    }
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    else if (process.env.HOME) {
        // eslint-disable-next-line turbo/no-undeclared-env-vars
        homeDirStr = process.env.HOME;
    }
    else {
        return new FailedResult("No CLOUDHOME or HOME environment variable is set.");
    }

    const configFile = new File(new Directory(homeDirStr), "mm.json");
    const configFileStats = await configFile.exists();
    if (!configFileStats) {
        return new FailedResult(`Configuration file "${configFile.toString()}" does not exist.`);
    }

    const configJsonStr = await configFile.read();
    const configJson = JSON.parse(stripJsonComments(configJsonStr)) as unknown;
    const parseResult = configFileSchema.safeParse(configJson);
    if (parseResult.success) {
        const subjects = parseResult.data.subjects;
        return new SucceededResult(subjects);
    }
    else {
        const issues = parseResult.error.issues.map((curIssue) => JSON.stringify(curIssue)).join(os.EOL);
        const errMsg = `Failed to parse config file "${configFile.toString()}\n${issues}".`;
        return new FailedResult(errMsg);
    }
}
