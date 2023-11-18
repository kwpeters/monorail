import * as os from "os";
import { IntRange } from "../../../packages/depot/src/intRange.js";
import { padLeft } from "../../../packages/depot/src/stringHelpers.js";
import { File } from "../../../packages/depot-node/src/file.js";


const signatures = [] as string[];

for (let curEndIdx = 2; curEndIdx < 201; curEndIdx++) {

    const genericTypes = getGenericTypes(curEndIdx);
    const retType = genericTypes[genericTypes.length - 1];

    signatures.push([
        `        public static ${retType} Pipe${genericTypesList(genericTypes)}(`,
        getParams(curEndIdx),
        "        )",
        "        {",
        getImpl(curEndIdx),
        "        }"
    ].join(os.EOL));
}

const outFile = new File("output.cs");
outFile.writeSync(signatures.join(os.EOL));


function paddedIdx(idx: number): string {
    return padLeft(idx.toString(10), "0", 3);
}


function idxToType(idx: number): string {
    return `T${paddedIdx(idx)}`;
}

function idxToParam(idx: number): string {
    const prevType = idxToType(idx - 1);
    const curType = idxToType(idx);

    return `Func<${prevType}, ${curType}> f${paddedIdx(idx - 1)}${paddedIdx(idx)}`;
}


function getGenericTypes(curEndIdx: number) {
    return Array.from(new IntRange(1, curEndIdx + 1))
    .map(idxToType);
}

function genericTypesList(genericTypes: string[]): string {
    const joined = genericTypes.join(", ");
    return `<${joined}>`;
}


function getParams(curEndIdx: number): string {
    const params =
        Array.from(new IntRange(1, curEndIdx + 1))
        .map((curIdx) => {
            if (curIdx === 1) {
                return `            T001 v`;
            }
            else {
                const param = idxToParam(curIdx);
                return `            ${param}`;
            }
        });
    return params.join(`,${os.EOL}`);
}

function getImplContribution(idx: number, curImpl: string): string {
    if (idx === 1) {
        return "v";
    }
    else {
        const prev = paddedIdx(idx - 1);
        const cur  = paddedIdx(idx);
        return `f${prev}${cur}(${curImpl})`;
    }
}

function getImpl(curEndIdx: number): string {
    let impl: string = "";
    for (const curIdx of new IntRange(1, curEndIdx + 1)) {
        impl = getImplContribution(curIdx, impl);
    }
    return `            return ${impl};`;
}
