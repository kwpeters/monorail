import type { MaybePromise } from "./typeUtils.mjs";
import { Result } from "./result.mjs";



type AsyncResult<TSuccess, TError> = MaybePromise<Result<TSuccess, TError>>;
type AsyncResultStep<TInSuccess, TOutSuccess, TOutError> =
    (value: TInSuccess) => AsyncResult<TOutSuccess, TOutError>;



/**
 * Pipes an initial Result through a sequence of potentially asynchronous
 * functions that also return a Result.  Each Result is inspected, and if it is
 * a FailedResult execution of subsequent functions is short circuited and the
 * FailedResult is returned. Otherwise, the next function is called, passing the
 * unwrapped successful value as the parameter.
 *
 * @example
 * const result = await pipeWhileSuccessful(
 *     new SucceededResult(5),
 *     (n) => new SucceededResult(n + 1),
 *     (n) => new SucceededResult(n * 2),
 *     (n) => new SucceededResult(n - 3)
 * );
 *
 * @return If a FailedResult is returned by any function, execution of
 * subsequent functions is short circuited and a Promise for the FailedResult is
 * returned. If the entire pipeline succeeds, a Promise for the Result returned
 * by the last function is returned.
 */
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

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>
): Promise<Result<T005S, T001E | T002E | T003E | T004E | T005E>>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>
): Promise<Result<T006S, T001E | T002E | T003E | T004E | T005E | T006E>>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>
): Promise<Result<T007S, T001E | T002E | T003E | T004E | T005E | T006E | T007E>>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>
): Promise<Result<T008S, T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E>>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>
): Promise<Result<T009S, T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E>>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E, T010S, T010E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>,
    f009010: AsyncResultStep<T009S, T010S, T010E>
): Promise<Result<T010S, T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E | T010E>>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E, T010S, T010E, T011S, T011E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>,
    f009010: AsyncResultStep<T009S, T010S, T010E>,
    f010011: AsyncResultStep<T010S, T011S, T011E>
): Promise<
    Result<T011S, T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E | T010E | T011E>
>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E, T010S, T010E, T011S, T011E, T012S, T012E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>,
    f009010: AsyncResultStep<T009S, T010S, T010E>,
    f010011: AsyncResultStep<T010S, T011S, T011E>,
    f011012: AsyncResultStep<T011S, T012S, T012E>
): Promise<
    Result<
        T012S,
        T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E | T010E | T011E | T012E
    >
>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E, T010S, T010E, T011S, T011E, T012S, T012E, T013S, T013E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>,
    f009010: AsyncResultStep<T009S, T010S, T010E>,
    f010011: AsyncResultStep<T010S, T011S, T011E>,
    f011012: AsyncResultStep<T011S, T012S, T012E>,
    f012013: AsyncResultStep<T012S, T013S, T013E>
): Promise<
    Result<
        T013S,
        T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E | T010E | T011E | T012E |
        T013E
    >
>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E, T010S, T010E, T011S, T011E, T012S, T012E, T013S, T013E, T014S, T014E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>,
    f009010: AsyncResultStep<T009S, T010S, T010E>,
    f010011: AsyncResultStep<T010S, T011S, T011E>,
    f011012: AsyncResultStep<T011S, T012S, T012E>,
    f012013: AsyncResultStep<T012S, T013S, T013E>,
    f013014: AsyncResultStep<T013S, T014S, T014E>
): Promise<
    Result<
        T014S,
        T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E | T010E | T011E | T012E |
        T013E | T014E
    >
>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E, T010S, T010E, T011S, T011E, T012S, T012E, T013S, T013E, T014S, T014E,
    T015S, T015E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>,
    f009010: AsyncResultStep<T009S, T010S, T010E>,
    f010011: AsyncResultStep<T010S, T011S, T011E>,
    f011012: AsyncResultStep<T011S, T012S, T012E>,
    f012013: AsyncResultStep<T012S, T013S, T013E>,
    f013014: AsyncResultStep<T013S, T014S, T014E>,
    f014015: AsyncResultStep<T014S, T015S, T015E>
): Promise<
    Result<
        T015S,
        T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E | T010E | T011E | T012E |
        T013E | T014E | T015E
    >
>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E, T010S, T010E, T011S, T011E, T012S, T012E, T013S, T013E, T014S, T014E,
    T015S, T015E, T016S, T016E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>,
    f009010: AsyncResultStep<T009S, T010S, T010E>,
    f010011: AsyncResultStep<T010S, T011S, T011E>,
    f011012: AsyncResultStep<T011S, T012S, T012E>,
    f012013: AsyncResultStep<T012S, T013S, T013E>,
    f013014: AsyncResultStep<T013S, T014S, T014E>,
    f014015: AsyncResultStep<T014S, T015S, T015E>,
    f015016: AsyncResultStep<T015S, T016S, T016E>
): Promise<
    Result<
        T016S,
        T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E | T010E | T011E | T012E |
        T013E | T014E | T015E | T016E
    >
