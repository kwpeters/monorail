import * as os from "os";
import { IntRange } from "../../../packages/depot/src/intRange.js";
import { padLeft } from "../../../packages/depot/src/stringHelpers.js";
import { File } from "../../../packages/depot-node/src/file.js";


const signatures = [] as string[];

for (let curEndIdx = 2; curEndIdx < 201; curEndIdx++) {
    const genericParams = getGenericParams(curEndIdx);
    const paramsStr = getParameters(curEndIdx);
    const retTypeStr = `Promise<T${padLeft(curEndIdx.toString(), "0", 3)}>`;

    const signature = [
        `export function pipe${genericParams}(`,
        paramsStr,
        `): ${retTypeStr};`
    ]
    .join(os.EOL);

    signatures.push(signature);
}

const outFile = new File("output.ts");
outFile.writeSync(signatures.join(os.EOL));


function getParameters(curEndIdx: number) {
    const params = Array.from(new IntRange(1, curEndIdx + 1))
    .map((curIdx) => {
        if (curIdx === 1) {
            return `    v001: T001 | Promise<T001>`;
        }
        else {
            const prev = curIdx - 1;
            const prevStr = padLeft(prev.toString(10), "0", 3);
            const curStr = padLeft(curIdx.toString(10), "0", 3);
            const curParam = `    f${prevStr}${curStr}: (v${prevStr}: T${prevStr}) => T${curStr} | Promise<T${curStr}>`;
            return curParam;
        }
    });
    const paramsStr = params.join(`,${os.EOL}`);
    return paramsStr;
}


function getGenericParams(curEndIdx: number) {
    let genericParams = Array.from(new IntRange(1, curEndIdx + 1))
    .map((curIdx) => `T${padLeft(curIdx.toString(10), "0", 3)}`)
    .join(", ");
    genericParams = `<${genericParams}>`;
    return genericParams;
}
