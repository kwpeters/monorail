import { type ValidatorFunc } from "@repo/depot/validator";
import {File} from "./file.mjs";


/// Validator function that succeeds when a file exists.
export const isExtantFile: ValidatorFunc<File> = async (file: File) => {
    const stats = await file.exists();
    return !!stats;
};


/// Validator function that succeeds when a file does not exist.
export const isNotExtantFile: ValidatorFunc<File> = async (file: File) => {
    const stats = await file.exists();
    return !stats;
};
