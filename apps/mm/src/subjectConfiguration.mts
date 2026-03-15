import { z } from "zod";
import stripJsonComments from "strip-json-comments";
import { Result, FailedResult, SucceededResult } from "@repo/depot/result";
import { File } from "@repo/depot-node/file";
import { type Subject, subjectSchema } from "./subjects.mjs";
import { safeParse } from "@repo/depot/zodHelpers";


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
export async function getSubjectConfiguration(subjectsConfigFile: File): Promise<Result<Array<Subject>, string>> {

    const configJsonStr = await subjectsConfigFile.read();
    const configJson = JSON.parse(stripJsonComments(configJsonStr)) as unknown;

    const parseResult = safeParse(configFileSchema, configJson);
    if (parseResult.succeeded) {
        const subjects = parseResult.value.subjects;
        return new SucceededResult(subjects);
    }
    else {
        const errMsg = `Failed to parse config file.  ${parseResult.error}`;
        return new FailedResult(errMsg);
    }
}
