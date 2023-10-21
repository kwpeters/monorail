import * as _ from "lodash-es";
import {mapAsync} from "./promiseHelpers.js";


/**
 * A type that describes a function that validates a particular subject.  The
 * function accepts the subject as its only parameter and returns a boolean or a
 * Promise for a boolean.
 */
export type ValidatorFunc<TSubject> = (subject: TSubject) => boolean | Promise<boolean>;


/**
 * A Validator is an object that can evaluate the validity of a subject by
 * invoking an array of validator functions on that subject.  This class is
 * templated on the type of the subject to be validated.  Implemented as a class
 * so that the validators can be configured during construction and then used
 * numerous times.  For a functional version see validate().
 */
export class Validator<TSubject> {
    // region Data Members
    private readonly _validatorFuncs: Array<ValidatorFunc<TSubject>>;
    // endregion


    /**
     * Constructs a new Validator.
     *
     * @param validatorFuncs - The functions used to validate a subject.  Each
     * function must have a single parameter of the subject type and return a
     * boolean or Promise<boolean> (true=valid, false=invalid).  If an async
     * function rejects, the subject is assumed to be invalid.
     */
    public constructor(validatorFuncs: Array<ValidatorFunc<TSubject>>) {
        this._validatorFuncs = validatorFuncs;
    }


    /**
     * Evaluates the validity of subject.
     * @param subject - The data to be validated
     * @return A promise for the validity of subject.  This promise will never
     * reject.
     */
    public isValid(subject: TSubject): Promise<boolean> {
        return validate(subject, this._validatorFuncs);
    }
}


/**
 * Validates a value by passing it into an array of (possibly asynchronous)
 * validator functions.  The value is considered valid if all values return a
 * truthy value.
 *
 * @param subject - The value to be validated
 * @param validatorFuncs - The functions that will perform the validation
 * @return Whether or not the value is valid
 */
export function validate<TSubject>(
    subject: TSubject,
    validatorFuncs: Array<ValidatorFunc<TSubject>>
): Promise<boolean> {

    return mapAsync(validatorFuncs, (curValidatorFunc) => {
        const result: Promise<boolean> | boolean = curValidatorFunc(subject);
        // Wrap each return value in a Promise.
        return Promise.resolve(result);
    })
    .then((validationResults) => {
        // Return true only if every validator returned true.
        return _.every(validationResults);
    })
    .catch(() => {
        // One of the validators rejected.  Assume that means a failed
        // validation.
        return false;
    });
}


////////////////////////////////////////////////////////////////////////////////
//
// Utility Validators
//
////////////////////////////////////////////////////////////////////////////////


/// A validator that always says the subject is valid.
export function alwaysValid<TSubject>(subject: TSubject): boolean {
    return true;
}
