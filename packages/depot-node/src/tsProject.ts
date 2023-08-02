import { Result, FailedResult, SucceededResult } from "../../depot/src/result.js";
import { Directory } from "./directory.js";
import { File } from "./file.js";




interface ITsProjectConfig {
    compilerOptions: ITsCompilerOptions;
}


interface ITsCompilerOptions {
    outDir: string;
}


export class TsProject {


    public static async fromDirectory(dir: Directory): Promise<Result<TsProject, string>> {

        // If the directory does not exist, fail.
        const dirStats = await dir.exists();
        if (!dirStats) {
            return new FailedResult(`TypeScript peoject directory "${dir.toString()}" does not exist.`);
        }

        // If the directory does not contain a tsconfig.json file, fail.
        const tsconfigJson = new File(dir, "tsconfig.json");
        const tsconfigStats = await tsconfigJson.exists();
        if (!tsconfigStats) {
            return new FailedResult(`The directory "${dir.toString()}" does not contain a tsconfig.json file.`);
        }

        return new SucceededResult(new TsProject(dir));
    }


    // #region Data Members
    private readonly _dir: Directory;
    // #endregion


    private constructor(dir: Directory) {
        this._dir = dir;
    }


    public get directory(): Directory {
        return this._dir;
    }


    public async getOutDir(): Promise<Result<Directory, string>> {
        const tsconfigJson = new File(this._dir, "tsconfig.json");
        const config = await tsconfigJson.readJson<ITsProjectConfig>();
        const outDir = new Directory(this._dir, config.compilerOptions.outDir);
        return new SucceededResult(outDir);
    }


}