>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E, T010S, T010E, T011S, T011E, T012S, T012E, T013S, T013E, T014S, T014E,
    T015S, T015E, T016S, T016E, T017S, T017E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>,
    f009010: AsyncResultStep<T009S, T010S, T010E>,
    f010011: AsyncResultStep<T010S, T011S, T011E>,
    f011012: AsyncResultStep<T011S, T012S, T012E>,
    f012013: AsyncResultStep<T012S, T013S, T013E>,
    f013014: AsyncResultStep<T013S, T014S, T014E>,
    f014015: AsyncResultStep<T014S, T015S, T015E>,
    f015016: AsyncResultStep<T015S, T016S, T016E>,
    f016017: AsyncResultStep<T016S, T017S, T017E>
): Promise<
    Result<
        T017S,
        T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E | T010E | T011E | T012E |
        T013E | T014E | T015E | T016E | T017E
    >
>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E, T010S, T010E, T011S, T011E, T012S, T012E, T013S, T013E, T014S, T014E,
    T015S, T015E, T016S, T016E, T017S, T017E, T018S, T018E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>,
    f009010: AsyncResultStep<T009S, T010S, T010E>,
    f010011: AsyncResultStep<T010S, T011S, T011E>,
    f011012: AsyncResultStep<T011S, T012S, T012E>,
    f012013: AsyncResultStep<T012S, T013S, T013E>,
    f013014: AsyncResultStep<T013S, T014S, T014E>,
    f014015: AsyncResultStep<T014S, T015S, T015E>,
    f015016: AsyncResultStep<T015S, T016S, T016E>,
    f016017: AsyncResultStep<T016S, T017S, T017E>,
    f017018: AsyncResultStep<T017S, T018S, T018E>
): Promise<
    Result<
        T018S,
        T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E | T010E | T011E | T012E |
        T013E | T014E | T015E | T016E | T017E | T018E
    >
>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E, T010S, T010E, T011S, T011E, T012S, T012E, T013S, T013E, T014S, T014E,
    T015S, T015E, T016S, T016E, T017S, T017E, T018S, T018E, T019S, T019E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>,
    f009010: AsyncResultStep<T009S, T010S, T010E>,
    f010011: AsyncResultStep<T010S, T011S, T011E>,
    f011012: AsyncResultStep<T011S, T012S, T012E>,
    f012013: AsyncResultStep<T012S, T013S, T013E>,
    f013014: AsyncResultStep<T013S, T014S, T014E>,
    f014015: AsyncResultStep<T014S, T015S, T015E>,
    f015016: AsyncResultStep<T015S, T016S, T016E>,
    f016017: AsyncResultStep<T016S, T017S, T017E>,
    f017018: AsyncResultStep<T017S, T018S, T018E>,
    f018019: AsyncResultStep<T018S, T019S, T019E>
): Promise<
    Result<
        T019S,
        T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E | T010E | T011E | T012E |
        T013E | T014E | T015E | T016E | T017E | T018E | T019E
    >
>;

export async function pipeWhileSuccessful<
    T001S, T001E, T002S, T002E, T003S, T003E, T004S, T004E, T005S, T005E, T006S, T006E, T007S, T007E,
    T008S, T008E, T009S, T009E, T010S, T010E, T011S, T011E, T012S, T012E, T013S, T013E, T014S, T014E,
    T015S, T015E, T016S, T016E, T017S, T017E, T018S, T018E, T019S, T019E, T020S, T020E
>(
    v001: AsyncResult<T001S, T001E>,
    f001002: AsyncResultStep<T001S, T002S, T002E>,
    f002003: AsyncResultStep<T002S, T003S, T003E>,
    f003004: AsyncResultStep<T003S, T004S, T004E>,
    f004005: AsyncResultStep<T004S, T005S, T005E>,
    f005006: AsyncResultStep<T005S, T006S, T006E>,
    f006007: AsyncResultStep<T006S, T007S, T007E>,
    f007008: AsyncResultStep<T007S, T008S, T008E>,
    f008009: AsyncResultStep<T008S, T009S, T009E>,
    f009010: AsyncResultStep<T009S, T010S, T010E>,
    f010011: AsyncResultStep<T010S, T011S, T011E>,
    f011012: AsyncResultStep<T011S, T012S, T012E>,
    f012013: AsyncResultStep<T012S, T013S, T013E>,
    f013014: AsyncResultStep<T013S, T014S, T014E>,
    f014015: AsyncResultStep<T014S, T015S, T015E>,
    f015016: AsyncResultStep<T015S, T016S, T016E>,
    f016017: AsyncResultStep<T016S, T017S, T017E>,
    f017018: AsyncResultStep<T017S, T018S, T018E>,
    f018019: AsyncResultStep<T018S, T019S, T019E>,
    f019020: AsyncResultStep<T019S, T020S, T020E>
): Promise<
    Result<
        T020S,
        T001E | T002E | T003E | T004E | T005E | T006E | T007E | T008E | T009E | T010E | T011E | T012E |
        T013E | T014E | T015E | T016E | T017E | T018E | T019E | T020E
    >
>;


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
