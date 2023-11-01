import * as os from "os";
import { z } from "zod";
import stripJsonComments from "strip-json-comments";
import { Result, FailedResult, SucceededResult } from "../../../packages/depot/src/result.js";
import { File } from "../../../packages/depot-node/src/file.js";
import { Directory } from "../../../packages/depot-node/src/directory.js";
import { Subject, subjectSchema } from "./subjects.js";


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
    if (process.env.CLOUDHOME) {
        homeDirStr = process.env.CLOUDHOME;
    }
    else if (process.env.HOME) {
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
