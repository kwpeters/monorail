import { type PathPart, reducePathParts } from "./pathHelpers.mjs";

export class FsPath {

    private readonly _path: string;


    public constructor(pathPart: PathPart, ...pathParts: Array<PathPart>) {
        if (typeof pathPart === "string" && pathPart === "") {
            throw new Error("FsPath cannot start with an empty string.");
        }

        const allParts: Array<PathPart> = [pathPart].concat(pathParts);
        this._path = reducePathParts(allParts);
    }


    public toString(): string {
        return this._path;
    }
}
