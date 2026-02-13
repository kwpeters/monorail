import type { MaybePromise } from "./typeUtils.mjs";
import { Result, FailedResult } from "./result.mjs";



type AsyncResult<TSuccess, TError> = MaybePromise<Result<TSuccess, TError>>;

type AsyncResultStep<TInSuccess, TOutSuccess, TOutError> =
    (value: TInSuccess) => AsyncResult<TOutSuccess, TOutError>;

type FinalStep<TInSuccess, TFinalOutput> =
    (value: TInSuccess) => MaybePromise<TFinalOutput>;


export async function pipeWhileSuccessful<T001S, T001E>(
    v001: AsyncResult<T001S, T001E>
): Promise<Awaited<AsyncResult<T001S, T001E>>>;

export async function pipeWhileSuccessful<T001S, T001E, TFinal>(
    v001: AsyncResult<T001S, T001E>,
    finalFn: FinalStep<T001S, TFinal>
): Promise<FailedResult<T001E> | TFinal>;

export async function pipeWhileSuccessful<T001S, T001E, T002S, T002E, TFinal>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    finalFn: FinalStep<T002S, TFinal>
): Promise<FailedResult<T001E | T002E> | TFinal>;

export async function pipeWhileSuccessful<T001S, T001E, T002S, T002E, T003S, T003E, TFinal>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    finalFn: FinalStep<T003S, TFinal>
): Promise<FailedResult<T001E | T002E | T003E> | TFinal>;


export async function pipeWhileSuccessful(
    v001: AsyncResult<unknown, unknown>,
    ...fns: Array<AsyncResultStep<unknown, unknown, unknown> | FinalStep<unknown, unknown>>
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
): Promise<FailedResult<unknown> | unknown> {

    // Handle the case where no functions are provided
    if (fns.length === 0) {
        return Promise.resolve(v001);
    }

    function deconstructFns(
        fns: Array<AsyncResultStep<unknown, unknown, unknown> | FinalStep<unknown, unknown>>
    ):  {
            midFns: Array<AsyncResultStep<unknown, unknown, unknown>>,
            lastFn: FinalStep<unknown, unknown>
        } {
        const fnsCopy = [...fns];
        const lastFn = fnsCopy.pop() as FinalStep<unknown, unknown>;
        const midFns = fnsCopy as Array<AsyncResultStep<unknown, unknown, unknown>>;
        return {midFns, lastFn};
    }

    const {midFns, lastFn} = deconstructFns(fns);

    const midFnsResult = await midFns.reduce(
        (prevPromiseResult, curMidFn) => {
            return prevPromiseResult
            .then((result) => {
                if (result.failed) {
                    return result;
                }

                return Promise.resolve(curMidFn(result.value));
            });
        },
        Promise.resolve(v001)
    );

    // Check the result of running the middle functions.  If any failed, return
    // the result.
    if (midFnsResult.failed) {
        return midFnsResult;
    }

    // Run the last function.  This must be executed separately from the reduce()
    // above because it has a different return type (it doesn't need to return a
    // Result).
    return lastFn(midFnsResult.value);
}
