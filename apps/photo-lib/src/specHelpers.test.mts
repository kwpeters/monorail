import * as url from "node:url";
import { Directory } from "@repo/depot-node/directory";


const __dirname = url.fileURLToPath(new URL(".", import.meta.url));


export const tmpDir = new Directory("tmp");
