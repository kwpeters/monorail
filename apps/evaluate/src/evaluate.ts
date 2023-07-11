import * as url from "url";
import yargs from "yargs/yargs";
import { evaluate } from "../../../packages/depot/src/expression.js";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";


if (runningThisScript()) {

    const res = await PromiseResult.forceResult(main());
    if (res.failed) {
        console.error(res.error);
        process.exit(-1);
    }
    else if (res.value !== 0) {
        console.error(`Script exited with code ${res.value}.`);
        process.exit(-1);
    }
}


function runningThisScript(): boolean {
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]).href;
    return runningThisScript;
}


async function main(): Promise<Result<number, string>> {
    const argv = await yargs(process.argv.slice(2)).argv;

    if (argv._.length === 0) {
        return new FailedResult("No arguments specified.");
    }
    else if (typeof argv._[0] !== "string") {
        return new FailedResult("Too many arguments specified.  You may need to quote your expression.");
    }

    const expression = argv._[0];
    const result = evaluate(expression);
    if (result.failed) {
        return result;
    }

    const answer = `${expression} = ${result.value.stringRepresentations().join(" = ")}`;
    console.log(answer);

    return new SucceededResult(0);
}
