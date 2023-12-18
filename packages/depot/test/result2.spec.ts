import {pipe} from "../src/pipe2.js";
import * as r1 from "../src/result.js";
import * as r2 from "../src/result2.js";

describe("Result", () => {

    function op1(): r2.Result<number, string> {
        return new r2.SucceededResult(1);
    }

    function op2(): r2.Result<number, string> {
        return new r2.SucceededResult(2);
    }

    function op3(): r2.Result<number, string> {
        return new r2.FailedResult("error 1");
    }

    describe("bind()", () => {

        it("r1", () => {
            const res = pipe(
                new r1.SucceededResult(0),
                (res) => r1.Result.bind((num) => new r1.SucceededResult((num + 1).toString()), res)
            );
        });


        it("r2", () => {
            const res = pipe(
                new r2.SucceededResult(0),
                (res) => res.bind((num) => new r2.SucceededResult((num + 1).toString()))
            );
        });

        
    });


});
