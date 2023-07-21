import { FailedResult, Result, SucceededResult } from "../../depot/src/result.js";
import { NodePackage } from "./nodePackage.js";
import { spawn, ISpawnOutput } from "./spawn2.js";


export class NodePackageScript {


    public static create(
        nodePkg: NodePackage,
        name: string,
        cmdLine: string
    ): Result<NodePackageScript, string> {

        if (name.length === 0) {
            return new FailedResult(`The node package "${nodePkg.projectName}" has a script with a zero length name.`);
        }

        if (cmdLine.length === 0) {
            return new FailedResult(`The node package "${nodePkg.projectName}" has a script with a zero length command line.`);
        }

        return new SucceededResult(new NodePackageScript(nodePkg, name, cmdLine));
    }


    private constructor(
        public readonly nodePkg: NodePackage,
        public readonly name: string,
        public readonly cmdLine: string
    ) {
    }


    public run(): ISpawnOutput {
        const output = spawn("npm", ["run", this.name], {shell: true, cwd: this.nodePkg.directory.toString()});
        return output;
    }
}
