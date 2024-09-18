import * as path from "path";
import * as _ from "lodash-es";
import {Directory} from "./directory.mjs";


export type PathPart = Directory | string;

const windowsDriveLetterPathRegex = /^.:/;


export function reducePathParts(pathParts: Array<PathPart>): string {
    return _.reduce(
        pathParts,
        (acc: string, curPathPart: PathPart): string => {

            // If the current part is a Directory instance, reset and use only
            // that directory.
            if (curPathPart instanceof Directory) {
                return curPathPart.toString();
            }

            // If the current part is a string that starts with a Windows drive
            // letter, reset and use only the current part.
            const curPathPartStr = curPathPart.toString();
            if (windowsDriveLetterPathRegex.test(curPathPartStr)) {
                return curPathPartStr;
            }

            // If we are dealing with the first part of a UNC path (that starts
            // with "\\"), then don't let path.join() process it, because it
            // will remove it.
            return acc.length === 0 && curPathPart.startsWith("\\\\") ?
                curPathPartStr :
                path.join(acc, curPathPartStr);
        },
        ""
    );
}
