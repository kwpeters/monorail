import * as path from "path";
import * as _ from "lodash-es";
import {Directory} from "./directory.js";


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

            return path.join(acc, curPathPartStr);
        },
        ""
    );
}
