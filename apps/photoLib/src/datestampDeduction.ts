import { File } from "../../../packages/depot-node/src/file.js";
import {Datestamp} from "./datestamp.js";

export enum ConfidenceLevel {
    High = 10,
    Medium = 6,
    Low = 3,
    NoClue = 0
}


export interface IDatestampDeductionSuccess {
    readonly confidence: ConfidenceLevel;
    readonly datestamp: Datestamp;
    readonly explanation: string;
    readonly destFile: File;
}


export interface IDatestampDeductionFailure {
    readonly confidence: ConfidenceLevel.NoClue;
    readonly explanation: string;
}



export type DatestampDeduction = IDatestampDeductionFailure | IDatestampDeductionSuccess;


export function isSuccesfulDatestampDeduction(deduction: DatestampDeduction): deduction is IDatestampDeductionSuccess {
    return deduction.confidence !== ConfidenceLevel.NoClue;
}


export function isFailureDatestampDeduction(deduction: DatestampDeduction): deduction is IDatestampDeductionFailure {
    return deduction.confidence === ConfidenceLevel.NoClue;
}
