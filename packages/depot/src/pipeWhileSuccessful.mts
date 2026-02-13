import type { MaybePromise } from "./typeUtils.mjs";
import { Result } from "./result.mjs";



type AsyncResult<TSuccess, TError> = MaybePromise<Result<TSuccess, TError>>;

type AsyncResultStep<TInSuccess, TOutSuccess, TOutError> =
    (value: TInSuccess) => AsyncResult<TOutSuccess, TOutError>;


export async function pipeWhileSuccessful<T001S, T001E>(
    v001: AsyncResult<T001S, T001E>
): Promise<Result<T001S, T001E>>;

export async function pipeWhileSuccessful<T001S, T001E, T002S, T002E>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>
): Promise<Result<T002S, T001E | T002E>>;

export async function pipeWhileSuccessful<T001S, T001E, T002S, T002E, T003S, T003E>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>
): Promise<Result<T003S, T001E | T002E | T003E>>;

export async function pipeWhileSuccessful<T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>
): Promise<Result<T004S, T001E | T002E | T003E | T004E>>;


export async function pipeWhileSuccessful(
    v001: AsyncResult<unknown, unknown>,
    ...fns: Array<AsyncResultStep<unknown, unknown, unknown>>
): Promise<Result<unknown, unknown>> {

    // Handle the case where no functions are provided
    if (fns.length === 0) {
        return Promise.resolve(v001);
    }

    return fns.reduce(
        (prevPromiseResult, curFn) => {
            return prevPromiseResult
            .then((result) => {
                if (result.failed) {
                    return result;
                }

                return Promise.resolve(curFn(result.value));
            });
        },
        Promise.resolve(v001)
    );
}
