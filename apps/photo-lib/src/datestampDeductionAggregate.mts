import * as _ from "lodash-es";
import { Datestamp } from "./datestamp.mjs";
import { type DatestampDeduction,
         isSuccesfulDatestampDeduction,
         type IDatestampDeductionSuccess,
         isFailureDatestampDeduction,
         ConfidenceLevel } from "./datestampDeduction.mjs";


export class DatestampDeductionAggregate {
    // #region Instance Data Members
    private readonly _deductions: Array<DatestampDeduction> = [];
    // #endregion


    public get deductions(): ReadonlyArray<DatestampDeduction> {
        return this._deductions;
    }


    public push(deduction: DatestampDeduction): void {
        this._deductions.push(deduction);
    }


    public hasSuccessfulDeductions(): boolean {
        const hasSuccessfulDeductions = _.some(this._deductions, isSuccesfulDatestampDeduction);
        return hasSuccessfulDeductions;
    }


    public getSuccessfulDeductions(): Array<IDatestampDeductionSuccess> {
        const successfulDeductions = _.filter(this._deductions, isSuccesfulDatestampDeduction);
        return successfulDeductions;
    }

    public getFailedDeductionExplanations(): Array<string> {
        const explanations = _.chain(this._deductions)
        .filter(isFailureDatestampDeduction)
        .map((curFailedDeduction) => curFailedDeduction.explanation)
        .value();

        return explanations;
    }


    public isConflicted(): boolean {
        const successfulDeductions = this.getSuccessfulDeductions();
        if (successfulDeductions.length === 0) {
            throw new Error("isConflicted() called with no successful deductions. Test to see if this aggregate is successful first.");
        }

        const firstDatestamp: Datestamp = successfulDeductions[0]!.datestamp;
        const allAreEqual = _.every(
            successfulDeductions,
            (curDeduction) => curDeduction.datestamp.equals(firstDatestamp)
        );
        return !allAreEqual;
    }


    /**
     * Gets this aggregate's highest confidence deductions.
     * @return Description
     */
    public getHighestConfidenceDeductions(): Array<IDatestampDeductionSuccess> {
        const successfulDeductions = this.getSuccessfulDeductions();
        if (successfulDeductions.length === 0) {
            return [];
        }

        const confidenceGroups = _.groupBy(successfulDeductions, (curDeduction) => curDeduction.confidence);

        const highestConfidenceLevelFound = _.find(
            [ConfidenceLevel.High, ConfidenceLevel.Medium, ConfidenceLevel.Low],
            (curConfidenceLevel) => {
                const deductions = confidenceGroups[curConfidenceLevel];
                return deductions && deductions.length > 0;
            }
        ) as ConfidenceLevel;

        return confidenceGroups[highestConfidenceLevelFound]!;
    }
}
