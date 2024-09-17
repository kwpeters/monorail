import * as os from "os";
import * as url from "url";
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
import { sInt8Min, uInt8Max } from "../../../packages/depot/src/numericRange.js";
import { FailedResult, Result, SucceededResult } from "../../../packages/depot/src/result.js";
import { PromiseResult } from "../../../packages/depot/src/promiseResult.js";
import { BufBuilder } from "../../../packages/depot-node/src/bufBuilder.js";
import { BufReader } from "../../../packages/depot-node/src/bufReader.js";


if (runningThisScript()) {

    const res = await PromiseResult.forceResult(main());
    if (res.failed) {
        console.error(res.error);
        process.exit(-1);
    }
    else if (res.value !== 0) {
        console.error(`Script exited with code ${res.value}.`);
        process.exit(res.value);
    }
}


function runningThisScript(): boolean {
    const runningThisScript = import.meta.url === url.pathToFileURL(process.argv[1]).href;
    return runningThisScript;
}


interface IConfig {
    val: number;
}


async function getConfiguration(): Promise<IConfig> {
    const argv = await yargs(hideBin(process.argv))
    .usage(
        [
            "Converts a value to other representations.",
            "",
            "convertInt <8_bit_integer_value>"
        ].join(os.EOL)
    )
    .help()
    .wrap(process.stdout.columns ?? 80)
    .argv;

    return {
        // eslint-disable-next-line radix
        val: parseInt(argv._[0] as string)
    };
}


async function main(): Promise<Result<number, string>> {
    const config = await getConfiguration();
    const val = config.val;

    const builder = new BufBuilder();

    if (val > sInt8Min && val < 0) {
        builder.appendInt8(val);
    }
    else if (val < uInt8Max) {
        builder.appendUInt8(val);
    }
    else {
        return new FailedResult(`Illegal value "${val}".`);
    }

    const buf = builder.toBuffer();

    const uint8Res = new BufReader(buf).readUInt8();
    if (uint8Res.succeeded) {
        console.log(`UInt8:    ${numberString(uint8Res.value)}`);
    }

    const int8Res = new BufReader(buf).readInt8();
    if (int8Res.succeeded) {
        console.log(`SInt8:    ${numberString(int8Res.value)}`);
    }

    return new SucceededResult(0);
}


function numberString(x: number): string {
    const negStr = x < 0 ? "-" : "";
    const absVal = Math.abs(x);

    const decStr = x.toString(10);
    const hexStr = negStr + "0x" + absVal.toString(16);
    const binStr = negStr + "0b" + absVal.toString(2);

    return `${decStr} (${hexStr}, ${binStr})`;
}
