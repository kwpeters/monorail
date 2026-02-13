import { pipeWhileSuccessful } from "./pipeWhileSuccessful.mjs";
import { FailedResult, Result, SucceededResult } from "./result.mjs";



fdescribe("pipeWhileSuccessful()", () => {

    const fn1 = (n: number) => new SucceededResult(n + 1);
    const fn2 = (n: number) => new SucceededResult(n * 2);
    const fn3 = (n: number) => n - 3;


    it("when no functions are specified the initial value is returned", async () => {
        const result = await pipeWhileSuccessful(Promise.resolve(new SucceededResult(5)));
        expect(result).toEqual(new SucceededResult(5));
    });


    it("when the initial value is a FailedResult its error is returned and the subsequent functions are not run", async () => {

        let subsequentFnInvocations = 0;
        const subsequentFn = (n: number) => {
            subsequentFnInvocations++;
            return new SucceededResult(n + 1);
        };

        const result = await pipeWhileSuccessful(
            Promise.resolve(new FailedResult("error message") as Result<number, string>),
            subsequentFn
        );

        expect(result.failed).toBeTrue();
        expect(result.error).toEqual("error message");
    });


    it("when a function returns a FailedResult its error is returned, the preceding functions run, the subsequent functions do not run", async () => {

        let previousFnInvocations = 0;
        const previousFn = (n: number) => {
            previousFnInvocations++;
            return new SucceededResult(n + 1);
        };

        let subsequentFnInvocations = 0;
        const subsequentFn = (n: number) => {
            subsequentFnInvocations++;
            return new SucceededResult(n + 2);
        };

        const result = await pipeWhileSuccessful(
            Promise.resolve(new SucceededResult(5)),
            previousFn,
            (n) => new FailedResult("error message"),
            subsequentFn
        );

        expect(result.failed).toBeTrue();
        expect(result.error).toEqual("error message");
        expect(previousFnInvocations).toEqual(1);
        expect(subsequentFnInvocations).toEqual(0);
    });


    it("when one function is specified and it succeeds the output of the function is returned", async () => {
        const result = await pipeWhileSuccessful(
            Promise.resolve(new SucceededResult(5)),
            fn3
        );
        expect(result).toBe(2);
    });


    it("when two functions are specified and both succeed the output of the last function is returned", async () => {
        const result = await pipeWhileSuccessful(
            Promise.resolve(new SucceededResult(5)),
            fn1,
            fn3
        );
        expect(result).toBe(3);
    });


    it("when three functions are specified and all succeed the output of the last function is returned", async () => {
        const result = await pipeWhileSuccessful(
            Promise.resolve(new SucceededResult(5)),
            fn1,
            fn2,
            fn3
        );
        expect(result).toBe(9);
    });


    it("works with a mix of synchronous and asynchronous Results and functions", async () => {
        // Synchronous initial value
        const syncResult = new SucceededResult(10);

        // Mix of sync and async functions
        const syncFn = (n: number) => new SucceededResult(n + 5);
        const asyncFn = async (n: number) => Promise.resolve(new SucceededResult(n * 2));
        const finalAsyncFn = async (n: number) => Promise.resolve(n - 10);

        const result = await pipeWhileSuccessful(
            syncResult,       // 10
            syncFn,           // 10 + 5 = 15
            asyncFn,          // 15 * 2 = 30
            finalAsyncFn      // 30 - 10 = 20
        );

        expect(result).toBe(20);
    });

});
