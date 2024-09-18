import * as url from "url";
import { Directory } from "./directory.mjs";


const __dirname = url.fileURLToPath(new URL(".", import.meta.url));


export const sampleRepoUrl = "https://github.com/kwpeters/sampleGitRepo-src.git";
export const sampleRepoDir = new Directory(__dirname, "..", "..", "..", "..", "sampleGitRepo-src");
export const tmpDir = new Directory("tmp");
