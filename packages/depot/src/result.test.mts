import { assertNever } from "./never.mjs";
import { NoneOption, SomeOption } from "./option.mjs";
import { pipe } from "./pipe.mjs";
import { pipe as pipe2 } from "./pipe2.mjs";
import { pipeAsync as pipeAsync2 } from "./pipeAsync2.mjs";
import { FailedResult, Result, SucceededResult } from "./result.mjs";


describe("SucceededResult", () => {

    describe("instance", () => {


        describe("value property", () => {

            it("returns the value specified during creation", () => {
                const res = new SucceededResult(12);
                expect(res.value).toEqual(12);
            });

        });


        describe("succeeded property", () => {

            it("returns true", () => {
                const res = new SucceededResult(12);
                expect(res.succeeded).toBeTrue();
            });

        });


        describe("failed property", () => {

            it("returns false", () => {
                const res = new SucceededResult(12);
                expect(res.failed).toBeFalse();
            });

        });


        describe("toString()", () => {

            it("returns the expected string", () => {
                const res = new SucceededResult(12);
                expect(res.toString()).toEqual("Successful Result (12)");
            });

        });
    });
});


describe("FailedResult", () => {

    describe("instance", () => {


        describe("error property", () => {

            it("returns the error specified during creation", () => {
                const res = new FailedResult("Error message");
                expect(res.error).toEqual("Error message");
            });

        });


        describe("succeeded property", () => {

            it("returns false", () => {
                const res = new FailedResult("Error message");
                expect(res.succeeded).toBeFalse();
            });

        });


        describe("failed property", () => {

            it("returns true", () => {
                const res = new FailedResult("Error message");
                expect(res.failed).toBeTrue();
            });

        });


        describe("toString()", () => {

            it("returns the expected string", () => {
                const res = new FailedResult("Error message");
                expect(res.toString()).toEqual("Failed Result (Error message)");
            });

        });

    });

});


describe("Result type", () => {

    function doSomething(): Result<number, string> {
        return new SucceededResult(5);
        // return new FailedResult("Error message.");
    }


    it("status can be easily determined", () => {

        const res = doSomething();
        if (res.succeeded) {
            const __val = res.value;
        }
        else {
            const __val = res.error;
        }
    });


    it("allows compiler exhaustiveness checking", () => {

        // The following code will not compile if res.succeeded cannot be
        // exhaustively checked.

        const res = doSomething();

        switch (res.succeeded) {
            case true:
                return 1;
                break;
            case false:
                return 2;
                break;
            default:
                assertNever(res);
        }
    });
});


