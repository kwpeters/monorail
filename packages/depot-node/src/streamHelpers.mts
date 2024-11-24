import {Readable} from "node:stream";
import { isBuffer } from "lodash-es";


export function readableStreamToText(readable: Readable): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        readable.setEncoding("utf8");
        let accumulatedText = "";

        readable.on("readable", () => {
            const chunk = readable.read() as string | null;
            if (chunk !== null) {
                accumulatedText += chunk;
            }
        });

        readable.on("end", () => {
            resolve(accumulatedText);
        });

        readable.on("error", (err) => {
            reject(err);
        });

    });
}


// A helper method used to read a Node.js readable stream into a Buffer
export function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const chunks: Array<Buffer> = [];
        readableStream.on("data", (data: Buffer | string | ArrayBuffer | SharedArrayBuffer) => {

            if (isBuffer(data)) {
                chunks.push(data as Buffer);
            }
            else if (typeof data === "string") {
                chunks.push(Buffer.from(data));
            }
            else if (data instanceof ArrayBuffer || data instanceof SharedArrayBuffer) {
                chunks.push(Buffer.from(data));
            }
            else {
                throw new Error("Unsupported type of data in readable stream.");
            }
        });
        readableStream.on("end", () => {
            resolve(Buffer.concat(chunks));
        });
        readableStream.on("error", reject);
    });
}
