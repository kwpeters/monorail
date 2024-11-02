import * as os from "node:os";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { evaluate } from "@repo/depot/expression";
import { FailedResult, Result, SucceededResult } from "@repo/depot/result";


export async function main(): Promise<number> {
    const res = await mainImpl();
    if (res.succeeded) {
        return res.value;
    }
    else {
        console.error(res.error);
        return -1;
    }
}


async function mainImpl(): Promise<Result<number, string>> {
    const argv =
        await yargs(hideBin(process.argv))
        .usage(
            [
                "Evaluates the specified mathematical expression.  Supports fractions.",
                "",
                'evaluate "<expression>"'
            ].join(os.EOL)
        )
        .demandCommand()
        .help()
        .wrap(process.stdout.columns ?? 80)
        .argv;

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