describe("Result namespace", () => {


    describe("allObj()", () => {

        const opSuccessA = (): Result<string, number> => new SucceededResult("hello");
        const opSuccessB = (): Result<string[], string> => new SucceededResult(["one", "two", "three"]);
        const opFailA = (): Result<number, string> => new FailedResult("error 1");

        it("when one or more failures exist returns a failure containing the first one found", () => {
            const res = Result.allObj({
                op1: opSuccessA(),
                op2: opFailA(),
                op3: opSuccessB()
            });

            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("error 1");
        });


        it("when all succeed returns an object of named success values", () => {
            const res = Result.allObj({
                op1: opSuccessA(),
                op2: opSuccessB()
            });

            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual({
                op1: "hello",
                op2: ["one", "two", "three"]
            });
        });

    });


    describe("allM()", () => {

        it("return the first failed Result among the parameters", () => {
            const res = Result.allM(
                new SucceededResult(13),
                new FailedResult("error 37"),
                new SucceededResult(false)
            );

            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("error 37");
        });


        it("when all Results are successful, returns a successful Result wrapping a typed tuple of all values", () => {
            const res = Result.allM(
                new SucceededResult(13),
                new SucceededResult("foo"),
                new SucceededResult(false)
            );
            expect(res.succeeded).toBeTrue();
            if (res.succeeded) {
                const [n, s, b] = res.value;
                expect(n).toEqual(13);
                expect(s).toEqual("foo");
                expect(b).toEqual(false);
            }
            else {
                expect(false).toBeTrue();
            }
        });
    });


    describe("allArrayA", () => {


        it("when given an empty array as input, returns a successful Result containing an empty array", () => {
            const res = Result.allArrayA([] as Array<Result<number, string>>);
            expect(res).toEqual(new SucceededResult([]));
        });


        it("when some Results are failures, returns a failure Result wrapping all errors", () => {
            const res = Result.allArrayA([
                new SucceededResult(5),
                new FailedResult("error 37"),
                new SucceededResult(6),
                new FailedResult("error 47")
            ]);
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual(["error 37", "error 47"]);
        });


        it("when all Results are successful, returns a successful Result wrapping all values", () => {
            const res = Result.allArrayA([
                new SucceededResult(5),
                new SucceededResult(6),
                new SucceededResult(7),
                new SucceededResult(8)
            ]);
            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual([5, 6, 7, 8]);
        });

    });


    describe("allArrayM()", () => {

        it("when given an empty array as input, returns a successful Result containing an empty array", () => {
            const results: Array<Result<number, string>> = [];
            expect(Result.allArrayM(results)).toEqual(new SucceededResult([]));
        });


        it("when given successful results, returns an array of their values", () => {
            const results = [
                new SucceededResult(10),
                new SucceededResult(20),
                new SucceededResult(30)
            ];
            expect(Result.allArrayM(results)).toEqual(new SucceededResult([10, 20, 30]));
        });


        it("when given successful results of different types, returns an array of their values", () => {
            const results = [
                new SucceededResult(10),
                new SucceededResult(20),
                new SucceededResult(undefined)
            ];
            expect(Result.allArrayM(results)).toEqual(new SucceededResult([10, 20, undefined]));
        });


        it("when given a collection containing failures, returns the first failure", () => {
            const results = [
                new SucceededResult(10),
                new SucceededResult(20),
                new FailedResult("Error msg")
            ];
            expect(Result.allArrayM(results)).toEqual(new FailedResult("Error msg"));
        });

    });


    describe("augment()", () => {

        it("if the input is an error, returns it without invoking the function", () => {
            function step1() {
                return new FailedResult("Step 1 error.");
            }

            let numStep2Invocations = 0;
            function step2() {
                numStep2Invocations++;
                return new SucceededResult({c: 3, d: 4});
            }

            const res =
                pipe(step1())
                .pipe((res) => Result.augment(step2, res))
                .end();

            expect(res).toEqual(new FailedResult("Step 1 error."));
            expect(numStep2Invocations).toEqual(0);
        });


        it("if the input is successful, invokes fn", () => {
            function step1() {
                return new SucceededResult({a: 1, b: 2});
            }

            let numStep2Invocations = 0;
            function step2(props: {b: number}) {
                numStep2Invocations++;
                return new SucceededResult({c: props.b + 1, d: props.b + 2});
            }

            const __res =
                pipe(step1())
                .pipe((res) => Result.augment(step2, res))
                .end();

            expect(numStep2Invocations).toEqual(1);
        });


        it("if the input is successful and fn errors, returns fn's error", () => {
            function step1() {
                return new SucceededResult({a: 1, b: 2});
            }

            let numStep2Invocations = 0;
            function step2(props: {b: number}) {
                numStep2Invocations++;
                return new FailedResult("Step 2 error.");
            }

            const res =
                pipe(step1())
                .pipe((res) => Result.augment(step2, res))
                .end();

            expect(numStep2Invocations).toEqual(1);
            expect(res).toEqual(new FailedResult("Step 2 error."));
        });


        it("if the input and fn are successful, returns a successful result containing all properties", () => {
            function step1() {
                return new SucceededResult({a: 1, b: 2});
            }

            let numStep2Invocations = 0;
            function step2(props: {b: number}) {
                numStep2Invocations++;
                return new SucceededResult({c: props.b + 1, d: props.b + 2});
            }

            const res =
                pipe(step1())
                .pipe((res) => Result.augment(step2, res))
                .end();

            expect(numStep2Invocations).toEqual(1);
            expect(res).toEqual(new SucceededResult({a: 1, b: 2, c: 3, d: 4}));
        });


        it("properties in the original input can be reassigned", () => {
            function step1() {
                return new SucceededResult({a: 1, b: 2});
            }

            let numStep2Invocations = 0;
            function step2(props: {b: number}) {
                numStep2Invocations++;
                return new SucceededResult({b: 0});
            }

            const res =
                pipe(step1())
                .pipe((res) => Result.augment(step2, res))
                .end();

            expect(numStep2Invocations).toEqual(1);
            expect(res).toEqual(new SucceededResult({a: 1, b: 0}));
        });

    });


    describe("bind()", () => {

        it("with failed input the error is passed along and the function is not invoked", () => {
            let numInvocations = 0;
            function sqrt(x: number): Result<number, string> {
                numInvocations += 1;
                return x < 0 ? new FailedResult("Cannot take the square root of a negative numbwer.") :
                            new SucceededResult(Math.sqrt(x));
            }

            const result = Result.bind(sqrt, new FailedResult("Initial error"));
            expect(result.failed).toBeTruthy();
            expect(result.error).toEqual("Initial error");
            expect(numInvocations).toEqual(0);
        });


        it("with successful input the function is invoked and its Result returned", () => {
            let numInvocations = 0;
            function sqrt(x: number): Result<number, string> {
                numInvocations += 1;
                return x < 0 ? new FailedResult("Cannot take the square root of a negative numbwer.") :
                            new SucceededResult(Math.sqrt(x));
            }

            const result = Result.bind(sqrt, new SucceededResult(16));
            expect(result.succeeded).toBeTruthy();
            expect(result.value).toEqual(4);
            expect(numInvocations).toEqual(1);
        });


        it("can be used easily with pipe()", () => {

            function parse(text: string): Result<number, string> {
                const parsed = parseInt(text, 10);
                return Number.isNaN(parsed) ? new FailedResult(`Invalid integer value "${text}".`) :
                                              new SucceededResult(parsed);
            }

            function sqrt(x: number): Result<number, string> {
                return x < 0 ? new FailedResult("Cannot take the square root of a negative number.") :
                               new SucceededResult(Math.sqrt(x));
            }

            function stringify(x: number): Result<string, string> {
                return new SucceededResult(`${x}`);
            }

            const resultA =
                pipe("16")
                .pipe(parse)
                .pipe((r) => Result.bind(sqrt, r))
                .pipe((r) => Result.bind(stringify, r))
                .end();

            expect(resultA.succeeded).toBeTruthy();
            expect(resultA.value).toEqual("4");
        });


        it("returns Result<TOutSuccess, TInError, TOutError>", () => {
            enum ErrorCode {
                ERROR_1 = 101,
                ERROR_2 = 102
            }

            function op1(): Result<number, ErrorCode> {
                return new FailedResult(ErrorCode.ERROR_2);
            }

            function op2(x: number): Result<boolean, string> {
                return new SucceededResult(!!(x % 2));
            }

            const res =
                pipe(op1())
                .pipe((res) => Result.bind(op2, res))
                .end();
            if (res.failed) {
                if (typeof res.error === "string") {
                    // Here res.error has type string.
                }
                else {
                    // here res.error has type ErrorCode.
                }
            }
        });

    });


    describe("bindError()", () => {

        it("with successful input the Result is passed along and the function is not invoked", () => {

            let numInvocations = 0;

            const res =
                pipe(new SucceededResult(1))
                .pipe((res) => Result.bindError(
                    (err) => {
                        numInvocations++;
                        return new SucceededResult(2);
                    },
                    res
                ))
                .end();

            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual(1);
            expect(numInvocations).toEqual(0);
        });


        it("with failed input the function is invoked and its Result is returned", () => {
            let numInvocations = 0;

            const res =
                pipe(new FailedResult(1))
                .pipe((res) => Result.bindError(
                    (err) => {
                        numInvocations++;
                        return new SucceededResult(2);
                    },
                    res
                ))
                .end();

            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual(2);
            expect(numInvocations).toEqual(1);
        });

    });


    describe("defaultValue()", () => {


        it("when given a success value returns the contained value", () => {
            expect(Result.defaultValue(0, new SucceededResult(5))).toEqual(5);
        });


        it("when given an error value returns the specified default value", () => {
            expect(Result.defaultValue(0, new FailedResult("Error msg"))).toEqual(0);
        });


    });


    describe("defaultWith()", () => {


        it("when given a success value returns the contained value", () => {
            let numInvocations = 0;
            function getDefault() {
                numInvocations++;
                return 5;
            }

            expect(Result.defaultWith(getDefault, new SucceededResult(3))).toEqual(3);
            expect(numInvocations).toEqual(0);
        });


        it("when given an error value invokes the function and returns the result", () => {
            let numInvocations = 0;
            function getDefault() {
                numInvocations++;
                return 5;
            }

            expect(Result.defaultWith(getDefault, new FailedResult("Error msg"))).toEqual(5);
            expect(numInvocations).toEqual(1);
        });


    });


    describe("executeWhileSuccessful()", () => {

        it("returns a successful result with typed array elements when all functions succeed", () => {
            function boolResultFn(): Result<boolean, string> {
                return new SucceededResult(true);
            }

            function stringResultFn(): Result<string, string> {
                return new SucceededResult("xyzzy");
            }

            function numberResultFn(): Result<number, string> {
                return new SucceededResult(5);
            }

            const result = Result.executeWhileSuccessful(
                boolResultFn,
                stringResultFn,
                numberResultFn
            );

            // The TS compiler knows the individual types for each array/tuple
            // element. You can verify this by hovering over the following variables
            // and checking their type.
            const [boolVal, strVal, numVal] = result.value!;
            expect(boolVal).toEqual(true);
            expect(strVal).toEqual("xyzzy");
            expect(numVal).toEqual(5);
        });


        it("returns the first failure encountered", () => {
            function boolResultFn(): Result<boolean, string> {
                return new SucceededResult(true);
            }

            function stringResultFn(): Result<string, string> {
                return new FailedResult("error msg");
            }

            function numberResultFn(): Result<number, string> {
                return new SucceededResult(5);
            }

            const result = Result.executeWhileSuccessful(
                boolResultFn,
                stringResultFn,
                numberResultFn
            );

            expect(result).toEqual(new FailedResult("error msg"));
        });
    });


    describe("filterErrors()", () => {

        const results = [
            new SucceededResult(0),
            new FailedResult(1),
            new SucceededResult(2),
            new FailedResult(3),
            new SucceededResult(4)
        ];

        it("filters taking only the failure results", () => {
            const errors = Result.filterErrors(results);
            expect(errors.length).toEqual(2);
        });


        it("unwraps the failure errors", () => {
            const errors = Result.filterErrors(results);
            expect(errors).toEqual([1, 3]);
        });
    });


    describe("filterSuccesses()", () => {

        const results = [
            new SucceededResult(0),
            new FailedResult(1),
            new SucceededResult(2),
            new FailedResult(3),
            new SucceededResult(4)
        ];

        it("filters taking only the successful results", () => {
            const successes = Result.filterSuccesses(results);
            expect(successes.length).toEqual(3);
        });


        it("unwraps the successful values", () => {
            const successes = Result.filterSuccesses(results);
            expect(successes).toEqual([0, 2, 4]);
        });
    });


    describe("fromBool()", () => {

        it("returns a Result wrapping the truthy value when the condition is truthy", () => {
            const result = Result.fromBool(1, "yes", "no");
            expect(result.succeeded).toBeTrue();
            expect(result.value).toEqual("yes");
        });


        it("returns a Result wrapping the falsy value when the condition is falsy", () => {
            const result = Result.fromBool(0, "yes", "no");
            expect(result.failed).toBeTrue();
            expect(result.error).toEqual("no");
        });
    });


    describe("fromNullable()", () => {

        it("returns failure Result when the input is undefined", () => {
            const res = Result.fromNullable(undefined as undefined | number, "error message");
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("error message");
        });


        it("returns failure Result when the input is null", () => {
            const res = Result.fromNullable(null as null | number, "error message");
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("error message");
        });


        it("returns successful Result when input is neither undefine or null", () => {
            const res = Result.fromNullable(5 as undefined | number, "error message");
            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual(5);
        });
    });


    describe("fromOption()", () => {

        it("when the option is some returns a successful Result wrapping the value", () => {
            const res = Result.fromOption(new SomeOption(5), "error 1");
            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual(5);
        });


        it("when the option is none returns a failure Result wrapping the specified error", () => {
            const res = Result.fromOption(NoneOption.get(), "error 3");
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("error 3");
        });
    });


    describe("gate()", () => {

        it("when input is an error it is returned", () => {
            let numInvocations = 0;
            const gateFn = (n: number) => {
                numInvocations++;
                return new SucceededResult(n + 1);
            };

            const res =
                pipe(new FailedResult("error 1") as Result<number, string>)
                .pipe((res) => Result.gate(gateFn, res))
                .end();
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("error 1");
            expect(numInvocations).toEqual(0);
        });


        it("when input is a success fn is invoked and its failure value is returned", () => {
            let numInvocations = 0;
            const gateFn = (n: number) => {
                numInvocations++;
                return new FailedResult("error 2");
            };

            const res =
                pipe(new SucceededResult(1) as Result<number, string>)
                .pipe((res) => Result.gate(gateFn, res))
                .end();
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("error 2");
            expect(numInvocations).toEqual(1);
        });


        it("when input is a success fn is invoked and its succes causes the original successful Result to be returned", () => {
            let numInvocations = 0;
            const gateFn = (n: number) => {
                numInvocations++;
                return new SucceededResult(n + 1);
            };

            const res =
                pipe(new SucceededResult(1) as Result<number, string>)
                .pipe((res) => Result.gate(gateFn, res))
                .end();
            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual(1);
            expect(numInvocations).toEqual(1);
        });
    });


    describe("mapError()", () => {

        it("with successful input the value is passed along and the function is not invoked", () => {
            let numInvocations = 0;
            const fn = (errMsg: string) => { numInvocations++; return `Error: ${errMsg}`; };

            const result = Result.mapError(fn, new SucceededResult(1));
            expect(result.succeeded).toBeTruthy();
            expect(result.value).toEqual(1);
            expect(numInvocations).toEqual(0);
        });


        it("with failed input the function is invoked and its result is wrapped in a failed Result", () => {
            let numInvocations = 0;
            const fn = (errMsg: string) => { numInvocations++; return `Error: ${errMsg}`; };

            const result = Result.mapError(fn, new FailedResult("fake error message"));
            expect(result.failed).toBeTruthy();
            expect(result.error).toEqual("Error: fake error message");
            expect(numInvocations).toEqual(1);
        });
    });


    describe("mapSuccess()", () => {

        it("with failed input the error is passed along and the function is not invoked", () => {
            let numInvocations = 0;
            const fn = (x: number) => { numInvocations++; return x + 1; };

            const result = Result.mapSuccess(fn, new FailedResult("failure"));
            expect(result.failed).toBeTruthy();
            expect(result.error).toEqual("failure");
            expect(numInvocations).toEqual(0);
        });


        it("with successful input the function is invoked and its result is wrapped in a successful Result", () => {
            let numInvocations = 0;
            const fn = (x: number) => { numInvocations++; return x + 1; };

            const result = Result.mapSuccess(fn, new SucceededResult(1));
            expect(result.succeeded).toBeTruthy();
            expect(result.value).toEqual(2);
            expect(numInvocations).toEqual(1);
        });
    });


    describe("mapWhileSuccessful()", () => {

        it("returns a successful result with the mapped array when all succeed", () => {
            const arr = [1, 2, 3, 4, 5];
            const squareWithMaxOfFifty = (n: number) => {
                const square = n * n;
                return square < 50 ?
                    new SucceededResult(square) :
                    new FailedResult(`The square of ${n} exceeds the maximum.`);
            };

            const mapRes = Result.mapWhileSuccessful(arr, squareWithMaxOfFifty);
            expect(mapRes.succeeded).toBeTruthy();
            expect(mapRes.value).toEqual([1, 4, 9, 16, 25]);
        });


        it("returns a failure result with the first failure", () => {
            const arr = [5, 6, 7, 8, 9];
            const squareWithMaxOfFifty = (n: number) => {
                const square = n * n;
                return square < 50 ?
                    new SucceededResult(square) :
                    new FailedResult(`The square of ${n} exceeds the maximum.`);
            };

            const mapRes = Result.mapWhileSuccessful(arr, squareWithMaxOfFifty);
            expect(mapRes.succeeded).toBeFalsy();
            expect(mapRes.error).toEqual("The square of 8 exceeds the maximum.");
        });


        it("invokes the mapping function once for each success and once for the first failure", () => {
            let numFuncInvocations = 0;
            const arr = [5, 6, 7, 8, 9];
            const squareWithMaxOfFifty = (n: number) => {
                numFuncInvocations++;
                const square = n * n;
                return square < 50 ?
                    new SucceededResult(square) :
                    new FailedResult(`The square of ${n} exceeds the maximum.`);
            };

            const mapRes = Result.mapWhileSuccessful(arr, squareWithMaxOfFifty);
            expect(mapRes.succeeded).toBeFalsy();
            expect(numFuncInvocations).toEqual(4);
        });


        it("adds each result value to the returned array even when they are arrays", () => {
            const inputs = [1, 2, 3];
            const mapFn = (curInt: number): Result<[number, number], string> => {
                return new SucceededResult([curInt, curInt + 1]);
            };
            const result = Result.mapWhileSuccessful(inputs, mapFn);
            expect(result.succeeded).toBeTrue();
            expect(result.value!).toEqual([[1, 2], [2, 3], [3, 4]]);
        });

    });


    describe("match()", () => {

        it("when given a successful Result invokes only the first function and returns the returned value", () => {
            let successFnInvocations = 0;
            let errorFnInvocations = 0;

            const successFn = (x: number) => {
                successFnInvocations++;
                return x + 1;
            };
            const errorFn = () => {
                errorFnInvocations++;
                return "error message";
            };

            const res = new SucceededResult(5) as Result<number, string>;
            const output = Result.match(successFn, errorFn, res);
            expect(output).toEqual(6);
            expect(successFnInvocations).toEqual(1);
            expect(errorFnInvocations).toEqual(0);
        });


        it("when given an error Result invokes only the second function and returns the returned value", () => {
            let successFnInvocations = 0;
            let errorFnInvocations = 0;

            const successFn = (x: number) => {
                successFnInvocations++;
                return x + 1;
            };
            const errorFn = (err: string) => {
                errorFnInvocations++;
                return err.toLowerCase();
            };

            const res = new FailedResult("ERROR MESSAGE") as Result<number, string>;
            const output = Result.match(successFn, errorFn, res);
            expect(output).toEqual("error message");
            expect(successFnInvocations).toEqual(0);
            expect(errorFnInvocations).toEqual(1);
        });
    });


    describe("partition()", () => {

        it("when the input array is empty, returns two empty arrays", () => {
            const arr = [] as Array<Result<number, string>>;
            const { succeeded, failed } = Result.partition(arr);
            expect(succeeded.length).toEqual(0);
            expect(failed.length).toEqual(0);
        });


        it("when all results are successful, returns all results in the succeeded array", () => {
            const arr = [
                new SucceededResult(1),
                new SucceededResult(2),
                new SucceededResult(3)
            ] as Array<Result<number, string>>;
            const { succeeded, failed } = Result.partition(arr);
            expect(succeeded.length).toEqual(3);
            expect(failed.length).toEqual(0);
        });


        it("when all results are failures, returns all results in the failed array", () => {
            const arr = [
                new FailedResult("eror 1"),
                new FailedResult("eror 2"),
                new FailedResult("eror 3")
            ] as Array<Result<number, string>>;
            const { succeeded, failed } = Result.partition(arr);
            expect(succeeded.length).toEqual(0);
            expect(failed.length).toEqual(3);
        });


        it("when input contains a mix of successes and failures, returns expected results", () => {
            const arr = [
                new SucceededResult(1),
                new FailedResult("eror 1"),
                new SucceededResult(2),
                new FailedResult("eror 2"),
                new SucceededResult(3),
                new FailedResult("eror 3")
            ] as Array<Result<number, string>>;
            const { succeeded, failed } = Result.partition(arr);
            expect(succeeded.length).toEqual(3);
            expect(failed.length).toEqual(3);
        });

    });


    describe("requireFalsy()", () => {

        it("converts a falsy value to a successful Result containing the value", () => {
            const res = Result.requireFalsy("error", "");
            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual("");
        });


        it("converts a truthy value to a failed Result", () => {
            const res = Result.requireFalsy("Value not falsy", "truthy string");
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("Value not falsy");
        });

    });


    describe("requireOk()", () => {

        it("converts an ok value to a successful Result containing the value", () => {
            const val = {
                ok:   true,
                name: "Fred"
            };
            const res = Result.requireOk("Not ok", val);
            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual({ok: true, name: "Fred"});
        });


        it("converts a not-ok value to a failed Result", () => {
            const val = {
                ok:   false,
                name: "Fred"
            };
            const res = Result.requireOk("Not ok", val);
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("Not ok");
        });

    });


    describe("requireTruthy()", () => {

        it("converts a truthy value to a successful Result containing the value", () => {
            const res = Result.requireTruthy("not truthy", "truthy value");
            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual("truthy value");
        });


        it("converts a falsy value to a failed Result", () => {
            const res = Result.requireTruthy("not truthy", undefined);
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("not truthy");
        });

    });


    describe("requireNonEmptyArray()", () => {

        it("returns error value when the array is empty", () => {
            const res = Result.requireNonEmptyArray([], "Error message");
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("Error message");
        });


        it("returns success value when the array contains items", () => {
            const res = Result.requireNonEmptyArray([5], "Error message");
            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual([5]);
        });

    });


    describe("requireOneElementArray()", () => {

        it("returns error when given an array with no elements", () => {
            const res = Result.requireOneElementArray([], "Error message");
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("Error message");
        });


        it("returns error when given an array with multiple elements", () => {
            const res = Result.requireOneElementArray([1, 2], "Error message");
            expect(res.failed).toBeTrue();
            expect(res.error).toEqual("Error message");
        });


        it("returns success value when the array contains one element", () => {
            const res = Result.requireOneElementArray([5], "Error message");
            expect(res.succeeded).toBeTrue();
            expect(res.value).toEqual(5);
        });

    });


    describe("tap()", () => {

        it("calls the function when the input Result is a failure", () => {
            let numInvocations = 0;
            function tapFn(res: Result<number, string>) {
                numInvocations++;
                return new SucceededResult(12);
            }

            pipe(new FailedResult("error message") as Result<number, string>)
            .pipe((res) => Result.tap(tapFn, res))
            .end();

            expect(numInvocations).toEqual(1);
        });


        it("calls the function when the input Result is successful", () => {
            let numInvocations = 0;
            function tapFn(res: Result<number, string>) {
                numInvocations++;
                return new SucceededResult(12);
            }

            pipe(new SucceededResult(1) as Result<number, string>)
            .pipe((res) => Result.tap(tapFn, res))
            .end();

            expect(numInvocations).toEqual(1);
        });


        it("returns the original Result", () => {
            let numInvocations = 0;
            function tapFn(res: Result<number, string>) {
                numInvocations++;
                return new SucceededResult(12);
            }

            const actual =
                pipe(new SucceededResult(1) as Result<number, string>)
                .pipe((res) => Result.tap(tapFn, res))
                .end();

            expect(numInvocations).toEqual(1);
            expect(actual).toEqual(new SucceededResult(1));
        });
    });


    describe("tapError()", () => {

        it("calls the function when the input Result is a failure", () => {
            let numInvocations = 0;
            function tapFn(err: string) {
                numInvocations++;
                return "tapFn() return value";
            }

            pipe(new FailedResult("error message") as Result<number, string>)
            .pipe((res) => Result.tapError(tapFn, res))
            .end();

            expect(numInvocations).toEqual(1);
        });


        it("does not call the function when the input Result is successful", () => {
            let numInvocations = 0;
            function tapFn(err: string) {
                numInvocations++;
                return "tapFn() return value";
            }

            pipe(new SucceededResult(1) as Result<number, string>)
            .pipe((res) => Result.tapError(tapFn, res))
            .end();

            expect(numInvocations).toEqual(0);
        });


        it("returns the original Result", () => {
            let numInvocations = 0;
            function tapFn(err: string) {
                numInvocations++;
                return "tapFn() return value";
            }

            const actual =
                pipe(new FailedResult("error message") as Result<number, string>)
                .pipe((res) => Result.tapError(tapFn, res))
                .end();

            expect(numInvocations).toEqual(1);
            expect(actual).toEqual(new FailedResult("error message"));
        });
    });


    describe("tapSuccess()", () => {

        it("does not call the function when the input Result is a failure", () => {
            let numInvocations = 0;
            function tapFn(num: number) {
                numInvocations++;
            }

            pipe(new FailedResult("error message") as Result<number, string>)
            .pipe((res) => Result.tapSuccess(tapFn, res))
            .end();

            expect(numInvocations).toEqual(0);
        });


        it("calls the function when the input Result is successful", () => {
            let numInvocations = 0;
            function tapFn(num: number) {
                numInvocations++;
            }

            pipe(new SucceededResult(3) as Result<number, string>)
            .pipe((res) => Result.tapSuccess(tapFn, res))
            .end();

            expect(numInvocations).toEqual(1);
        });


        it("returns the original Result", () => {
            let numInvocations = 0;
            function tapFn(num: number) {
                numInvocations++;
                return num++;   // Should have no effect
            }

            const actual =
                pipe(new SucceededResult(3) as Result<number, string>)
                .pipe((res) => Result.tapSuccess(tapFn, res))
                .end();

            expect(numInvocations).toEqual(1);
            expect(actual).toEqual(new SucceededResult(3));
        });

    });


    describe("throwIfFailedWith()", () => {

        it("unwraps the value when given a successful result", () => {
            const res = new SucceededResult(5);
            const val = Result.throwIfFailedWith("error message", res);
            expect(val).toEqual(5);
        });


        it("throws when given a failed Result", () => {
            const res = new FailedResult("error 12");
            expect(() => {
                const __val = Result.throwIfFailedWith("operation failed", res);
            }).toThrowError("operation failed");
        });


        it("Uses the provided function to convert a failure into an error message", () => {
            let numInvocations = 0;
            const res = new FailedResult(5);
            const errorCodeToMessage = (errorCode: number) => {
                numInvocations++;
                return `Error: ${errorCode}`;
            };
            expect(() => {
                const __val = Result.throwIfFailedWith(errorCodeToMessage, res);
            }).toThrowError("Error: 5");
            expect(numInvocations).toEqual(1);
        });


        it("can be used in a pipe()", () => {
            expect(() => {
                pipe(new FailedResult("error 1") as Result<number, string>)
                .pipe((res) => Result.throwIfFailedWith("error 2", res))
                .end();
            }).toThrow();
        });


        it("can be used in a pipe2()", () => {
            expect(() => {
                pipe2(
                    new FailedResult("error 1") as Result<number, string>,
                    (res) => Result.throwIfFailedWith("error 2", res)
                );
            }).toThrow();
        });


        it("can be used in a pipeAsync2()", async () => {
            await expectAsync(
                pipeAsync2(
                    Promise.resolve(new FailedResult("error 1") as Result<number, string>),
                    (res) => Result.throwIfFailedWith("error 2", res)
                )
            ).toBeRejected();
        });
    });


    describe("throwIfSucceededWith()", () => {

        it("unwraps the error when given a failed result", () => {
            const res = new FailedResult("error 9");
            const err = Result.throwIfSucceededWith("error message", res);
            expect(err).toEqual("error 9");
        });


        it("throws when given a successful Result", () => {
            const res = new SucceededResult(6);
            expect(() => {
                const __val = Result.throwIfSucceededWith("operation should have failed", res);
            }).toThrowError("operation should have failed");

        });


        it("Uses the provided function to convert a success into an error message", () => {
            let numInvocations = 0;
            const res = new SucceededResult(6);
            const successToMessage = (val: number) => {
                numInvocations++;
                return `Got success "${val}" when error expected.`;
            };
            expect(() => {
                const __val = Result.throwIfSucceededWith(successToMessage, res);
            }).toThrowError(`Got success "6" when error expected.`);
            expect(numInvocations).toEqual(1);
        });
    });


    describe("toNullable()", () => {

        it("returns null when given a failed Result", () => {
            const res = new FailedResult("error message");
            const val = Result.toNullable(null, res);
            expect(val).toBeNull();
        });


        it("returns undefined when given a failed Result", () => {
            const res = new FailedResult("error message");
            const val = Result.toNullable(undefined, res);
            expect(val).toBeUndefined();
        });


        it("returns the value when given a successful Result", () => {
            const res = new SucceededResult(5);
            const val = Result.toNullable(null, res);
            expect(val).toEqual(5);
        });

    });


    describe("toOption()", () => {

        it("returns NoneOption when given a failed Result", () => {
            const res = new FailedResult("error message");
            const opt = Result.toOption(res);
            expect(opt.isNone).toBeTrue();
        });


        it("returns SomeOption wrapping the value when given a successful Result", () => {
            const res = new SucceededResult(5);
            const opt = Result.toOption(res);
            expect(opt.isSome).toBeTrue();
            expect(opt.value).toEqual(5);
        });
    });

});
