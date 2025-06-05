import * as os from "node:os";
import { inspect } from "@repo/depot/inspect";
import { Directory } from "./directory.mjs";



/**
 * An enumeration of operating systems supported by this tool.
 *
 * @example
 * // To iterate over the values in this enumeration:
 * for (const curVal of Object.values(OperatingSystem)) {...}
 */
// Allow PascalCase so this object can look like its corresponding type.
// eslint-disable-next-line @typescript-eslint/naming-convention
export const OperatingSystem = {
    unknown: "unknown",
    darwin:  "darwin",
    windows: "windows",
    linux:   "linux"
} as const;


export type OperatingSystem = typeof OperatingSystem[keyof typeof OperatingSystem];


export function isOperatingSystem(other: unknown): other is OperatingSystem {
    if (typeof other !== "string") {
        return false;
    }

    const allowedValues = Array.from(Object.values(OperatingSystem)) as string[];
    const isValid = allowedValues.includes(other);
    return isValid;
}


export function assertOperatingSystem(other: unknown): asserts other is OperatingSystem {
    if (!isOperatingSystem(other)) {
        throw new Error(`Failed assertion.  "${inspect(other)}" is not a OperatingSystem.`);
    }
}


/**
 * Gets the current OS.
 * @return The current OS
 */
export function getOs(): OperatingSystem {
    const platform = os.platform();

    if (platform.startsWith("win")) {
        return OperatingSystem.windows;
    }
    else if (platform === "darwin") {
        return OperatingSystem.darwin;
    }
    else if (platform === "linux") {
        return OperatingSystem.linux;
    }
    else {
        return OperatingSystem.unknown;
    }
}


/**
 * Gets the current user's home directory
 * @return The current user's home directory
 */
export function getHomeDir(): Directory {
    const dirStr = os.homedir();
    return new Directory(dirStr);
}
