import { File } from "@repo/depot-node/file";


export interface IReviewMapping {
    repoRelativePath:     string;
    deployedAbsolutePath: string;
    repoFile:             File;
    deployedFile:         File;
}


export interface IReviewConfig {
    mappings: Array<IReviewMapping>;
}
