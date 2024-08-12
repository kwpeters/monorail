import * as url from "url";
import { Directory } from "../../../packages/depot-node/src/directory.js";


const __dirname = url.fileURLToPath(new URL(".", import.meta.url));


export const tmpDir = new Directory("tmp");
